"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, requireMetaAdmin, requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { TEAM_BY_ROLE, canGrantRole, isMetaAdmin, STAFF_ROLES } from "@/lib/team";
import {
  createUserSchema, updateUserSchema, resetPasswordSchema, changePasswordSchema,
} from "@/lib/validators/user";
import { ok, fail, zodFail } from "@/lib/action-result";

const SAFE_SELECT = {
  id: true, email: true, name: true, role: true, phone: true,
  active: true, isTeamAdmin: true, lastLoginAt: true, createdAt: true,
} satisfies Prisma.UserSelect;

/** 직원 목록 — tenantId 강제 + CLIENT 제외 + 비메타는 자기 팀만 */
export async function listUsers(opts?: { role?: string; active?: string; q?: string }) {
  const me = await requireTeamAdmin();
  const where: Prisma.UserWhereInput = {
    tenantId: me.tenantId,
    role: { in: STAFF_ROLES as UserRole[] },
  };
  // 비메타관리자(QC/EXEC 리더)는 자기 role(팀)만
  if (!isMetaAdmin(me)) where.role = me.role;
  else if (opts?.role && STAFF_ROLES.includes(opts.role as UserRole)) {
    where.role = opts.role as UserRole;
  }
  if (opts?.active === "true") where.active = true;
  if (opts?.active === "false") where.active = false;
  if (opts?.q) {
    where.OR = [
      { name: { contains: opts.q, mode: "insensitive" } },
      { email: { contains: opts.q, mode: "insensitive" } },
    ];
  }
  return prisma.user.findMany({ where, select: SAFE_SELECT, orderBy: [{ role: "asc" }, { name: "asc" }] });
}

export async function getUser(id: string) {
  const me = await requireTeamAdmin();
  const u = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId, role: { in: STAFF_ROLES as UserRole[] } },
    select: SAFE_SELECT,
  });
  if (!u) return null;
  if (!isMetaAdmin(me) && u.role !== me.role) return null; // 타 팀 차단
  return u;
}

export async function createUser(input: unknown) {
  const me = await requireTeamAdmin();
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  if (!canGrantRole(me, data.role)) {
    return fail("해당 직급의 직원을 만들 권한이 없습니다.", { fieldErrors: { role: ["권한 없음"] } });
  }
  const dup = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (dup) return fail("이미 사용 중인 이메일입니다.", { fieldErrors: { email: ["중복"] } });

  const hash = await bcrypt.hash(data.tempPassword, 10);
  const created = await prisma.user.create({
    data: {
      email: data.email, name: data.name, role: data.role, phone: data.phone ?? null,
      password: hash, tenantId: me.tenantId, isTeamAdmin: false, active: true, createdBy: me.id,
    },
    select: SAFE_SELECT,
  });
  logAudit({
    tenantId: me.tenantId, userId: me.id, action: "USER_CREATE", resource: `User:${created.id}`,
    metadata: { targetRole: created.role, team: TEAM_BY_ROLE[created.role] },
  });
  revalidatePath("/portals/admin-portal.html");
  return ok(created);
}

/** 내 테넌트 + (비메타면 같은 팀) 직원인지 확인하고 반환 */
async function loadManageableUser(me: Awaited<ReturnType<typeof requireTeamAdmin>>, id: string) {
  const u = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId, role: { in: STAFF_ROLES as UserRole[] } },
    select: { id: true, role: true, active: true },
  });
  if (!u) return null;
  if (!isMetaAdmin(me) && u.role !== me.role) return null;
  return u;
}

export async function updateUser(id: string, input: unknown) {
  const me = await requireTeamAdmin();
  if (id === me.id) return fail("본인 계정은 이 화면에서 수정할 수 없습니다.");
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const target = await loadManageableUser(me, id);
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");
  const d = parsed.data;
  if (d.role && d.role !== target.role && !canGrantRole(me, d.role)) {
    return fail("해당 직급으로 변경할 권한이 없습니다.", { fieldErrors: { role: ["권한 없음"] } });
  }
  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(d.name !== undefined && { name: d.name }),
      ...(d.phone !== undefined && { phone: d.phone ?? null }),
      ...(d.role !== undefined && { role: d.role }),
    },
    select: SAFE_SELECT,
  });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_UPDATE", resource: `User:${id}`, metadata: { changes: d } });
  revalidatePath("/portals/admin-portal.html");
  return ok(updated);
}

/** 비활성화 — soft. 본인/마지막 owner 차단 + 영업담당자 경고 */
export async function deactivateUser(id: string) {
  const me = await requireTeamAdmin();
  if (id === me.id) return fail("본인 계정은 비활성화할 수 없습니다.");
  const target = await loadManageableUser(me, id);
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");

  // 마지막 활성 owner 차단
  if (target.role === "TENANT_OWNER") {
    const owners = await prisma.user.count({ where: { tenantId: me.tenantId, role: "TENANT_OWNER", active: true } });
    if (owners <= 1) return fail("마지막 임원진(대표) 계정은 비활성화할 수 없습니다.");
  }
  // 영업담당자 경고 (차단 아님 — affectedCount 반환)
  let warning: string | undefined;
  let affectedCount = 0;
  if (target.role === "EXEC") {
    const [direct, assigned] = await Promise.all([
      prisma.client.count({ where: { salesRepId: id, active: true } }),
      prisma.salesAssignment.count({ where: { salesRepId: id, active: true } }),
    ]);
    affectedCount = direct + assigned;
    if (affectedCount > 0) warning = `이 직원에게 배정된 활성 거래처 ${affectedCount}곳이 있습니다.`;
  }
  await prisma.user.update({ where: { id }, data: { active: false } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_DEACTIVATE", resource: `User:${id}`, metadata: { role: target.role, affectedCount } });
  revalidatePath("/portals/admin-portal.html");
  return ok({ id, warning, affectedCount });
}

export async function reactivateUser(id: string) {
  const me = await requireTeamAdmin();
  const target = await loadManageableUser(me, id);
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");
  await prisma.user.update({ where: { id }, data: { active: true } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_REACTIVATE", resource: `User:${id}` });
  revalidatePath("/portals/admin-portal.html");
  return ok({ id });
}

export async function resetUserPassword(id: string, input: unknown) {
  const me = await requireTeamAdmin();
  if (id === me.id) return fail("본인 비밀번호는 '내 정보'에서 변경하세요.");
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const target = await loadManageableUser(me, id);
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");
  const hash = await bcrypt.hash(parsed.data.tempPassword, 10);
  await prisma.user.update({ where: { id }, data: { password: hash } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_PASSWORD_RESET", resource: `User:${id}` });
  return ok({ id });
}

export async function toggleTeamAdmin(id: string, grant: boolean) {
  const me = await requireMetaAdmin();
  if (id === me.id) return fail("본인의 팀 관리자 권한은 변경할 수 없습니다.");
  const target = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId, role: { in: STAFF_ROLES as UserRole[] } },
    select: { id: true, role: true },
  });
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");
  await prisma.user.update({ where: { id }, data: { isTeamAdmin: grant } });
  logAudit({
    tenantId: me.tenantId, userId: me.id,
    action: grant ? "USER_TEAM_ADMIN_GRANT" : "USER_TEAM_ADMIN_REVOKE",
    resource: `User:${id}`, metadata: { team: TEAM_BY_ROLE[target.role] },
  });
  revalidatePath("/portals/ceo-portal.html");
  return ok({ id, isTeamAdmin: grant });
}

export async function changeMyPassword(input: unknown) {
  const me = await requireAuth();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const row = await prisma.user.findUnique({ where: { id: me.id }, select: { password: true } });
  if (!row) return fail("사용자를 찾을 수 없습니다.");
  const okPw = await bcrypt.compare(parsed.data.current, row.password);
  if (!okPw) return fail("현재 비밀번호가 일치하지 않습니다.", { fieldErrors: { current: ["불일치"] } });
  const hash = await bcrypt.hash(parsed.data.next, 10);
  await prisma.user.update({ where: { id: me.id }, data: { password: hash } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_PASSWORD_CHANGE_SELF", resource: `User:${me.id}` });
  return ok({ id: me.id });
}

/** ceo 팀관리자 지정 화면용 — 전체 staff (메타관리자 전용) */
export async function listAllStaff() {
  const me = await requireMetaAdmin();
  return prisma.user.findMany({
    where: { tenantId: me.tenantId, role: { in: STAFF_ROLES as UserRole[] } },
    select: SAFE_SELECT, orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}
