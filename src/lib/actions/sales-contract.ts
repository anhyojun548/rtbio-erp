/**
 * 판매 계약서(SalesContract) Server Actions — Phase 3G-2 (R20).
 *
 * 주요 액션:
 *   - listContracts({clientId?, status?, q?})  : 필터 기반 목록
 *   - getContract(id)                          : 단건 조회 (client include)
 *   - listExpiringSoon(days=30)                : 만료 임박 리스트 (대시보드용)
 *   - createContract(input)
 *   - updateContract(input)
 *   - deleteContract(id)
 *
 * RBAC: TENANT_OWNER / ADMIN.
 * 감사: CONTRACT_CREATE / CONTRACT_UPDATE / CONTRACT_DELETE.
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  createContractSchema,
  updateContractSchema,
  classifyContract,
  type CreateContractInput,
  type UpdateContractInput,
  type ContractStatus,
} from "@/lib/validators/sales-contract";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

// ─── 조회 ─────────────────────────────────────────────────

export async function listContracts(opts?: {
  clientId?: string;
  signed?: boolean;
  q?: string;
  limit?: number;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const where: Prisma.SalesContractWhereInput = {};
  if (opts?.clientId) where.clientId = opts.clientId;
  if (opts?.signed !== undefined) where.signed = opts.signed;
  if (opts?.q && opts.q.trim() !== "") {
    const q = opts.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { client: { code: { contains: q, mode: "insensitive" } } },
    ];
  }
  const rows = await prisma.salesContract.findMany({
    where,
    include: {
      client: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: opts?.limit ?? 300,
  });
  return rows.map((r) => {
    const cls = classifyContract(r.startDate, r.endDate);
    return { ...r, status: cls.status, daysLeft: cls.daysLeft };
  });
}

export async function getContract(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const row = await prisma.salesContract.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, code: true, name: true } },
    },
  });
  if (!row) return null;
  const cls = classifyContract(row.startDate, row.endDate);
  return { ...row, status: cls.status, daysLeft: cls.daysLeft };
}

/**
 * 만료 임박 — endDate 가 [today, today+days] 범위에 있고 ENDING_SOON/EXPIRED 인 계약.
 * 대시보드용 빠른 조회.
 */
export async function listExpiringSoon(days = 30) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + days);

  const rows = await prisma.salesContract.findMany({
    where: {
      endDate: {
        gte: today,
        lte: end,
      },
    },
    include: {
      client: { select: { id: true, code: true, name: true } },
    },
    orderBy: { endDate: "asc" },
  });
  return rows.map((r) => {
    const cls = classifyContract(r.startDate, r.endDate);
    return { ...r, status: cls.status, daysLeft: cls.daysLeft };
  });
}

export async function countContractStatuses(): Promise<
  Record<ContractStatus, number>
> {
  await requireRole("TENANT_OWNER", "ADMIN");
  const rows = await prisma.salesContract.findMany({
    select: { startDate: true, endDate: true },
  });
  const tally: Record<ContractStatus, number> = {
    ACTIVE: 0,
    ENDING_SOON: 0,
    EXPIRED: 0,
    FUTURE: 0,
  };
  for (const r of rows) {
    const { status } = classifyContract(r.startDate, r.endDate);
    tally[status] += 1;
  }
  return tally;
}

// ─── 변경 ─────────────────────────────────────────────────

export async function createContract(
  input: CreateContractInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = createContractSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  // 거래처 존재 확인
  const client = await prisma.client.findUnique({
    where: { id: d.clientId },
    select: { id: true },
  });
  if (!client) return fail("거래처를 찾을 수 없습니다.");

  try {
    const row = await prisma.salesContract.create({
      data: {
        clientId: d.clientId,
        title: d.title,
        startDate: d.startDate,
        endDate: d.endDate ?? null,
        pdfUrl: d.pdfUrl ?? null,
        signed: d.signed ?? false,
        note: d.note ?? null,
        createdBy: user.id,
      },
      select: { id: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CONTRACT_CREATE",
      resource: `SalesContract:${row.id}`,
      metadata: {
        clientId: d.clientId,
        title: d.title,
        startDate: d.startDate.toISOString(),
        endDate: d.endDate?.toISOString() ?? null,
        signed: d.signed ?? false,
      },
    });
    revalidatePath("/admin/contracts");
    revalidatePath(`/admin/clients/${d.clientId}`);
    return ok({ id: row.id });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2003"
    ) {
      return fail("거래처 FK 제약 오류 — 존재하지 않는 거래처입니다.");
    }
    throw e;
  }
}

export async function updateContract(
  input: UpdateContractInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = updateContractSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  // endDate <-> startDate 비교: 하나만 변경된 경우 DB 현재값과 교차 검증
  if (
    (d.startDate !== undefined || d.endDate !== undefined) &&
    !(d.startDate !== undefined && d.endDate !== undefined)
  ) {
    const current = await prisma.salesContract.findUnique({
      where: { id: d.id },
      select: { startDate: true, endDate: true },
    });
    if (!current) return fail("계약서를 찾을 수 없습니다.");
    const newStart = d.startDate ?? current.startDate;
    const newEnd =
      d.endDate === null ? null : (d.endDate ?? current.endDate);
    if (newEnd && newEnd.getTime() < newStart.getTime()) {
      return fail("종료일은 시작일 이후여야 합니다.");
    }
  }

  try {
    await prisma.salesContract.update({
      where: { id: d.id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.startDate !== undefined && { startDate: d.startDate }),
        ...(d.endDate !== undefined && {
          endDate: d.endDate, // null 로도 세팅 가능 (무기한 전환)
        }),
        ...(d.pdfUrl !== undefined && { pdfUrl: d.pdfUrl ?? null }),
        ...(d.signed !== undefined && { signed: d.signed }),
        ...(d.note !== undefined && { note: d.note ?? null }),
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    )
      return fail("계약서를 찾을 수 없습니다.");
    throw e;
  }

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CONTRACT_UPDATE",
    resource: `SalesContract:${d.id}`,
    metadata: Object.fromEntries(
      Object.entries(d)
        .filter(([k]) => k !== "id")
        .map(([k, v]) => [
          k,
          v instanceof Date ? v.toISOString() : (v ?? null),
        ]),
    ),
  });
  revalidatePath("/admin/contracts");
  revalidatePath(`/admin/contracts/${d.id}`);
  return ok({ id: d.id });
}

export async function deleteContract(
  id: string,
): Promise<ActionResult<null>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  try {
    const row = await prisma.salesContract.delete({
      where: { id },
      select: { clientId: true, title: true },
    });
    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CONTRACT_DELETE",
      resource: `SalesContract:${id}`,
      metadata: { clientId: row.clientId, title: row.title },
    });
    revalidatePath("/admin/contracts");
    revalidatePath(`/admin/clients/${row.clientId}`);
    return ok(null);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    )
      return fail("계약서를 찾을 수 없습니다.");
    throw e;
  }
}
