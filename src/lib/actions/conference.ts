/**
 * 학회 + 방문자(Conference + ConferenceVisitor) Server Actions — Phase 3F-3 (R21).
 *
 * RBAC: TENANT_OWNER / ADMIN / EXEC.
 *
 * 도메인 규칙:
 *   - Conference 삭제 시 ConferenceVisitor 는 CASCADE 로 함께 제거 (schema).
 *   - assignedRepId 는 User(EXEC/ADMIN/TENANT_OWNER) 의 id. Null 허용(미배정).
 *   - 방문자 추가/수정은 즉시 반영. 감사 로그로 추적.
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  createConferenceSchema,
  updateConferenceSchema,
  createVisitorSchema,
  updateVisitorSchema,
  type CreateConferenceInput,
  type UpdateConferenceInput,
  type CreateVisitorInput,
  type UpdateVisitorInput,
} from "@/lib/validators/conference";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

// ─── Conference ──────────────────────────────────────────

export async function listConferences(opts?: {
  q?: string;
  upcoming?: boolean; // true 면 오늘 이후 시작만
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const where: Prisma.ConferenceWhereInput = {};
  if (opts?.q && opts.q.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }
  if (opts?.upcoming) {
    where.startDate = { gte: new Date(new Date().setHours(0, 0, 0, 0)) };
  }
  if (opts?.from || opts?.to) {
    where.startDate = where.startDate ?? {};
    if (opts.from) (where.startDate as Prisma.DateTimeFilter).gte = opts.from;
    if (opts.to) (where.startDate as Prisma.DateTimeFilter).lte = opts.to;
  }
  return prisma.conference.findMany({
    where,
    orderBy: [{ startDate: "desc" }],
    take: opts?.limit ?? 200,
    include: { _count: { select: { visitors: true } } },
  });
}

export async function getConference(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  return prisma.conference.findUnique({
    where: { id },
    include: {
      visitors: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createConference(
  input: CreateConferenceInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const parsed = createConferenceSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const conf = await prisma.conference.create({
    data: {
      name: d.name,
      location: d.location ?? null,
      startDate: d.startDate,
      endDate: d.endDate ?? null,
      note: d.note ?? null,
      createdBy: user.id,
    },
    select: { id: true },
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CONFERENCE_CREATE",
    resource: `Conference:${conf.id}`,
    metadata: { name: d.name, startDate: d.startDate.toISOString() },
  });
  revalidatePath("/exec/conferences");
  return ok({ id: conf.id });
}

export async function updateConference(
  input: UpdateConferenceInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const parsed = updateConferenceSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  try {
    await prisma.conference.update({
      where: { id: d.id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.location !== undefined && { location: d.location ?? null }),
        ...(d.startDate !== undefined && { startDate: d.startDate }),
        ...(d.endDate !== undefined && { endDate: d.endDate ?? null }),
        ...(d.note !== undefined && { note: d.note ?? null }),
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    )
      return fail("학회를 찾을 수 없습니다.");
    throw e;
  }

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CONFERENCE_UPDATE",
    resource: `Conference:${d.id}`,
    metadata: Object.fromEntries(
      Object.entries(d).filter(([k]) => k !== "id"),
    ),
  });
  revalidatePath("/exec/conferences");
  revalidatePath(`/exec/conferences/${d.id}`);
  return ok({ id: d.id });
}

export async function deleteConference(
  id: string,
): Promise<ActionResult<null>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  try {
    await prisma.conference.delete({ where: { id } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    )
      return fail("학회를 찾을 수 없습니다.");
    throw e;
  }
  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CONFERENCE_DELETE",
    resource: `Conference:${id}`,
  });
  revalidatePath("/exec/conferences");
  return ok(null);
}

// ─── Visitor ─────────────────────────────────────────────

export async function createVisitor(
  input: CreateVisitorInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const parsed = createVisitorSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  // 학회 존재 확인
  const conf = await prisma.conference.findUnique({
    where: { id: d.conferenceId },
    select: { id: true },
  });
  if (!conf) return fail("학회를 찾을 수 없습니다.");

  // assignedRepId 가 지정됐으면 User 존재 확인
  if (d.assignedRepId) {
    const rep = await prisma.user.findUnique({
      where: { id: d.assignedRepId },
      select: { id: true, active: true },
    });
    if (!rep || !rep.active)
      return fail("배정 대상 사용자가 존재하지 않거나 비활성 상태입니다.");
  }

  const v = await prisma.conferenceVisitor.create({
    data: {
      conferenceId: d.conferenceId,
      name: d.name,
      phone: d.phone ?? null,
      affiliation: d.affiliation ?? null,
      assignedRepId: d.assignedRepId ?? null,
      contactStatus: d.contactStatus ?? null,
      note: d.note ?? null,
      createdBy: user.id,
    },
    select: { id: true },
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CONFERENCE_VISITOR_CREATE",
    resource: `ConferenceVisitor:${v.id}`,
    metadata: {
      conferenceId: d.conferenceId,
      name: d.name,
      assignedRepId: d.assignedRepId ?? null,
    },
  });
  revalidatePath(`/exec/conferences/${d.conferenceId}`);
  return ok({ id: v.id });
}

export async function updateVisitor(
  input: UpdateVisitorInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const parsed = updateVisitorSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  if (d.assignedRepId) {
    const rep = await prisma.user.findUnique({
      where: { id: d.assignedRepId },
      select: { active: true },
    });
    if (!rep || !rep.active)
      return fail("배정 대상 사용자가 존재하지 않거나 비활성 상태입니다.");
  }

  try {
    const v = await prisma.conferenceVisitor.update({
      where: { id: d.id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.phone !== undefined && { phone: d.phone ?? null }),
        ...(d.affiliation !== undefined && {
          affiliation: d.affiliation ?? null,
        }),
        ...(d.assignedRepId !== undefined && {
          assignedRepId: d.assignedRepId ?? null,
        }),
        ...(d.contactStatus !== undefined && {
          contactStatus: d.contactStatus ?? null,
        }),
        ...(d.note !== undefined && { note: d.note ?? null }),
      },
      select: { conferenceId: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CONFERENCE_VISITOR_UPDATE",
      resource: `ConferenceVisitor:${d.id}`,
      metadata: Object.fromEntries(
        Object.entries(d).filter(([k]) => k !== "id"),
      ),
    });
    revalidatePath(`/exec/conferences/${v.conferenceId}`);
    return ok({ id: d.id });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    )
      return fail("방문자를 찾을 수 없습니다.");
    throw e;
  }
}

export async function deleteVisitor(
  id: string,
): Promise<ActionResult<null>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  try {
    const v = await prisma.conferenceVisitor.delete({
      where: { id },
      select: { conferenceId: true },
    });
    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CONFERENCE_VISITOR_DELETE",
      resource: `ConferenceVisitor:${id}`,
    });
    revalidatePath(`/exec/conferences/${v.conferenceId}`);
    return ok(null);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    )
      return fail("방문자를 찾을 수 없습니다.");
    throw e;
  }
}

/**
 * 담당자(User) 후보 목록 — 방문자 배정 UI 에서 사용.
 */
export async function listAssignableReps() {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  return prisma.user.findMany({
    where: {
      active: true,
      OR: [
        { role: "EXEC" },
        { role: "ADMIN" },
        { role: "TENANT_OWNER" },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}
