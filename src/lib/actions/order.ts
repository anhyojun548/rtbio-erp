/**
 * 주문 (Order) Server Actions — Phase 3D-2a (DRAFT 단계).
 *
 * 이번 스코프:
 * - listOrders / getOrder
 * - createOrder (DRAFT 상태 + 라인 일괄 생성)
 * - updateOrder (헤더 수정 — DRAFT 에서만)
 * - deleteOrder (DRAFT 하드 삭제 + Cascade 라인 제거)
 * - addOrderItem / updateOrderItem / deleteOrderItem (DRAFT 에서만)
 *
 * 도메인 규칙 (pricing-specialist 리뷰 반영):
 * - DRAFT 단가는 **현시점 참고값**. 확정(3D-2b) 시 재계산해 스냅샷 고정.
 *   → pricing.ts 를 호출해 `unitPrice/basePriceAtOrder/lineTotal` 을 미리 채움.
 *   → `discountRateAtOrder`, `fixedPriceAppliedAtOrder` 도 계산된 실제 값 주입.
 * - 비활성 거래처에는 신규 DRAFT 금지.
 * - 배송지 스냅샷은 DRAFT 생성/수정 시점에 찍힘 (ClientAddress 가 나중에 수정돼도 DRAFT 는 옛 값 유지).
 * - 같은 productSizeId 중복 라인 허용 (R03 엑셀형 UX).
 * - DRAFT 삭제는 하드 삭제 (OrderItem Cascade) + AuditLog.
 * - orderNumber 는 임시 `DRAFT-{cuid8}` — 3D-2b 확정 시 `ORD-YYYYMMDD-NNN` 재발급.
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  orderCreateSchema,
  orderUpdateSchema,
  orderItemCreateSchema,
  orderItemUpdateSchema,
  type OrderCreateInput,
  type OrderUpdateInput,
  type OrderItemCreateInput,
  type OrderItemUpdateInput,
} from "@/lib/validators/order";
import {
  orderSubmitSchema,
  type OrderSubmitInput,
} from "@/lib/validators/order-transition";
import { calculatePriceSnapshot } from "@/lib/pricing";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

// ─── 유틸 ─────────────────────────────────────────────────

/**
 * 임시 주문번호 — DRAFT 동안만 사용. 확정 시 재발급.
 */
function draftOrderNumber(): string {
  // cuid 스타일 짧은 토큰 (8자) — collision 현실적으로 없음
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `DRAFT-${rand}`;
}

/**
 * 거래처의 할인/고정가 로드 + 제품사이즈 + 제품 정보 한번에 → 라인별 가격 스냅샷 계산.
 */
async function computeLineFromPricing(
  tx: Prisma.TransactionClient,
  clientId: string,
  productSizeId: string,
  quantity: number,
) {
  const size = await tx.productSize.findUnique({
    where: { id: productSizeId },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          basePrice: true,
          category: true,
          active: true,
        },
      },
    },
  });
  if (!size) throw new OrderError("존재하지 않는 사이즈입니다.");
  if (!size.product.active)
    throw new OrderError("비활성 제품은 주문할 수 없습니다.");

  const [discounts, fixed] = await Promise.all([
    tx.clientDiscount.findMany({
      where: { clientId },
      select: { category: true, discountRate: true },
    }),
    tx.clientFixedPrice.findUnique({
      where: { clientId_productId: { clientId, productId: size.product.id } },
      select: { fixedPrice: true },
    }),
  ]);

  const snap = calculatePriceSnapshot({
    basePrice: size.product.basePrice,
    category: size.product.category,
    clientDiscounts: discounts.map((d) => ({
      category: d.category,
      discountRate: d.discountRate,
    })),
    clientFixedPrice: fixed?.fixedPrice ?? null,
  });

  const unitPrice = new Prisma.Decimal(Number(snap.unitPrice).toFixed(2));
  const basePriceAtOrder = new Prisma.Decimal(
    Number(snap.basePriceAtOrder).toFixed(2),
  );
  const discountRateAtOrder =
    snap.discountRateAtOrder === null
      ? null
      : new Prisma.Decimal(Number(snap.discountRateAtOrder).toFixed(4));
  const lineTotal = unitPrice.mul(quantity);

  return {
    productId: size.product.id,
    productSizeId: size.id,
    quantity,
    unitPrice,
    basePriceAtOrder,
    discountRateAtOrder,
    fixedPriceAppliedAtOrder: snap.fixedPriceAppliedAtOrder,
    lineTotal,
  };
}

/**
 * shipToAddressId 제공 시 ClientAddress 스냅샷을 덮어씀.
 * 해당 주소가 다른 거래처 소유면 거부.
 */
async function resolveShipToSnapshot(
  tx: Prisma.TransactionClient,
  clientId: string,
  input: {
    shipToAddressId?: string;
    shipToLabel?: string;
    shipToRecipient?: string;
    shipToPhone?: string;
    shipToPostalCode?: string;
    shipToAddress?: string;
    shipToAddressDetail?: string;
    shipToMemo?: string;
    shipMethod?: string;
  },
) {
  if (!input.shipToAddressId) {
    // 임시주소 — 사용자 입력 그대로
    return {
      shipToAddressId: null,
      shipToLabel: input.shipToLabel ?? null,
      shipToRecipient: input.shipToRecipient ?? null,
      shipToPhone: input.shipToPhone ?? null,
      shipToPostalCode: input.shipToPostalCode ?? null,
      shipToAddress: input.shipToAddress ?? null,
      shipToAddressDetail: input.shipToAddressDetail ?? null,
      shipToMemo: input.shipToMemo ?? null,
      shipMethod: input.shipMethod ?? null,
    };
  }

  const addr = await tx.clientAddress.findUnique({
    where: { id: input.shipToAddressId },
  });
  if (!addr) throw new OrderError("존재하지 않는 배송지입니다.");
  if (addr.clientId !== clientId)
    throw new OrderError("배송지가 해당 거래처에 속하지 않습니다.");

  return {
    shipToAddressId: addr.id,
    shipToLabel: addr.label,
    shipToRecipient: addr.recipientName,
    shipToPhone: addr.phone,
    shipToPostalCode: addr.postalCode,
    shipToAddress: addr.address,
    shipToAddressDetail: addr.addressDetail,
    shipToMemo: input.shipToMemo ?? addr.memo ?? null, // 주문별 메모가 우선
    shipMethod: input.shipMethod ?? null,
  };
}

function assertDraft(status: OrderStatus): void {
  if (status !== "DRAFT")
    throw new OrderError(
      `DRAFT 상태에서만 편집 가능합니다 (현재: ${status}).`,
    );
}

// ─── 조회 ─────────────────────────────────────────────────

export type OrderListFilter = {
  q?: string; // orderNumber / 거래처명
  clientId?: string;
  status?: OrderStatus | "ALL";
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function listOrders(filter: OrderListFilter = {}) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const where: Prisma.OrderWhereInput = {};
  if (filter.clientId) where.clientId = filter.clientId;
  if (filter.status && filter.status !== "ALL") where.status = filter.status;
  if (filter.from || filter.to) {
    where.orderDate = {};
    if (filter.from) where.orderDate.gte = filter.from;
    if (filter.to) where.orderDate.lte = filter.to;
  }
  if (filter.q && filter.q.trim()) {
    const q = filter.q.trim();
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { client: { code: { contains: q, mode: "insensitive" } } },
    ];
  }

  return prisma.order.findMany({
    where,
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: filter.limit ?? 200,
    include: {
      client: { select: { id: true, code: true, name: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function getOrder(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  return prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      items: {
        include: {
          product: { select: { id: true, code: true, name: true, category: true } },
          productSize: { select: { id: true, sizeCode: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// ─── 생성/수정/삭제 (DRAFT 헤더 + 라인) ────────────────────

export async function createOrder(
  input: OrderCreateInput,
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = orderCreateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 거래처 검증
      const client = await tx.client.findUnique({ where: { id: data.clientId } });
      if (!client) throw new OrderError("존재하지 않는 거래처입니다.");
      if (!client.active)
        throw new OrderError("비활성 거래처에는 주문을 생성할 수 없습니다.");

      // 배송지 스냅샷
      const shipTo = await resolveShipToSnapshot(tx, data.clientId, data);

      // 라인 계산
      const linesData: Array<Awaited<ReturnType<typeof computeLineFromPricing>>> =
        [];
      for (const it of data.items) {
        linesData.push(
          await computeLineFromPricing(
            tx,
            data.clientId,
            it.productSizeId,
            it.quantity,
          ),
        );
      }

      // Order + items 일괄 생성
      const created = await tx.order.create({
        data: {
          orderNumber: draftOrderNumber(),
          clientId: data.clientId,
          status: "DRAFT",
          orderDate: data.orderDate,
          requestedDate: data.requestedDate ?? null,
          note: data.note ?? null,
          ...shipTo,
          createdBy: user.id,
          items: {
            create: linesData.map((l) => ({
              productId: l.productId,
              productSizeId: l.productSizeId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              basePriceAtOrder: l.basePriceAtOrder,
              discountRateAtOrder: l.discountRateAtOrder,
              fixedPriceAppliedAtOrder: l.fixedPriceAppliedAtOrder,
              lineTotal: l.lineTotal,
            })),
          },
        },
        select: { id: true, orderNumber: true, clientId: true },
      });

      return { ...created, itemCount: linesData.length };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ORDER_CREATE_DRAFT",
      resource: `Order:${result.id}`,
      metadata: {
        orderNumber: result.orderNumber,
        clientId: result.clientId,
        itemCount: result.itemCount,
      },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/clients/${result.clientId}`);
    return ok({ id: result.id, orderNumber: result.orderNumber });
  } catch (err) {
    if (err instanceof OrderError) return fail(err.message);
    throw err;
  }
}

export async function updateOrder(
  id: string,
  input: OrderUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = orderUpdateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const cur = await tx.order.findUnique({ where: { id } });
      if (!cur) throw new OrderError("존재하지 않는 주문입니다.");
      assertDraft(cur.status);

      const shipTo = await resolveShipToSnapshot(tx, cur.clientId, data);

      await tx.order.update({
        where: { id },
        data: {
          orderDate: data.orderDate ?? undefined,
          requestedDate: data.requestedDate ?? null,
          note: data.note ?? null,
          ...shipTo,
        },
      });
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ORDER_UPDATE_DRAFT",
      resource: `Order:${id}`,
      metadata: { patch: data },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${id}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof OrderError) return fail(err.message);
    throw err;
  }
}

export async function deleteOrder(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const cur = await prisma.order.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });
  if (!cur) return fail("존재하지 않는 주문입니다.");
  if (cur.status !== "DRAFT")
    return fail(`DRAFT 상태에서만 삭제 가능합니다 (현재: ${cur.status}).`);

  await prisma.order.delete({ where: { id } }); // items CASCADE 로 삭제

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "ORDER_DELETE_DRAFT",
    resource: `Order:${id}`,
    metadata: {
      orderNumber: cur.orderNumber,
      clientId: cur.clientId,
      itemCount: cur._count.items,
    },
  });

  revalidatePath("/admin/orders");
  return ok({ id });
}

// ─── 라인 CRUD (DRAFT 에서만) ───────────────────────────────

export async function addOrderItem(
  orderId: string,
  input: OrderItemCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = orderItemCreateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { productSizeId, quantity } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cur = await tx.order.findUnique({ where: { id: orderId } });
      if (!cur) throw new OrderError("존재하지 않는 주문입니다.");
      assertDraft(cur.status);

      const line = await computeLineFromPricing(
        tx,
        cur.clientId,
        productSizeId,
        quantity,
      );
      const created = await tx.orderItem.create({
        data: {
          orderId,
          productId: line.productId,
          productSizeId: line.productSizeId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          basePriceAtOrder: line.basePriceAtOrder,
          discountRateAtOrder: line.discountRateAtOrder,
          fixedPriceAppliedAtOrder: line.fixedPriceAppliedAtOrder,
          lineTotal: line.lineTotal,
        },
        select: { id: true },
      });
      return created;
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ORDER_ITEM_ADD",
      resource: `OrderItem:${result.id}`,
      metadata: { orderId, productSizeId, quantity },
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return ok({ id: result.id });
  } catch (err) {
    if (err instanceof OrderError) return fail(err.message);
    throw err;
  }
}

export async function updateOrderItem(
  id: string,
  input: OrderItemUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = orderItemUpdateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { quantity } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({
        where: { id },
        include: { order: true },
      });
      if (!item) throw new OrderError("존재하지 않는 라인입니다.");
      assertDraft(item.order.status);

      // 수량 변경 시 현재가 기준 lineTotal 재계산 (단가는 그대로 — 현재 가격을 변경 유도 X)
      const newLineTotal = item.unitPrice.mul(quantity);
      await tx.orderItem.update({
        where: { id },
        data: { quantity, lineTotal: newLineTotal },
      });
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ORDER_ITEM_UPDATE",
      resource: `OrderItem:${id}`,
      metadata: { quantity },
    });

    return ok({ id });
  } catch (err) {
    if (err instanceof OrderError) return fail(err.message);
    throw err;
  }
}

export async function deleteOrderItem(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const item = await prisma.orderItem.findUnique({
    where: { id },
    include: { order: { select: { id: true, status: true } } },
  });
  if (!item) return fail("존재하지 않는 라인입니다.");
  if (item.order.status !== "DRAFT")
    return fail(
      `DRAFT 상태에서만 라인 삭제 가능합니다 (현재: ${item.order.status}).`,
    );

  await prisma.orderItem.delete({ where: { id } });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "ORDER_ITEM_DELETE",
    resource: `OrderItem:${id}`,
    metadata: { orderId: item.orderId },
  });

  revalidatePath(`/admin/orders/${item.orderId}`);
  return ok({ id });
}

// ─── 상태 전이: SUBMIT (Phase 3D-2b-1) ─────────────────────

/**
 * `ORD-YYYYMMDD-NNN` 포맷의 공식 주문번호 채번.
 *
 * 동시성 전략:
 *   - Postgres advisory lock (per-day 해시 키) 을 트랜잭션 내에서 획득 → 같은 날짜의 채번은 직렬화.
 *   - 잠금 하에서 MAX(seq) 조회 후 +1 → 포맷팅 → INSERT.
 *   - 별도 Counter 테이블 없이 기존 Order.orderNumber 패턴만으로 gapless 근사 보장.
 *   - 여러 테넌트가 같은 날 채번해도 advisory lock 은 세션/트랜잭션 단위라 OK.
 *
 * NOTE: 완전한 gapless 가 필요하면 후속 단계에서 `OrderNumberCounter` 테이블로 전환.
 */
async function issueOfficialOrderNumber(
  tx: Prisma.TransactionClient,
  orderDate: Date,
): Promise<string> {
  const y = orderDate.getFullYear();
  const m = `${orderDate.getMonth() + 1}`.padStart(2, "0");
  const d = `${orderDate.getDate()}`.padStart(2, "0");
  const prefix = `ORD-${y}${m}${d}-`;

  // 1) 당일 advisory lock (해시키 = 날짜의 숫자 표현)
  const lockKey = Number(`${y}${m}${d}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

  // 2) 같은 prefix 를 가진 최대 seq 조회
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
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

/**
 * SUBMIT: DRAFT → SUBMITTED.
 * - 임시 orderNumber(`DRAFT-xxx`) 를 공식 `ORD-YYYYMMDD-NNN` 으로 재발급
 * - 각 라인 가격을 현시점 pricing.ts 로 재계산해 스냅샷 고정
 *   (이후 제품 basePrice / 할인 / 고정가가 바뀌어도 주문 가격은 불변)
 * - 재고 변동 없음 (CONFIRM 단계에서 RESERVE)
 * - 가드: 라인 1개 이상, 활성 거래처, DRAFT 상태
 */
export async function submitOrder(
  id: string,
  input: OrderSubmitInput = {},
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = orderSubmitSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cur = await tx.order.findUnique({
        where: { id },
        include: {
          items: { select: { id: true, productId: true, productSizeId: true, quantity: true } },
          client: { select: { id: true, active: true } },
        },
      });
      if (!cur) throw new OrderError("존재하지 않는 주문입니다.");
      if (cur.status !== "DRAFT")
        throw new OrderError(
          `DRAFT 상태에서만 제출 가능합니다 (현재: ${cur.status}).`,
        );
      if (!cur.client.active)
        throw new OrderError("비활성 거래처입니다. 제출할 수 없습니다.");
      if (cur.items.length === 0)
        throw new OrderError("라인이 없는 주문은 제출할 수 없습니다.");

      // 1) 공식 주문번호 채번
      const newNumber = await issueOfficialOrderNumber(tx, cur.orderDate);

      // 2) 라인별 가격 재스냅샷
      for (const it of cur.items) {
        const recalc = await computeLineFromPricing(
          tx,
          cur.clientId,
          it.productSizeId,
          it.quantity,
        );
        await tx.orderItem.update({
          where: { id: it.id },
          data: {
            unitPrice: recalc.unitPrice,
            basePriceAtOrder: recalc.basePriceAtOrder,
            discountRateAtOrder: recalc.discountRateAtOrder,
            fixedPriceAppliedAtOrder: recalc.fixedPriceAppliedAtOrder,
            lineTotal: recalc.lineTotal,
          },
        });
      }

      // 3) billingMonth 기록 (R12 — 월 1~25일 발주 → 월말 입금 규칙 체크용)
      const bmY = cur.orderDate.getFullYear();
      const bmM = `${cur.orderDate.getMonth() + 1}`.padStart(2, "0");
      const billingMonth = `${bmY}-${bmM}`;

      // 4) 상태 전환 + 번호/메모 갱신
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          orderNumber: newNumber,
          billingMonth,
          note: data.note ?? cur.note,
        },
        select: { id: true, orderNumber: true, clientId: true },
      });

      return {
        ...updated,
        prevOrderNumber: cur.orderNumber,
        itemCount: cur.items.length,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "ORDER_SUBMIT",
      resource: `Order:${result.id}`,
      metadata: {
        prevOrderNumber: result.prevOrderNumber,
        newOrderNumber: result.orderNumber,
        clientId: result.clientId,
        itemCount: result.itemCount,
      },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${result.id}`);
    return ok({ id: result.id, orderNumber: result.orderNumber });
  } catch (err) {
    if (err instanceof OrderError) return fail(err.message);
    throw err;
  }
}

// ─── UI 보조 조회 (거래처/제품사이즈 검색) ─────────────────

/**
 * 주문 생성 폼용 — 활성 거래처 검색. 비활성 거래처는 신규 주문 금지.
 */
export async function searchClientsForOrder(q: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  const needle = q.trim();
  const where: Prisma.ClientWhereInput = { active: true };
  if (needle) {
    where.OR = [
      { code: { contains: needle, mode: "insensitive" } },
      { name: { contains: needle, mode: "insensitive" } },
      { representative: { contains: needle, mode: "insensitive" } },
    ];
  }
  return prisma.client.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      representative: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
}

/**
 * 주문 라인 추가용 — 제품 검색 + 사이즈 펼침.
 * 거래처 가격규칙을 현시점 기준으로 계산해 미리보기 제공.
 */
export async function searchProductSizesForOrder(
  clientId: string,
  q: string,
) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  const needle = q.trim();
  if (!needle) return [];

  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { code: { contains: needle, mode: "insensitive" } },
        { name: { contains: needle, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      code: true,
      name: true,
      basePrice: true,
      category: true,
      sizes: {
        select: {
          id: true,
          sizeCode: true,
          physicalStock: true,
          availableStock: true,
        },
        orderBy: { sizeCode: "asc" },
      },
    },
    orderBy: { name: "asc" },
    take: 15,
  });

  const [discounts, fixedPrices] = await Promise.all([
    prisma.clientDiscount.findMany({
      where: { clientId },
      select: { category: true, discountRate: true },
    }),
    prisma.clientFixedPrice.findMany({
      where: { clientId, productId: { in: products.map((p) => p.id) } },
      select: { productId: true, fixedPrice: true },
    }),
  ]);
  const fixedByProduct = new Map(
    fixedPrices.map((f) => [f.productId, f.fixedPrice]),
  );

  return products.map((p) => {
    const snap = calculatePriceSnapshot({
      basePrice: p.basePrice,
      category: p.category,
      clientDiscounts: discounts.map((d) => ({
        category: d.category,
        discountRate: d.discountRate,
      })),
      clientFixedPrice: fixedByProduct.get(p.id) ?? null,
    });
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      basePrice: p.basePrice.toString(),
      unitPricePreview: snap.unitPrice.toString(),
      fixedPriceApplied: snap.fixedPriceAppliedAtOrder,
      discountRate:
        snap.discountRateAtOrder !== null
          ? snap.discountRateAtOrder.toString()
          : null,
      sizes: p.sizes.map((s) => ({
        id: s.id,
        sizeCode: s.sizeCode,
        availableStock: s.availableStock,
        physicalStock: s.physicalStock,
      })),
    };
  });
}

// ─── 내부 에러 ─────────────────────────────────────────────

class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}
