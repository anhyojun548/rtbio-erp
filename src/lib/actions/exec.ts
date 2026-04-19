/**
 * 영업 포털(Exec) Server Actions — Phase 3F-1 (R11, R15 일부).
 *
 * 영업(EXEC) 롤은 본인에게 배정된 거래처/주문만 볼 수 있다 (row-level 필터).
 * 두 가지 배정 소스를 OR 로 합쳐 본다:
 *   1) Client.salesRepId == me.id (주 담당자 — 1:1 링크)
 *   2) SalesAssignment { salesRepId: me.id, active: true } — 복수 배정 확장
 *
 * TENANT_OWNER/ADMIN 은 모든 거래처를 볼 수 있어야 하므로,
 *   - `opts.forUserId` 가 전달되면 해당 유저 기준으로 제한(관리자가 영업사원 대리 조회)
 *   - 미전달이면 현재 로그인 사용자(EXEC) 기준
 *
 * RBAC: TENANT_OWNER / ADMIN / EXEC.
 */
"use server";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

// 본인 거래처 ID 목록 — 서버 사이드 조합 쿼리에서 공통으로 쓴다.
async function getMyClientIds(salesRepId: string): Promise<string[]> {
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

/**
 * 본인(또는 대리 지정된 영업사원)의 거래처 목록.
 *
 * 반환: client + 최근 주문일 + 월간 매출(현재 달 ISSUED+SENT 합).
 */
export async function listMyClients(opts?: { forUserId?: string }) {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const salesRepId = opts?.forUserId ?? user.id;

  const ids = await getMyClientIds(salesRepId);
  if (ids.length === 0) return [];

  // 이번 달 [월초, 다음달초)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const clients = await prisma.client.findMany({
    where: { id: { in: ids } },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { orders: true, addresses: { where: { active: true } } } },
      orders: {
        select: { id: true, orderNumber: true, orderDate: true, status: true },
        orderBy: { orderDate: "desc" },
        take: 1,
      },
      invoices: {
        where: {
          issueDate: { gte: monthStart, lt: nextMonth },
          status: { in: ["ISSUED", "SENT"] },
        },
        select: { totalAmount: true },
      },
    },
  });

  return clients.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    type: c.type,
    phone: c.phone,
    representative: c.representative,
    addressCount: c._count.addresses,
    orderCount: c._count.orders,
    lastOrder: c.orders[0]
      ? {
          id: c.orders[0].id,
          orderNumber: c.orders[0].orderNumber,
          orderDate: c.orders[0].orderDate,
          status: c.orders[0].status,
        }
      : null,
    thisMonthSales: c.invoices.reduce(
      (s, inv) => s + Number(inv.totalAmount),
      0,
    ),
  }));
}

/**
 * 본인의 주문 현황(요약) — 상태별 집계 + 최근 주문 Top N.
 */
export async function getMyOrderSummary(opts?: {
  forUserId?: string;
  recentLimit?: number;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const salesRepId = opts?.forUserId ?? user.id;
  const recentLimit = opts?.recentLimit ?? 10;

  const ids = await getMyClientIds(salesRepId);
  if (ids.length === 0) {
    return {
      byStatus: {} as Record<OrderStatus, number>,
      total: 0,
      recent: [],
    };
  }

  const [grouped, recent, total] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { clientId: { in: ids } },
      _count: { status: true },
    }),
    prisma.order.findMany({
      where: { clientId: { in: ids } },
      orderBy: { createdAt: "desc" },
      take: recentLimit,
      include: {
        client: { select: { id: true, code: true, name: true } },
        items: { select: { lineTotal: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where: { clientId: { in: ids } } }),
  ]);

  const byStatus = {} as Record<OrderStatus, number>;
  for (const g of grouped) byStatus[g.status] = g._count.status;

  return {
    byStatus,
    total,
    recent: recent.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      status: o.status,
      client: o.client,
      itemCount: o._count.items,
      totalAmount: o.items.reduce(
        (s, it) => s + Number(it.lineTotal ?? 0),
        0,
      ),
    })),
  };
}

/**
 * 본인 거래처 매출 지표 — Top 10 거래처 (이번 달 · 지난달 비교용).
 *
 * reportable month 기본값: 현재 달.
 */
export async function getMyTopClientsByMonth(opts?: {
  forUserId?: string;
  month?: string; // "YYYY-MM"
  limit?: number;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const salesRepId = opts?.forUserId ?? user.id;
  const limit = opts?.limit ?? 10;

  const ids = await getMyClientIds(salesRepId);
  if (ids.length === 0) return [];

  let start: Date, end: Date;
  if (opts?.month) {
    const [y, m] = opts.month.split("-").map(Number);
    start = new Date(y!, (m ?? 1) - 1, 1);
    end = new Date(y!, m!, 1);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      clientId: { in: ids },
      issueDate: { gte: start, lt: end },
      status: { in: ["ISSUED", "SENT"] },
    },
    include: { client: { select: { id: true, code: true, name: true } } },
  });

  const byClient = new Map<
    string,
    { id: string; code: string; name: string; count: number; total: number }
  >();
  for (const inv of invoices) {
    const k = inv.clientId;
    const cur = byClient.get(k) ?? {
      id: inv.client.id,
      code: inv.client.code,
      name: inv.client.name,
      count: 0,
      total: 0,
    };
    cur.count += 1;
    cur.total += Number(inv.totalAmount);
    byClient.set(k, cur);
  }

  return [...byClient.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/**
 * 본인의 주문 목록 — 필터 적용 가능. (`/exec/orders` 용)
 */
export async function listMyOrders(opts?: {
  forUserId?: string;
  q?: string;
  status?: OrderStatus | "ALL";
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const salesRepId = opts?.forUserId ?? user.id;

  const ids = await getMyClientIds(salesRepId);
  if (ids.length === 0) return [];

  const where: Prisma.OrderWhereInput = { clientId: { in: ids } };
  if (opts?.status && opts.status !== "ALL") where.status = opts.status;
  if (opts?.from || opts?.to) {
    where.orderDate = {};
    if (opts.from) where.orderDate.gte = opts.from;
    if (opts.to) where.orderDate.lte = opts.to;
  }
  if (opts?.q && opts.q.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { client: { code: { contains: q, mode: "insensitive" } } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: opts?.limit ?? 200,
    include: {
      client: { select: { id: true, code: true, name: true } },
      items: { select: { lineTotal: true } },
      _count: { select: { items: true } },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    orderDate: o.orderDate,
    status: o.status,
    client: o.client,
    shipToLabel: o.shipToLabel,
    shipToRecipient: o.shipToRecipient,
    itemCount: o._count.items,
    totalAmount: o.items.reduce(
      (s, it) => s + Number(it.lineTotal ?? 0),
      0,
    ),
  }));
}
