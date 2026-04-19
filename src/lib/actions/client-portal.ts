/**
 * 거래처 포털 (Client Portal) Server Actions — Phase 3H.
 *
 * 거래처(CLIENT) 롤은 `User.clientId` 로 연결된 단 1 개의 거래처 데이터만 조회한다.
 * 모든 액션은 `requireClient()` 를 호출해 세션 검증 + clientId 를 수령한다 (row-level 필터).
 *
 * 거래처는 자기 조직의 다음 데이터만 볼 수 있다:
 *   - 본인 거래처 프로필
 *   - 본인 주문 (Order) 목록/상세
 *   - 본인 거래명세서 (Invoice) 목록/상세
 *   - 본인 수금 (Payment) 이력 + 이달 원장 (ClosingLedger)
 *   - 본인 판매 계약서 (SalesContract)
 *
 * 쓰기 액션 없음 — 읽기 전용.
 */
"use server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/session";

// ---------------------------------------------------------------------------
// 내 거래처 프로필
// ---------------------------------------------------------------------------

export async function getMyClient() {
  const user = await requireClient();
  return prisma.client.findUnique({
    where: { id: user.clientId },
    include: {
      addresses: { where: { active: true }, orderBy: { isDefault: "desc" } },
      _count: {
        select: {
          orders: true,
          invoices: true,
          payments: true,
          contracts: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 대시보드 요약
// ---------------------------------------------------------------------------

export async function getMyDashboard() {
  const user = await requireClient();
  const clientId = user.clientId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const soonEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

  const [
    openOrderCount,
    completedOrderCount,
    thisMonthInvoices,
    latestLedger,
    recentOrders,
    recentInvoices,
    expiringContracts,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        clientId,
        status: { in: ["DRAFT", "SUBMITTED", "CONFIRMED", "SHIPPING"] },
      },
    }),
    prisma.order.count({ where: { clientId, status: "COMPLETED" } }),
    prisma.invoice.findMany({
      where: {
        clientId,
        issueDate: { gte: monthStart, lt: nextMonth },
        status: { in: ["ISSUED", "SENT"] },
      },
      select: { totalAmount: true },
    }),
    prisma.closingLedger.findUnique({
      where: { clientId_closingMonth: { clientId, closingMonth: thisMonth } },
    }),
    prisma.order.findMany({
      where: { clientId },
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: {
        items: { select: { lineTotal: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { clientId, status: { in: ["ISSUED", "SENT"] } },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: { _count: { select: { items: true } } },
    }),
    prisma.salesContract.findMany({
      where: {
        clientId,
        endDate: { gte: now, lte: soonEnd },
      },
      orderBy: { endDate: "asc" },
      take: 5,
    }),
  ]);

  const thisMonthSales = thisMonthInvoices.reduce(
    (s, inv) => s + Number(inv.totalAmount),
    0,
  );
  const outstanding = latestLedger ? Number(latestLedger.balance) : 0;

  return {
    openOrderCount,
    completedOrderCount,
    thisMonthSales,
    outstanding,
    ledgerMonth: thisMonth,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      status: o.status,
      itemCount: o._count.items,
      totalAmount: o.items.reduce(
        (s, it) => s + Number(it.lineTotal ?? 0),
        0,
      ),
    })),
    recentInvoices: recentInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      status: inv.status,
      totalAmount: Number(inv.totalAmount),
      itemCount: inv._count.items,
    })),
    expiringContracts: expiringContracts.map((c) => ({
      id: c.id,
      title: c.title,
      endDate: c.endDate,
      signed: c.signed,
    })),
  };
}

// ---------------------------------------------------------------------------
// 내 주문
// ---------------------------------------------------------------------------

export async function listMyOrders(opts?: {
  q?: string;
  status?: Prisma.OrderWhereInput["status"];
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const user = await requireClient();

  const where: Prisma.OrderWhereInput = { clientId: user.clientId };
  if (opts?.status) where.status = opts.status;
  if (opts?.from || opts?.to) {
    where.orderDate = {};
    if (opts.from) where.orderDate.gte = opts.from;
    if (opts.to) where.orderDate.lte = opts.to;
  }
  if (opts?.q && opts.q.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { shipToRecipient: { contains: q, mode: "insensitive" } },
      { shipToLabel: { contains: q, mode: "insensitive" } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: opts?.limit ?? 200,
    include: {
      items: { select: { lineTotal: true } },
      _count: { select: { items: true } },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    orderDate: o.orderDate,
    status: o.status,
    shipToLabel: o.shipToLabel,
    shipToRecipient: o.shipToRecipient,
    itemCount: o._count.items,
    totalAmount: o.items.reduce(
      (s, it) => s + Number(it.lineTotal ?? 0),
      0,
    ),
  }));
}

export async function getMyOrder(orderId: string) {
  const user = await requireClient();
  return prisma.order.findFirst({
    where: { id: orderId, clientId: user.clientId },
    include: {
      items: {
        include: {
          product: { select: { code: true, name: true } },
          productSize: { select: { sizeCode: true } },
        },
      },
      shipments: {
        orderBy: { createdAt: "desc" },
        include: {
          currentStage: { select: { key: true, label: true } },
        },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          issueDate: true,
          totalAmount: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 내 거래명세서
// ---------------------------------------------------------------------------

export async function listMyInvoices(opts?: {
  q?: string;
  status?: Prisma.InvoiceWhereInput["status"];
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const user = await requireClient();

  const where: Prisma.InvoiceWhereInput = {
    clientId: user.clientId,
    // 거래처는 DRAFT 를 볼 필요 없음 (아직 발행 전)
    status: { in: ["ISSUED", "SENT", "CANCELLED"] },
  };
  if (opts?.status) where.status = opts.status;
  if (opts?.from || opts?.to) {
    where.issueDate = {};
    if (opts.from) where.issueDate.gte = opts.from;
    if (opts.to) where.issueDate.lte = opts.to;
  }
  if (opts?.q && opts.q.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
    ];
  }

  return prisma.invoice.findMany({
    where,
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: opts?.limit ?? 200,
    include: {
      order: { select: { id: true, orderNumber: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function getMyInvoice(invoiceId: string) {
  const user = await requireClient();
  // CLIENT 는 DRAFT 접근 금지
  return prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      clientId: user.clientId,
      status: { in: ["ISSUED", "SENT", "CANCELLED"] },
    },
    include: {
      items: { orderBy: { id: "asc" } },
      order: { select: { id: true, orderNumber: true, orderDate: true } },
      client: true,
    },
  });
}

// ---------------------------------------------------------------------------
// 내 수금 · 미수금
// ---------------------------------------------------------------------------

export async function listMyPayments(opts?: { limit?: number }) {
  const user = await requireClient();
  return prisma.payment.findMany({
    where: { clientId: user.clientId, status: { not: "PENDING" } },
    orderBy: { paidAt: "desc" },
    take: opts?.limit ?? 100,
  });
}

export async function listMyLedgers(opts?: { limit?: number }) {
  const user = await requireClient();
  return prisma.closingLedger.findMany({
    where: { clientId: user.clientId },
    orderBy: { closingMonth: "desc" },
    take: opts?.limit ?? 24,
  });
}

// ---------------------------------------------------------------------------
// 내 계약서
// ---------------------------------------------------------------------------

export async function listMyContracts(opts?: { q?: string; limit?: number }) {
  const user = await requireClient();

  const where: Prisma.SalesContractWhereInput = { clientId: user.clientId };
  if (opts?.q && opts.q.trim()) {
    where.title = { contains: opts.q.trim(), mode: "insensitive" };
  }

  return prisma.salesContract.findMany({
    where,
    orderBy: [{ endDate: "asc" }, { startDate: "desc" }],
    take: opts?.limit ?? 100,
  });
}

export async function getMyContract(contractId: string) {
  const user = await requireClient();
  return prisma.salesContract.findFirst({
    where: { id: contractId, clientId: user.clientId },
  });
}
