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

// ---------------------------------------------------------------------------
// 발주 등록 (CLIENT 본인 → 신규 SUBMITTED Order)
// ---------------------------------------------------------------------------

import { calculatePriceSnapshot } from "@/lib/pricing";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type CreateClientOrderInput = {
  items: Array<{
    productId: string;        // DB Product.id (이미 사이즈별 분리된 실 productId)
    productSizeId: string;    // DB ProductSize.id
    qty: number;
  }>;
  shipTo: {
    addressId?: string | null;
    label?: string | null;
    recipient?: string | null;
    phone?: string | null;
    postalCode?: string | null;
    address: string;
    addressDetail?: string | null;
    memo?: string | null;
  };
  shippingMethod?: string | null; // '택배' | '방문수령' | '퀵'
  notes?: string | null;
};

/**
 * CLIENT 본인이 발주를 등록한다.
 *
 * - status=SUBMITTED 로 바로 생성 (DRAFT 단계 생략 — CLIENT 는 미리저장 개념 없음)
 * - orderNumber 즉시 채번 (advisory lock — admin submitOrder 와 동일 패턴)
 * - 가격은 pricing.ts (고정가 > 할인 > 기본가) 로 스냅샷 저장
 * - 배송지는 ClientAddress 참조 또는 임시주소 스냅샷
 * - billingMonth = 발주월 (R12 — 마감 규칙)
 *
 * 검증:
 *  - items 1건 이상, 각 item.productId/productSizeId 가 본인 거래처 결제 가능 active 제품인지
 *  - shipTo.address 필수
 */
export async function createClientOrder(input: CreateClientOrderInput) {
  const user = await requireClient();
  const clientId = user.clientId;

  // 1) 입력 검증
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("주문할 제품을 1개 이상 선택해주세요.");
  }
  if (!input.shipTo || !input.shipTo.address) {
    throw new Error("배송지 주소가 필요합니다.");
  }
  for (const it of input.items) {
    if (!it.productId || !it.productSizeId) {
      throw new Error("제품 정보가 올바르지 않습니다.");
    }
    if (!Number.isFinite(it.qty) || it.qty <= 0) {
      throw new Error("주문 수량은 1 이상이어야 합니다.");
    }
  }

  // 2) 제품 + 사이즈 + 가격 정책 조회 (한 번에)
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const sizeIds = [...new Set(input.items.map((i) => i.productSizeId))];

  const [products, sizes, discounts, fixedPrices] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      select: { id: true, category: true, basePrice: true, name: true },
    }),
    prisma.productSize.findMany({
      where: { id: { in: sizeIds } },
      select: { id: true, productId: true, sizeCode: true },
    }),
    prisma.clientDiscount.findMany({
      where: { clientId },
      select: { category: true, discountRate: true },
    }),
    prisma.clientFixedPrice.findMany({
      where: { clientId, productId: { in: productIds } },
      select: { productId: true, fixedPrice: true },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const sizeMap = new Map(sizes.map((s) => [s.id, s]));
  const fixedMap = new Map(fixedPrices.map((f) => [f.productId, f.fixedPrice]));

  // 라인 검증 + 가격 스냅샷 계산
  type LineDraft = {
    productId: string;
    productSizeId: string;
    quantity: number;
    unitPrice: number;
    basePriceAtOrder: number;
    discountRateAtOrder: number | null;
    fixedPriceAppliedAtOrder: boolean;
    lineTotal: number;
  };
  const lines: LineDraft[] = [];
  for (const it of input.items) {
    const p = productMap.get(it.productId);
    if (!p) throw new Error(`존재하지 않거나 비활성 제품입니다: ${it.productId}`);
    const s = sizeMap.get(it.productSizeId);
    if (!s) throw new Error(`존재하지 않는 사이즈입니다: ${it.productSizeId}`);
    if (s.productId !== p.id) throw new Error(`사이즈가 제품과 일치하지 않습니다.`);

    const snap = calculatePriceSnapshot({
      basePrice: p.basePrice,
      category: p.category ?? null,
      clientDiscounts: discounts.map((d) => ({
        category: d.category,
        discountRate: d.discountRate,
      })),
      clientFixedPrice: fixedMap.get(p.id) ?? null,
    });

    const unitPriceN = Number(snap.unitPrice);
    lines.push({
      productId: p.id,
      productSizeId: s.id,
      quantity: it.qty,
      unitPrice: unitPriceN,
      basePriceAtOrder: Number(snap.basePriceAtOrder),
      discountRateAtOrder:
        snap.discountRateAtOrder == null ? null : Number(snap.discountRateAtOrder),
      fixedPriceAppliedAtOrder: snap.fixedPriceAppliedAtOrder,
      lineTotal: Math.round(unitPriceN * it.qty),
    });
  }

  // 3) 배송지 스냅샷
  const shipTo = input.shipTo;
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;

  // 4) 트랜잭션: orderNumber 채번 + Order + OrderItem
  const result = await prisma.$transaction(async (tx) => {
    // 4-a) orderNumber 채번 (admin submitOrder 와 동일 advisory lock 패턴)
    const y = now.getFullYear();
    const m = `${now.getMonth() + 1}`.padStart(2, "0");
    const d = `${now.getDate()}`.padStart(2, "0");
    const prefix = `ORD-${y}${m}${d}-`;
    const lockKey = Number(`${y}${m}${d}`);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
    const rows = await tx.$queryRaw<{ orderNumber: string }[]>`
      SELECT "orderNumber" FROM "tenant_altibio"."Order"
      WHERE "orderNumber" LIKE ${prefix + "%"}
      ORDER BY "orderNumber" DESC
      LIMIT 1
    `;
    let nextSeq = 1;
    if (rows[0]) {
      const tail = rows[0].orderNumber.slice(prefix.length);
      const parsed = Number.parseInt(tail, 10);
      if (Number.isFinite(parsed)) nextSeq = parsed + 1;
    }
    const orderNumber = `${prefix}${String(nextSeq).padStart(3, "0")}`;

    // 4-b) Order 생성 (SUBMITTED 즉시)
    const order = await tx.order.create({
      data: {
        orderNumber,
        clientId,
        status: "SUBMITTED",
        orderDate: now,
        billingMonth,
        note: input.notes ?? null,
        shipToAddressId: shipTo.addressId ?? null,
        shipToLabel: shipTo.label ?? null,
        shipToRecipient: shipTo.recipient ?? null,
        shipToPhone: shipTo.phone ?? null,
        shipToPostalCode: shipTo.postalCode ?? null,
        shipToAddress: shipTo.address,
        shipToAddressDetail: shipTo.addressDetail ?? null,
        shipToMemo: shipTo.memo ?? null,
      },
    });

    // 4-c) OrderItem 일괄 생성
    await tx.orderItem.createMany({
      data: lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        productSizeId: l.productSizeId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        basePriceAtOrder: l.basePriceAtOrder,
        discountRateAtOrder: l.discountRateAtOrder,
        fixedPriceAppliedAtOrder: l.fixedPriceAppliedAtOrder,
        lineTotal: l.lineTotal,
      })),
    });

    // 4-d) 갱신된 Order (items 포함) 반환
    return tx.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });
  });

  if (!result) throw new Error("발주 생성에 실패했습니다.");

  // 5) 감사 로그 + 캐시 무효화
  await logAudit({
    action: "CLIENT_ORDER_CREATE",
    resource: `Order:${result.id}`,
    metadata: { orderNumber: result.orderNumber, itemsCount: lines.length, clientId },
  });
  revalidatePath("/admin/orders");
  revalidatePath("/client");

  return result;
}
