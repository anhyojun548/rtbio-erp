/**
 * 데이터 사용량(DataUsage) Server Actions — Phase 3G-1 (R22).
 *
 * 주요 액션:
 *   - listDataUsage({month, category?})  : 월/카테고리 조회
 *   - getMonthSummary(month)             : 해당 월 전체 집계 (카테고리별 합)
 *   - getMonthWithPrev(month)            : 당월 + 전월 비교용 집계
 *   - createDataUsage(input)             : 단건 등록 (복합 unique 충돌 시 fail)
 *   - upsertDataUsage(input)             : month+category 존재 시 덮어쓰기, 없으면 생성
 *   - updateDataUsage(input)             : 부분 업데이트
 *   - deleteDataUsage(id)
 *
 * RBAC: TENANT_OWNER / ADMIN.
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  createDataUsageSchema,
  updateDataUsageSchema,
  upsertDataUsageSchema,
  prevMonthString,
  type CreateDataUsageInput,
  type UpdateDataUsageInput,
  type UpsertDataUsageInput,
} from "@/lib/validators/data-usage";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

// ─── 조회 ─────────────────────────────────────────────────

export async function listDataUsage(opts?: {
  month?: string;
  category?: string;
  limit?: number;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const where: Prisma.DataUsageWhereInput = {};
  if (opts?.month) where.month = opts.month;
  if (opts?.category) where.category = opts.category;
  return prisma.dataUsage.findMany({
    where,
    orderBy: [{ month: "desc" }, { category: "asc" }],
    take: opts?.limit ?? 500,
  });
}

export async function listAvailableMonths(limit = 24): Promise<string[]> {
  await requireRole("TENANT_OWNER", "ADMIN");
  const rows = await prisma.dataUsage.findMany({
    select: { month: true },
    distinct: ["month"],
    orderBy: { month: "desc" },
    take: limit,
  });
  return rows.map((r) => r.month);
}

/**
 * 월 요약 — 해당 월 전체 row + 카테고리별 amount 합.
 */
export async function getMonthSummary(month: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const rows = await prisma.dataUsage.findMany({
    where: { month },
    orderBy: { category: "asc" },
  });
  const byCategory = new Map<
    string,
    { amount: number; unit: string; count: number }
  >();
  for (const r of rows) {
    const amount = Number(r.amount);
    const prev = byCategory.get(r.category);
    byCategory.set(r.category, {
      amount: (prev?.amount ?? 0) + amount,
      unit: r.unit,
      count: (prev?.count ?? 0) + 1,
    });
  }
  return {
    month,
    rows: rows.map((r) => ({
      id: r.id,
      month: r.month,
      category: r.category,
      unit: r.unit,
      amount: Number(r.amount),
      note: r.note,
      createdAt: r.createdAt,
    })),
    byCategory: Array.from(byCategory.entries()).map(([category, v]) => ({
      category,
      amount: v.amount,
      unit: v.unit,
      count: v.count,
    })),
    totalRows: rows.length,
  };
}

/**
 * 당월 + 전월 비교용 데이터.
 * 전월에만 있는 카테고리·당월에만 있는 카테고리 모두 반환.
 */
export async function getMonthWithPrev(month: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const prevMonth = prevMonthString(month);
  const [curr, prev] = await Promise.all([
    prisma.dataUsage.findMany({ where: { month } }),
    prisma.dataUsage.findMany({ where: { month: prevMonth } }),
  ]);

  const currMap = new Map<string, { amount: number; unit: string }>();
  const prevMap = new Map<string, { amount: number; unit: string }>();
  for (const r of curr)
    currMap.set(r.category, { amount: Number(r.amount), unit: r.unit });
  for (const r of prev)
    prevMap.set(r.category, { amount: Number(r.amount), unit: r.unit });

  const allCategories = new Set<string>([
    ...currMap.keys(),
    ...prevMap.keys(),
  ]);

  const comparison = Array.from(allCategories)
    .sort()
    .map((category) => {
      const c = currMap.get(category);
      const p = prevMap.get(category);
      return {
        category,
        current: c?.amount ?? null,
        previous: p?.amount ?? null,
        unit: c?.unit ?? p?.unit ?? "",
      };
    });

  return {
    month,
    prevMonth,
    comparison,
  };
}

// ─── 변경 ─────────────────────────────────────────────────

export async function createDataUsage(
  input: CreateDataUsageInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = createDataUsageSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  try {
    const row = await prisma.dataUsage.create({
      data: {
        month: d.month,
        category: d.category,
        unit: d.unit,
        amount: new Prisma.Decimal(d.amount),
        note: d.note ?? null,
        createdBy: user.id,
      },
      select: { id: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "DATA_USAGE_CREATE",
      resource: `DataUsage:${row.id}`,
      metadata: {
        month: d.month,
        category: d.category,
        amount: d.amount,
        unit: d.unit,
      },
    });
    revalidatePath("/admin/data-usage");
    return ok({ id: row.id });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return fail(
        `${d.month} / ${d.category} 항목이 이미 존재합니다. 수정하거나 덮어쓰기(upsert)를 사용하세요.`,
      );
    }
    throw e;
  }
}

export async function upsertDataUsage(
  input: UpsertDataUsageInput,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = upsertDataUsageSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const existing = await prisma.dataUsage.findUnique({
    where: { month_category: { month: d.month, category: d.category } },
    select: { id: true },
  });

  const row = await prisma.dataUsage.upsert({
    where: { month_category: { month: d.month, category: d.category } },
    create: {
      month: d.month,
      category: d.category,
      unit: d.unit,
      amount: new Prisma.Decimal(d.amount),
      note: d.note ?? null,
      createdBy: user.id,
    },
    update: {
      unit: d.unit,
      amount: new Prisma.Decimal(d.amount),
      note: d.note ?? null,
    },
    select: { id: true },
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: existing ? "DATA_USAGE_UPSERT_UPDATE" : "DATA_USAGE_UPSERT_CREATE",
    resource: `DataUsage:${row.id}`,
    metadata: {
      month: d.month,
      category: d.category,
      amount: d.amount,
      unit: d.unit,
    },
  });
  revalidatePath("/admin/data-usage");
  return ok({ id: row.id, created: !existing });
}

export async function updateDataUsage(
  input: UpdateDataUsageInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = updateDataUsageSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  try {
    await prisma.dataUsage.update({
      where: { id: d.id },
      data: {
        ...(d.category !== undefined && { category: d.category }),
        ...(d.unit !== undefined && { unit: d.unit }),
        ...(d.amount !== undefined && { amount: new Prisma.Decimal(d.amount) }),
        ...(d.note !== undefined && { note: d.note ?? null }),
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    )
      return fail("항목을 찾을 수 없습니다.");
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    )
      return fail("동일 월/카테고리 항목이 이미 존재합니다.");
    throw e;
  }

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "DATA_USAGE_UPDATE",
    resource: `DataUsage:${d.id}`,
    metadata: Object.fromEntries(
      Object.entries(d).filter(([k]) => k !== "id"),
    ),
  });
  revalidatePath("/admin/data-usage");
  return ok({ id: d.id });
}

export async function deleteDataUsage(
  id: string,
): Promise<ActionResult<null>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  try {
    const row = await prisma.dataUsage.delete({
      where: { id },
      select: { month: true, category: true },
    });
    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "DATA_USAGE_DELETE",
      resource: `DataUsage:${id}`,
      metadata: { month: row.month, category: row.category },
    });
    revalidatePath("/admin/data-usage");
    return ok(null);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    )
      return fail("항목을 찾을 수 없습니다.");
    throw e;
  }
}
