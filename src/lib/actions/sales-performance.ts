/**
 * 담당자별 매출 성과(Sales Performance) Server Actions — Phase 3F-2 (R15).
 *
 * 주어진 closingMonth 기준으로:
 *   1) listSalesPerformanceByMonth
 *      - 활성 EXEC/ADMIN/TENANT_OWNER 담당자(User) 전원을 열거
 *      - 각 담당자의 "관리 거래처" = Client.salesRepId ∪ SalesAssignment{active} (exec.ts 와 동일 규칙)
 *      - 매출(Invoice ISSUED+SENT totalAmount 합)
 *      - 입금(Payment PARTIAL+PAID amount 합)
 *      - 미수금(ClosingLedger.balance 합, 해당 월)
 *      - 주문 건수(Order.createdAt 기준 해당 월)
 *   2) getSalesRepClientBreakdown({salesRepId, month})
 *      - 거래처별 매출/입금/미수금 — desc by 매출
 *   3) getSalesRepProductBreakdown({salesRepId, month})
 *      - OrderItem 기준 제품/카테고리별 매출 qty/금액 — desc by 금액
 *      - Order.status=COMPLETED & completedAt ∈ month 로 제한 (실 출고 기준)
 *
 * 모든 액션은 TENANT_OWNER/ADMIN 이 담당자 전원 통계를 볼 수 있게 허용.
 * EXEC 는 본인(== me.id) 기준으로만 조회 — forUserId 지정 불가.
 */
"use server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { monthToRange } from "@/lib/validators/ledger";

// ─── 공통: 담당자 거래처 ID 셋 ───────────────────────────
async function getClientIdsForRep(salesRepId: string): Promise<string[]> {
  const [direct, assigned] = await Promise.all([
    prisma.client.findMany({
      where: { salesRepId, active: true },
      select: { id: true },
    }),
    prisma.salesAssignment.findMany({
      where: { salesRepId, active: true, client: { active: true } },
      select: { clientId: true },
    }),
  ]);
  const set = new Set<string>();
  for (const c of direct) set.add(c.id);
  for (const a of assigned) set.add(a.clientId);
  return [...set];
}

export type SalesRepRow = {
  salesRepId: string;
  name: string;
  email: string;
  role: string;
  clientCount: number;
  orderCount: number; // 해당월 Order.createdAt 기준
  salesTotal: number; // Invoice ISSUED+SENT 합
  paymentTotal: number; // Payment PARTIAL+PAID 합
  outstanding: number; // ClosingLedger.balance 합
};

/**
 * 전체 담당자 × closingMonth 성과 표.
 */
export async function listSalesPerformanceByMonth(
  closingMonth: string,
): Promise<SalesRepRow[]> {
  await requireRole("TENANT_OWNER", "ADMIN");
  return computeSalesPerformance(closingMonth);
}

/**
 * 세션 우회용 순수 집계 — smoke/테스트에서 직접 호출.
 */
export async function computeSalesPerformance(
  closingMonth: string,
): Promise<SalesRepRow[]> {
  const { start, end } = monthToRange(closingMonth);

  // 영업 성과에 표시할 담당자 후보 — EXEC 롤 + 거래처 salesRep 으로 실제 지정된 유저
  const reps = await prisma.user.findMany({
    where: {
      active: true,
      OR: [
        { role: "EXEC" },
        { role: "ADMIN" },
        { role: "TENANT_OWNER" },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  const rows: SalesRepRow[] = [];
  for (const rep of reps) {
    const clientIds = await getClientIdsForRep(rep.id);
    if (clientIds.length === 0) {
      // 담당 없는 사용자는 skip (admin 중 영업 미관여자)
      continue;
    }

    const [invoices, payments, ledgers, orderCount] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          clientId: { in: clientIds },
          issueDate: { gte: start, lt: end },
          status: { in: ["ISSUED", "SENT"] },
        },
        select: { totalAmount: true },
      }),
      prisma.payment.findMany({
        where: {
          clientId: { in: clientIds },
          paidAt: { gte: start, lt: end },
          status: { in: ["PARTIAL", "PAID"] },
        },
        select: { amount: true },
      }),
      prisma.closingLedger.findMany({
        where: { clientId: { in: clientIds }, closingMonth },
        select: { balance: true },
      }),
      prisma.order.count({
        where: {
          clientId: { in: clientIds },
          createdAt: { gte: start, lt: end },
        },
      }),
    ]);

    const salesTotal = invoices.reduce(
      (s, inv) => s + Number(inv.totalAmount ?? 0),
      0,
    );
    const paymentTotal = payments.reduce(
      (s, p) => s + Number(p.amount ?? 0),
      0,
    );
    const outstanding = ledgers.reduce(
      (s, l) => s + Number(l.balance ?? 0),
      0,
    );

    rows.push({
      salesRepId: rep.id,
      name: rep.name,
      email: rep.email,
      role: rep.role,
      clientCount: clientIds.length,
      orderCount,
      salesTotal,
      paymentTotal,
      outstanding,
    });
  }

  // 기본 정렬: 매출 desc → 입금 desc → 이름
  rows.sort((a, b) => {
    if (b.salesTotal !== a.salesTotal) return b.salesTotal - a.salesTotal;
    if (b.paymentTotal !== a.paymentTotal) return b.paymentTotal - a.paymentTotal;
    return a.name.localeCompare(b.name, "ko");
  });

  return rows;
}

export type ClientBreakdownRow = {
  clientId: string;
  clientCode: string;
  clientName: string;
  type: string;
  invoiceCount: number;
  salesTotal: number;
  paymentTotal: number;
  outstanding: number;
};

/**
 * 특정 담당자의 거래처별 breakdown.
 */
export async function getSalesRepClientBreakdown(opts: {
  salesRepId: string;
  month: string;
}): Promise<ClientBreakdownRow[]> {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  return computeClientBreakdown(opts);
}

export async function computeClientBreakdown(opts: {
  salesRepId: string;
  month: string;
}): Promise<ClientBreakdownRow[]> {
  const { start, end } = monthToRange(opts.month);
  const clientIds = await getClientIdsForRep(opts.salesRepId);
  if (clientIds.length === 0) return [];

  const [clients, invoices, payments, ledgers] = await Promise.all([
    prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.invoice.findMany({
      where: {
        clientId: { in: clientIds },
        issueDate: { gte: start, lt: end },
        status: { in: ["ISSUED", "SENT"] },
      },
      select: { clientId: true, totalAmount: true },
    }),
    prisma.payment.findMany({
      where: {
        clientId: { in: clientIds },
        paidAt: { gte: start, lt: end },
        status: { in: ["PARTIAL", "PAID"] },
      },
      select: { clientId: true, amount: true },
    }),
    prisma.closingLedger.findMany({
      where: { clientId: { in: clientIds }, closingMonth: opts.month },
      select: { clientId: true, balance: true },
    }),
  ]);

  const invByClient = new Map<string, { count: number; amount: number }>();
  for (const inv of invoices) {
    const c = invByClient.get(inv.clientId) ?? { count: 0, amount: 0 };
    c.count += 1;
    c.amount += Number(inv.totalAmount ?? 0);
    invByClient.set(inv.clientId, c);
  }
  const payByClient = new Map<string, number>();
  for (const p of payments) {
    payByClient.set(
      p.clientId,
      (payByClient.get(p.clientId) ?? 0) + Number(p.amount ?? 0),
    );
  }
  const ledByClient = new Map<string, number>();
  for (const l of ledgers) {
    ledByClient.set(l.clientId, Number(l.balance ?? 0));
  }

  const rows: ClientBreakdownRow[] = clients.map((c) => {
    const inv = invByClient.get(c.id) ?? { count: 0, amount: 0 };
    return {
      clientId: c.id,
      clientCode: c.code,
      clientName: c.name,
      type: c.type,
      invoiceCount: inv.count,
      salesTotal: inv.amount,
      paymentTotal: payByClient.get(c.id) ?? 0,
      outstanding: ledByClient.get(c.id) ?? 0,
    };
  });

  rows.sort((a, b) => b.salesTotal - a.salesTotal);
  return rows;
}

export type ProductBreakdownRow = {
  productId: string;
  productCode: string;
  productName: string;
  category: string | null;
  sizeId: string;
  sizeCode: string;
  qty: number;
  amount: number;
};

/**
 * 특정 담당자의 제품/사이즈별 breakdown — 완료된 출고(Order.status=COMPLETED)의 items 기준.
 */
export async function getSalesRepProductBreakdown(opts: {
  salesRepId: string;
  month: string;
}): Promise<ProductBreakdownRow[]> {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  return computeProductBreakdown(opts);
}

export async function computeProductBreakdown(opts: {
  salesRepId: string;
  month: string;
}): Promise<ProductBreakdownRow[]> {
  const { start, end } = monthToRange(opts.month);
  const clientIds = await getClientIdsForRep(opts.salesRepId);
  if (clientIds.length === 0) return [];

  const orders = await prisma.order.findMany({
    where: {
      clientId: { in: clientIds },
      status: "COMPLETED",
      completedAt: { gte: start, lt: end },
    },
    select: {
      items: {
        select: {
          productId: true,
          productSizeId: true,
          quantity: true,
          lineTotal: true,
          product: {
            select: { id: true, code: true, name: true, category: true },
          },
          productSize: { select: { id: true, sizeCode: true } },
        },
      },
    },
  });

  const byKey = new Map<string, ProductBreakdownRow>();
  for (const o of orders) {
    for (const it of o.items) {
      const key = `${it.productId}::${it.productSizeId}`;
      const cur = byKey.get(key);
      const qty = it.quantity;
      const amt = Number(it.lineTotal ?? 0);
      if (cur) {
        cur.qty += qty;
        cur.amount += amt;
      } else {
        byKey.set(key, {
          productId: it.product.id,
          productCode: it.product.code,
          productName: it.product.name,
          category: it.product.category,
          sizeId: it.productSize.id,
          sizeCode: it.productSize.sizeCode,
          qty,
          amount: amt,
        });
      }
    }
  }

  return [...byKey.values()].sort((a, b) => b.amount - a.amount);
}
