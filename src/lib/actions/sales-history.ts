/**
 * 기간별 영업 이력서(Sales History) Server Actions — Phase 3G-3 (R21).
 *
 * 주어진 담당자(salesRepId) × 기간(from, to) 에 대해:
 *   - ORDER_CREATED     : 담당자의 거래처 기준 Order.createdAt
 *   - INVOICE_ISSUED    : Invoice.issueDate 가 범위 내, status ∈ ISSUED/SENT
 *   - PAYMENT_RECEIVED  : Payment.paidAt 가 범위 내, status ∈ PARTIAL/PAID
 *   - CONFERENCE_VISITOR: ConferenceVisitor.createdAt (assignedRepId 기준)
 *
 * 반환: 요약 스탯 카드(summary) + 거래처별 breakdown + 이벤트 타임라인.
 *
 * RBAC:
 *   - TENANT_OWNER/ADMIN: 모든 담당자 조회 가능
 *   - EXEC: 본인(me.id) 만 조회 가능 — salesRepId != me.id 면 에러
 */
"use server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  dateRangeToWindow,
  type SalesEventType,
} from "@/lib/validators/sales-history";

// ─── 공통: 담당자 → 거래처 ID 셋 ───────────────────────────
async function getClientIdsForRep(salesRepId: string): Promise<string[]> {
  const [direct, assigned] = await Promise.all([
    prisma.client.findMany({
      where: { salesRepId },
      select: { id: true },
    }),
    prisma.salesAssignment.findMany({
      where: { salesRepId, active: true },
      select: { clientId: true },
    }),
  ]);
  const set = new Set<string>();
  for (const c of direct) set.add(c.id);
  for (const a of assigned) set.add(a.clientId);
  return [...set];
}

export type SalesEvent = {
  type: SalesEventType;
  occurredAt: Date;
  refId: string;
  clientId: string | null;
  clientName: string;
  title: string;
  amount: number | null;
  meta?: Record<string, string | number | null>;
};

export type SalesHistorySummary = {
  salesRepId: string;
  from: Date;
  to: Date;
  totals: {
    orders: { count: number; amount: number };
    invoices: { count: number; amount: number };
    payments: { count: number; amount: number };
    visitors: { count: number };
  };
  byClient: Array<{
    clientId: string;
    clientName: string;
    clientCode: string;
    orders: number;
    invoiceAmount: number;
    paymentAmount: number;
    visitors: number;
  }>;
  events: SalesEvent[]; // occurredAt desc
};

/**
 * 세션 우회용 순수 집계 — smoke/테스트에서 직접 호출.
 */
export async function computeSalesHistory(opts: {
  salesRepId: string;
  from: Date;
  to: Date;
}): Promise<SalesHistorySummary> {
  const { salesRepId } = opts;
  const { start, end } = dateRangeToWindow(opts.from, opts.to);

  const clientIds = await getClientIdsForRep(salesRepId);
  const clientIdIn = clientIds.length > 0 ? clientIds : ["__none__"];

  // 거래처 프로필 맵 (byClient 행 이름 표시용)
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIdIn } },
    select: { id: true, name: true, code: true },
  });
  const clientById = new Map(clients.map((c) => [c.id, c]));

  // ─── 1) ORDER_CREATED ────────────────────────────────
  const orders = await prisma.order.findMany({
    where: {
      clientId: { in: clientIdIn },
      createdAt: { gte: start, lt: end },
    },
    include: {
      items: { select: { lineTotal: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ─── 2) INVOICE_ISSUED ──────────────────────────────
  const invoices = await prisma.invoice.findMany({
    where: {
      clientId: { in: clientIdIn },
      status: { in: ["ISSUED", "SENT"] },
      issueDate: { gte: start, lt: end },
    },
    orderBy: { issueDate: "desc" },
  });

  // ─── 3) PAYMENT_RECEIVED ────────────────────────────
  const payments = await prisma.payment.findMany({
    where: {
      clientId: { in: clientIdIn },
      status: { in: ["PARTIAL", "PAID"] },
      paidAt: { gte: start, lt: end },
    },
    orderBy: { paidAt: "desc" },
  });

  // ─── 4) CONFERENCE_VISITOR ──────────────────────────
  const visitors = await prisma.conferenceVisitor.findMany({
    where: {
      assignedRepId: salesRepId,
      createdAt: { gte: start, lt: end },
    },
    include: {
      conference: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ─── 집계 ────────────────────────────────────────────
  const byClient = new Map<
    string,
    {
      orders: number;
      invoiceAmount: number;
      paymentAmount: number;
      visitors: number;
    }
  >();
  const ensure = (id: string) => {
    if (!byClient.has(id)) {
      byClient.set(id, {
        orders: 0,
        invoiceAmount: 0,
        paymentAmount: 0,
        visitors: 0,
      });
    }
    return byClient.get(id)!;
  };

  let orderTotalAmount = 0;
  for (const o of orders) {
    const amt = o.items.reduce(
      (s, it) => s + Number(it.lineTotal ?? 0),
      0,
    );
    orderTotalAmount += amt;
    ensure(o.clientId).orders += 1;
  }

  let invoiceTotalAmount = 0;
  for (const inv of invoices) {
    const amt = Number(inv.totalAmount);
    invoiceTotalAmount += amt;
    ensure(inv.clientId).invoiceAmount += amt;
  }

  let paymentTotalAmount = 0;
  for (const p of payments) {
    const amt = Number(p.amount);
    paymentTotalAmount += amt;
    ensure(p.clientId).paymentAmount += amt;
  }

  // visitors 는 clientId 가 없으므로 학회 단위로만 카운트 (byClient 에 반영 불가)
  // 전체 totals.visitors 와 timeline 에는 포함.

  // ─── 타임라인 이벤트 평탄화 ──────────────────────────
  const events: SalesEvent[] = [];
  for (const o of orders) {
    const amt = o.items.reduce(
      (s, it) => s + Number(it.lineTotal ?? 0),
      0,
    );
    events.push({
      type: "ORDER_CREATED",
      occurredAt: o.createdAt,
      refId: o.id,
      clientId: o.clientId,
      clientName: clientById.get(o.clientId)?.name ?? "(알 수 없음)",
      title: o.orderNumber,
      amount: amt,
      meta: { status: o.status },
    });
  }
  for (const inv of invoices) {
    events.push({
      type: "INVOICE_ISSUED",
      occurredAt: inv.issueDate ?? inv.createdAt,
      refId: inv.id,
      clientId: inv.clientId,
      clientName: clientById.get(inv.clientId)?.name ?? "(알 수 없음)",
      title: inv.invoiceNumber ?? "(번호 미지정)",
      amount: Number(inv.totalAmount),
      meta: { status: inv.status },
    });
  }
  for (const p of payments) {
    events.push({
      type: "PAYMENT_RECEIVED",
      occurredAt: p.paidAt,
      refId: p.id,
      clientId: p.clientId,
      clientName: clientById.get(p.clientId)?.name ?? "(알 수 없음)",
      title: p.method ?? "",
      amount: Number(p.amount),
      meta: { status: p.status },
    });
  }
  for (const v of visitors) {
    events.push({
      type: "CONFERENCE_VISITOR",
      occurredAt: v.createdAt,
      refId: v.id,
      clientId: null,
      clientName: v.conference.name,
      title: v.name,
      amount: null,
      meta: {
        contactStatus: v.contactStatus,
        affiliation: v.affiliation ?? null,
      },
    });
  }
  events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return {
    salesRepId,
    from: start,
    to: end,
    totals: {
      orders: { count: orders.length, amount: orderTotalAmount },
      invoices: { count: invoices.length, amount: invoiceTotalAmount },
      payments: { count: payments.length, amount: paymentTotalAmount },
      visitors: { count: visitors.length },
    },
    byClient: Array.from(byClient.entries())
      .map(([clientId, v]) => {
        const c = clientById.get(clientId);
        return {
          clientId,
          clientName: c?.name ?? "(알 수 없음)",
          clientCode: c?.code ?? "",
          orders: v.orders,
          invoiceAmount: v.invoiceAmount,
          paymentAmount: v.paymentAmount,
          visitors: v.visitors,
        };
      })
      .sort((a, b) => b.invoiceAmount - a.invoiceAmount),
    events,
  };
}

/**
 * 세션 게이트 버전.
 *   - TENANT_OWNER/ADMIN: 임의 salesRepId 조회 가능
 *   - EXEC: 본인만 조회 가능
 */
export async function getSalesHistory(opts: {
  salesRepId: string;
  from: Date;
  to: Date;
}): Promise<SalesHistorySummary> {
  const me = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  if (
    me.role === "EXEC" &&
    opts.salesRepId !== me.id
  ) {
    throw new Error("본인의 이력만 조회할 수 있습니다.");
  }
  return computeSalesHistory(opts);
}

/**
 * 조회 가능한 담당자 목록.
 *   - TENANT_OWNER/ADMIN: 전체 활성 EXEC/ADMIN/TENANT_OWNER
 *   - EXEC: 본인만
 */
export async function listAssignableSalesReps() {
  const me = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  if (me.role === "EXEC") {
    const self = await prisma.user.findUnique({
      where: { id: me.id },
      select: { id: true, name: true, email: true, role: true },
    });
    return self ? [self] : [];
  }
  return prisma.user.findMany({
    where: {
      active: true,
      role: { in: ["EXEC", "ADMIN", "TENANT_OWNER"] },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

