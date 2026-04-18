/**
 * 월 마감 원장(ClosingLedger) Server Actions — Phase 3D-3b (R09, R10).
 *
 * 집계 규칙:
 *   - carryOver    = 전월 원장의 balance (없으면 0)
 *   - monthlySales = 당월 발행된 Invoice.totalAmount 의 합
 *                    (status: ISSUED / SENT 만 — DRAFT·CANCELLED 제외)
 *                    issueDate 기준 [월초, 다음달초) 범위.
 *   - received     = 당월 Payment.amount 의 합
 *                    paidAt 기준 [월초, 다음달초) 범위, status in (PARTIAL, PAID) — PENDING/OVERDUE 제외.
 *   - balance      = carryOver + monthlySales - received
 *
 * 동시성:
 *   - recomputeLedger 는 거래처/월 단위로 upsert. 같은 (clientId, closingMonth) 에 대한 동시호출은
 *     unique constraint 로 DB 가 직렬화. 앱 레벨 advisory lock 불필요.
 *   - closedAt != null 이면 recompute 거부 (reopenMonth 필요).
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
  recomputeLedgerSchema,
  recomputeLedgerMonthSchema,
  closeMonthSchema,
  reopenMonthSchema,
  monthToRange,
  prevMonth,
  type RecomputeLedgerInput,
  type RecomputeLedgerMonthInput,
  type CloseMonthInput,
  type ReopenMonthInput,
} from "@/lib/validators/ledger";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

// ─── 조회 ─────────────────────────────────────────────────

export type LedgerListFilter = {
  clientId?: string;
  closingMonth?: string;
  closed?: boolean;
  limit?: number;
};

export async function listLedgers(filter: LedgerListFilter = {}) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const where: Prisma.ClosingLedgerWhereInput = {};
  if (filter.clientId) where.clientId = filter.clientId;
  if (filter.closingMonth) where.closingMonth = filter.closingMonth;
  if (filter.closed !== undefined)
    where.closedAt = filter.closed ? { not: null } : null;

  return prisma.closingLedger.findMany({
    where,
    orderBy: [{ closingMonth: "desc" }, { createdAt: "desc" }],
    take: filter.limit ?? 200,
    include: {
      client: { select: { id: true, code: true, name: true } },
    },
  });
}

export async function getLedger(clientId: string, closingMonth: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.closingLedger.findUnique({
    where: { clientId_closingMonth: { clientId, closingMonth } },
    include: { client: true },
  });
}

// ─── 집계 계산 (내부) ────────────────────────────────────

async function computeLedgerFigures(
  tx: Prisma.TransactionClient,
  clientId: string,
  closingMonth: string,
): Promise<{
  carryOver: number;
  monthlySales: number;
  received: number;
  balance: number;
}> {
  const { start, end } = monthToRange(closingMonth);

  // 전월 잔액 (없으면 0)
  const pm = prevMonth(closingMonth);
  const prev = await tx.closingLedger.findUnique({
    where: { clientId_closingMonth: { clientId, closingMonth: pm } },
    select: { balance: true },
  });
  const carryOver = Number(prev?.balance ?? 0);

  // 당월 Invoice 합 (ISSUED/SENT only)
  const invAgg = await tx.invoice.aggregate({
    where: {
      clientId,
      status: { in: ["ISSUED", "SENT"] },
      issueDate: { gte: start, lt: end },
    },
    _sum: { totalAmount: true },
  });
  const monthlySales = Number(invAgg._sum.totalAmount ?? 0);

  // 당월 Payment 합 (PARTIAL/PAID only)
  const payAgg = await tx.payment.aggregate({
    where: {
      clientId,
      status: { in: ["PARTIAL", "PAID"] },
      paidAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });
  const received = Number(payAgg._sum.amount ?? 0);

  const balance = carryOver + monthlySales - received;

  return { carryOver, monthlySales, received, balance };
}

// ─── recompute (단건) ─────────────────────────────────────

export async function recomputeLedger(
  input: RecomputeLedgerInput,
): Promise<
  ActionResult<{
    clientId: string;
    closingMonth: string;
    carryOver: number;
    monthlySales: number;
    received: number;
    balance: number;
  }>
> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = recomputeLedgerSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { clientId, closingMonth } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: { id: true, name: true },
      });
      if (!client) throw new LedgerError("존재하지 않는 거래처입니다.");

      const existing = await tx.closingLedger.findUnique({
        where: { clientId_closingMonth: { clientId, closingMonth } },
        select: { id: true, closedAt: true },
      });
      if (existing?.closedAt)
        throw new LedgerError(
          "마감된 원장은 재계산할 수 없습니다. 먼저 월을 재개(reopen)해주세요.",
        );

      const figures = await computeLedgerFigures(tx, clientId, closingMonth);

      await tx.closingLedger.upsert({
        where: { clientId_closingMonth: { clientId, closingMonth } },
        create: {
          clientId,
          closingMonth,
          carryOver: new Prisma.Decimal(figures.carryOver.toFixed(2)),
          monthlySales: new Prisma.Decimal(figures.monthlySales.toFixed(2)),
          received: new Prisma.Decimal(figures.received.toFixed(2)),
          balance: new Prisma.Decimal(figures.balance.toFixed(2)),
          createdBy: user.id,
        },
        update: {
          carryOver: new Prisma.Decimal(figures.carryOver.toFixed(2)),
          monthlySales: new Prisma.Decimal(figures.monthlySales.toFixed(2)),
          received: new Prisma.Decimal(figures.received.toFixed(2)),
          balance: new Prisma.Decimal(figures.balance.toFixed(2)),
        },
      });

      return { clientName: client.name, ...figures };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "LEDGER_RECOMPUTE",
      resource: `ClosingLedger:${clientId}:${closingMonth}`,
      metadata: {
        clientId,
        clientName: result.clientName,
        closingMonth,
        carryOver: result.carryOver,
        monthlySales: result.monthlySales,
        received: result.received,
        balance: result.balance,
      },
    });

    revalidatePath("/admin/ledger");
    revalidatePath(`/admin/clients/${clientId}`);
    return ok({
      clientId,
      closingMonth,
      carryOver: result.carryOver,
      monthlySales: result.monthlySales,
      received: result.received,
      balance: result.balance,
    });
  } catch (err) {
    if (err instanceof LedgerError) return fail(err.message);
    throw err;
  }
}

// ─── recompute (월 단위 일괄) ─────────────────────────────

/**
 * 특정 월에 대해 활성 거래처(active=true) 전체의 원장을 재계산.
 * 마감된 원장은 건너뛴다.
 */
export async function recomputeLedgerMonth(
  input: RecomputeLedgerMonthInput,
): Promise<ActionResult<{ closingMonth: string; updated: number; skipped: number }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = recomputeLedgerMonthSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { closingMonth } = parsed.data;

  const clients = await prisma.client.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const c of clients) {
    // 각 거래처별로 독립 트랜잭션 (한 건 실패가 전체를 막지 않도록).
    try {
      const r = await recomputeLedger({
        clientId: c.id,
        closingMonth,
      });
      if (r.ok) updated++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "LEDGER_RECOMPUTE_MONTH",
    resource: `ClosingLedger:${closingMonth}`,
    metadata: { closingMonth, updated, skipped, totalClients: clients.length },
  });

  revalidatePath("/admin/ledger");
  return ok({ closingMonth, updated, skipped });
}

// ─── 마감 ─────────────────────────────────────────────────

export async function closeMonth(
  input: CloseMonthInput,
): Promise<ActionResult<{ clientId: string; closingMonth: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = closeMonthSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { clientId, closingMonth, note } = parsed.data;

  try {
    const cur = await prisma.closingLedger.findUnique({
      where: { clientId_closingMonth: { clientId, closingMonth } },
      select: { id: true, closedAt: true, note: true },
    });
    if (!cur)
      throw new LedgerError(
        "원장이 없습니다. 먼저 재계산(recompute) 하세요.",
      );
    if (cur.closedAt) throw new LedgerError("이미 마감된 원장입니다.");

    await prisma.closingLedger.update({
      where: { clientId_closingMonth: { clientId, closingMonth } },
      data: {
        closedAt: new Date(),
        note: note ?? cur.note ?? null,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "LEDGER_CLOSE",
      resource: `ClosingLedger:${clientId}:${closingMonth}`,
      metadata: { clientId, closingMonth, note },
    });

    revalidatePath("/admin/ledger");
    revalidatePath(`/admin/clients/${clientId}`);
    return ok({ clientId, closingMonth });
  } catch (err) {
    if (err instanceof LedgerError) return fail(err.message);
    throw err;
  }
}

export async function reopenMonth(
  input: ReopenMonthInput,
): Promise<ActionResult<{ clientId: string; closingMonth: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = reopenMonthSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { clientId, closingMonth, reason } = parsed.data;

  try {
    const cur = await prisma.closingLedger.findUnique({
      where: { clientId_closingMonth: { clientId, closingMonth } },
      select: { id: true, closedAt: true, note: true },
    });
    if (!cur) throw new LedgerError("원장이 없습니다.");
    if (!cur.closedAt) throw new LedgerError("마감되지 않은 원장입니다.");

    await prisma.closingLedger.update({
      where: { clientId_closingMonth: { clientId, closingMonth } },
      data: {
        closedAt: null,
        note: cur.note
          ? `${cur.note}\n[재개] ${reason}`
          : `[재개] ${reason}`,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "LEDGER_REOPEN",
      resource: `ClosingLedger:${clientId}:${closingMonth}`,
      metadata: { clientId, closingMonth, reason },
    });

    revalidatePath("/admin/ledger");
    revalidatePath(`/admin/clients/${clientId}`);
    return ok({ clientId, closingMonth });
  } catch (err) {
    if (err instanceof LedgerError) return fail(err.message);
    throw err;
  }
}
