/**
 * 월간 보고서(Monthly Report) Server Actions — Phase 3D-4c (R16).
 *
 * 하나의 `closingMonth`(YYYY-MM) 를 입력받아 다음을 집계:
 *   1. Invoice 통계   — status 별 건수 · totalAmount 합 · (issueDate 기준 [월초, 다음달초))
 *   2. Payment 통계   — status 별 건수 · amount 합 · (paidAt 기준 동일 범위)
 *   3. Shipment 통계  — 완료된 Shipment 수 · 라인 수량/금액 합 · (completedAt 기준)
 *   4. 거래처별 매출 Top 10 — ISSUED/SENT invoice.totalAmount 합 desc
 *   5. 원장 요약     — listLedgers(closingMonth) 기반 carry/sales/received/balance 합계
 *
 * 모든 값은 plain-JS 숫자로 반환 (Decimal → Number). UI 에서 toLocaleString.
 *
 * RBAC: TENANT_OWNER / ADMIN (CEO 는 아직 UserRole enum 미정의).
 */
"use server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { monthToRange, prevMonth } from "@/lib/validators/ledger";

export type MonthlyReport = {
  closingMonth: string;
  range: { start: string; end: string };
  invoices: {
    total: number; // 전체 건수 (CANCELLED 제외)
    totalAmount: number;
    byStatus: Record<"DRAFT" | "ISSUED" | "SENT" | "CANCELLED", {
      count: number;
      amount: number;
    }>;
  };
  payments: {
    total: number; // 집계 대상 건수 (PENDING 제외)
    totalAmount: number;
    byStatus: Record<"PENDING" | "PARTIAL" | "PAID" | "OVERDUE", {
      count: number;
      amount: number;
    }>;
  };
  shipments: {
    completed: number;
    totalQty: number;
    totalAmount: number;
  };
  topClients: Array<{
    clientId: string;
    clientCode: string;
    clientName: string;
    invoiceCount: number;
    totalAmount: number;
  }>;
  ledgerSummary: {
    clients: number;
    closed: number;
    carryOver: number;
    monthlySales: number;
    received: number;
    balance: number;
  };
};

type InvStatus = "DRAFT" | "ISSUED" | "SENT" | "CANCELLED";
type PayStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

export async function getMonthlyReport(
  closingMonth: string,
): Promise<MonthlyReport> {
  await requireRole("TENANT_OWNER", "ADMIN");
  return computeMonthlyReport(closingMonth);
}

/**
 * 세션 우회용 순수 집계 함수 — smoke/test 에서 직접 호출.
 * (requireRole 없음)
 */
export async function computeMonthlyReport(
  closingMonth: string,
): Promise<MonthlyReport> {
  const { start, end } = monthToRange(closingMonth);

  const [invoices, payments, shipments, ledgers] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        issueDate: { gte: start, lt: end },
      },
      select: {
        status: true,
        totalAmount: true,
        clientId: true,
        client: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.payment.findMany({
      where: {
        paidAt: { gte: start, lt: end },
      },
      select: { status: true, amount: true },
    }),
    prisma.shipment.findMany({
      where: {
        completedAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        order: {
          select: {
            items: {
              select: { quantity: true, lineTotal: true },
            },
          },
        },
      },
    }),
    prisma.closingLedger.findMany({
      where: { closingMonth },
      select: {
        clientId: true,
        carryOver: true,
        monthlySales: true,
        received: true,
        balance: true,
        closedAt: true,
      },
    }),
  ]);

  // ─── 1. Invoice 집계 ─────────────────────────────
  const invByStatus: Record<InvStatus, { count: number; amount: number }> = {
    DRAFT: { count: 0, amount: 0 },
    ISSUED: { count: 0, amount: 0 },
    SENT: { count: 0, amount: 0 },
    CANCELLED: { count: 0, amount: 0 },
  };
  let invTotal = 0;
  let invTotalAmount = 0;
  for (const v of invoices) {
    const s = v.status as InvStatus;
    const amt = Number(v.totalAmount ?? 0);
    invByStatus[s].count += 1;
    invByStatus[s].amount += amt;
    // total 은 "확정된 매출" — ISSUED + SENT 만 (DRAFT·CANCELLED 제외)
    if (s === "ISSUED" || s === "SENT") {
      invTotal += 1;
      invTotalAmount += amt;
    }
  }

  // ─── 2. Payment 집계 ─────────────────────────────
  const payByStatus: Record<PayStatus, { count: number; amount: number }> = {
    PENDING: { count: 0, amount: 0 },
    PARTIAL: { count: 0, amount: 0 },
    PAID: { count: 0, amount: 0 },
    OVERDUE: { count: 0, amount: 0 },
  };
  let payTotal = 0;
  let payTotalAmount = 0;
  for (const p of payments) {
    const s = p.status as PayStatus;
    const amt = Number(p.amount ?? 0);
    payByStatus[s].count += 1;
    payByStatus[s].amount += amt;
    // ClosingLedger 정의에 맞춰 PARTIAL + PAID 만 "받은 돈" 으로 집계.
    // PENDING(취소 소프트 포함), OVERDUE 는 집계에서 제외.
    if (s === "PARTIAL" || s === "PAID") {
      payTotal += 1;
      payTotalAmount += amt;
    }
  }

  // ─── 3. Shipment 집계 ────────────────────────────
  let shipTotalQty = 0;
  let shipTotalAmount = 0;
  for (const sh of shipments) {
    for (const it of sh.order.items) {
      shipTotalQty += it.quantity;
      shipTotalAmount += Number(it.lineTotal ?? 0);
    }
  }

  // ─── 4. 거래처별 Top 10 (ISSUED/SENT 기준) ──────
  const byClient = new Map<
    string,
    {
      clientId: string;
      clientCode: string;
      clientName: string;
      invoiceCount: number;
      totalAmount: number;
    }
  >();
  for (const v of invoices) {
    if (v.status !== "ISSUED" && v.status !== "SENT") continue;
    const prev = byClient.get(v.clientId);
    const amt = Number(v.totalAmount ?? 0);
    if (prev) {
      prev.invoiceCount += 1;
      prev.totalAmount += amt;
    } else {
      byClient.set(v.clientId, {
        clientId: v.clientId,
        clientCode: v.client.code,
        clientName: v.client.name,
        invoiceCount: 1,
        totalAmount: amt,
      });
    }
  }
  const topClients = [...byClient.values()]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10);

  // ─── 5. 원장 요약 ───────────────────────────────
  let carry = 0;
  let sales = 0;
  let received = 0;
  let balance = 0;
  let closed = 0;
  for (const l of ledgers) {
    carry += Number(l.carryOver ?? 0);
    sales += Number(l.monthlySales ?? 0);
    received += Number(l.received ?? 0);
    balance += Number(l.balance ?? 0);
    if (l.closedAt) closed += 1;
  }

  return {
    closingMonth,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    invoices: {
      total: invTotal,
      totalAmount: invTotalAmount,
      byStatus: invByStatus,
    },
    payments: {
      total: payTotal,
      totalAmount: payTotalAmount,
      byStatus: payByStatus,
    },
    shipments: {
      completed: shipments.length,
      totalQty: shipTotalQty,
      totalAmount: shipTotalAmount,
    },
    topClients,
    ledgerSummary: {
      clients: ledgers.length,
      closed,
      carryOver: carry,
      monthlySales: sales,
      received,
      balance,
    },
  };
}

/**
 * 전년 동월/전월 비교용 — 두 달치를 한 번에 계산.
 */
export async function getMonthlyReportWithPrev(closingMonth: string): Promise<{
  current: MonthlyReport;
  previous: MonthlyReport;
}> {
  await requireRole("TENANT_OWNER", "ADMIN");
  const [current, previous] = await Promise.all([
    computeMonthlyReport(closingMonth),
    computeMonthlyReport(prevMonth(closingMonth)),
  ]);
  return { current, previous };
}
