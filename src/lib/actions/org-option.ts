"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, requireMetaAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { createOrgOptionSchema, type OrgOptionKind } from "@/lib/validators/org-option";
import { ok, fail, zodFail } from "@/lib/action-result";

/** 옵션 목록 — active, kind 별. 읽기는 effectiveTeamAdmin. */
export async function listOrgOptions(kind?: string) {
  const me = await requireTeamAdmin();
  const where: Prisma.OrgOptionWhereInput = { tenantId: me.tenantId, active: true };
  // kind 가 유효하지 않으면(또는 생략) 의도적으로 전체 kind 반환 — 프론트는 무인자 GET 만 사용.
  if (kind === "DEPARTMENT" || kind === "JOB_TITLE") where.kind = kind as OrgOptionKind;
  return prisma.orgOption.findMany({
    where,
    select: { id: true, kind: true, label: true, sortOrder: true },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
}

/** 옵션 추가 — metaAdmin. 중복(active/inactive 무관) 가드. */
export async function createOrgOption(input: unknown) {
  const me = await requireMetaAdmin();
  const parsed = createOrgOptionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { kind, label } = parsed.data;

  const dup = await prisma.orgOption.findUnique({
    where: { tenantId_kind_label: { tenantId: me.tenantId, kind, label } },
    select: { id: true, active: true },
  });
  if (dup) {
    // 비활성 동일 라벨이면 되살린다 (UX), 활성이면 중복 에러
    if (!dup.active) {
      const revived = await prisma.orgOption.update({
        where: { id: dup.id }, data: { active: true },
        select: { id: true, kind: true, label: true, sortOrder: true },
      });
      logAudit({ tenantId: me.tenantId, userId: me.id, action: "ORG_OPTION_CREATE", resource: `OrgOption:${revived.id}`, metadata: { kind, label, revived: true } });
      revalidatePath("/portals/admin-portal.html");
      return ok(revived);
    }
    return fail("이미 존재하는 항목입니다.", { fieldErrors: { label: ["중복"] } });
  }

  const max = await prisma.orgOption.aggregate({ where: { tenantId: me.tenantId, kind }, _max: { sortOrder: true } });
  const created = await prisma.orgOption.create({
    data: { tenantId: me.tenantId, kind, label, sortOrder: (max._max.sortOrder ?? -1) + 1, createdBy: me.id },
    select: { id: true, kind: true, label: true, sortOrder: true },
  });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "ORG_OPTION_CREATE", resource: `OrgOption:${created.id}`, metadata: { kind, label } });
  revalidatePath("/portals/admin-portal.html");
  return ok(created);
}

/** 옵션 삭제 — metaAdmin, soft(active=false). 기존 직원 문자열값은 불변. */
export async function deactivateOrgOption(id: string) {
  const me = await requireMetaAdmin();
  const opt = await prisma.orgOption.findFirst({ where: { id, tenantId: me.tenantId }, select: { id: true, kind: true, label: true } });
  if (!opt) return fail("항목을 찾을 수 없습니다.");
  await prisma.orgOption.update({ where: { id }, data: { active: false } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "ORG_OPTION_DEACTIVATE", resource: `OrgOption:${id}`, metadata: { kind: opt.kind, label: opt.label } });
  revalidatePath("/portals/admin-portal.html");
  return ok({ id });
}
