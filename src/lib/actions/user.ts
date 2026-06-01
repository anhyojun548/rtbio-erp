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
