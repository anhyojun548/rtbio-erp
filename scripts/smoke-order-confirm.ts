/**
 * Phase 3D-2b-3 스모크 — CONFIRM (RESERVE) + CANCEL CONFIRMED (RELEASE).
 *
 * 시나리오:
 *   A. DRAFT(qty=3) → SUBMIT → CONFIRM
 *      - availableStock 이 정확히 3 감소했는지
 *      - physicalStock 은 변하지 않았는지
 *      - InventoryLog type=RESERVE 기록 (qtyDelta=-3, relatedOrderId)
 *   B. A 의 주문을 CANCEL
 *      - availableStock 이 원복됐는지
 *      - InventoryLog type=RELEASE 기록 (qtyDelta=+3)
 *   C. 재고 부족 시 CONFIRM 실패 (전체 롤백)
 *      - 사이즈의 availableStock 을 1로 낮춰놓고 qty=5 주문 CONFIRM → 실패 기대
 *      - 라인 1 처리 중 실패해도 라인 0 의 재고는 영향 없어야 (롤백)
 *
 * 실행: `npx tsx scripts/smoke-order-confirm.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { calculatePriceSnapshot } from "../src/lib/pricing";
import { assertInvariant } from "../src/lib/inventory/invariant";

function draftOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `DRAFT-${rand}`;
}

async function issueOfficial(
  tx: Prisma.TransactionClient,
  orderDate: Date,
): Promise<string> {
  const y = orderDate.getFullYear();
  const m = `${orderDate.getMonth() + 1}`.padStart(2, "0");
  const d = `${orderDate.getDate()}`.padStart(2, "0");
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
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

async function createDraft(
  clientId: string,
  lines: Array<{ sizeId: string; productId: string; quantity: number }>,
) {
  const itemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];
  for (const l of lines) {
    const size = await prisma.productSize.findUnique({
      where: { id: l.sizeId },
      include: {
        product: { select: { basePrice: true, category: true, id: true } },
      },
    });
    if (!size) throw new Error("사이즈 없음");
    const snap = calculatePriceSnapshot({
      basePrice: size.product.basePrice,
      category: size.product.category,
      clientDiscounts: [],
      clientFixedPrice: null,
    });
    const unit = new Prisma.Decimal(Number(snap.unitPrice).toFixed(2));
    const base = new Prisma.Decimal(Number(snap.basePriceAtOrder).toFixed(2));
    itemsData.push({
      product: { connect: { id: l.productId } },
      productSize: { connect: { id: l.sizeId } },
      quantity: l.quantity,
      unitPrice: unit,
      basePriceAtOrder: base,
      discountRateAtOrder: null,
      fixedPriceAppliedAtOrder: false,
      lineTotal: unit.mul(l.quantity),
    });
  }
  return prisma.order.create({
    data: {
      orderNumber: draftOrderNumber(),
      clientId,
      status: "DRAFT",
      orderDate: new Date(),
      items: { create: itemsData },
    },
    include: { items: true },
  });
}

async function submitInline(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const cur = await tx.order.findUnique({ where: { id: orderId } });
    if (!cur) throw new Error("order 없음");
    if (cur.status !== "DRAFT") throw new Error(`SUBMIT 가드: ${cur.status}`);
    const newNumber = await issueOfficial(tx, cur.orderDate);
    const bmY = cur.orderDate.getFullYear();
    const bmM = `${cur.orderDate.getMonth() + 1}`.padStart(2, "0");
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: "SUBMITTED",
        orderNumber: newNumber,
        billingMonth: `${bmY}-${bmM}`,
      },
    });
  });
}

/** confirmOrder 액션 본체를 inline 재현 (requireRole 우회) */
async function confirmInline(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const cur = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: { id: true, productSizeId: true, quantity: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!cur) throw new Error("order 없음");
    if (cur.status !== "SUBMITTED")
      throw new Error(`CONFIRM 가드: ${cur.status}`);

    for (const it of cur.items) {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "tenant_altibio"."ProductSize"
        WHERE id = ${it.productSizeId}
        FOR UPDATE
      `;
      const size = await tx.productSize.findUnique({
        where: { id: it.productSizeId },
      });
      if (!size) throw new Error("사이즈 없음");
      if (size.availableStock < it.quantity)
        throw new Error(
          `재고 부족: 가용 ${size.availableStock} < 요청 ${it.quantity}`,
        );
      const nextAvailable = size.availableStock - it.quantity;
      assertInvariant(size.physicalStock, nextAvailable);
      await tx.productSize.update({
        where: { id: size.id },
        data: { availableStock: nextAvailable },
      });
      await tx.inventoryLog.create({
        data: {
          productSizeId: size.id,
          type: "RESERVE",
          qtyDelta: -it.quantity,
          physicalAfter: size.physicalStock,
          availableAfter: nextAvailable,
          relatedOrderId: orderId,
          note: "CONFIRM",
        },
      });
    }
    return tx.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
  });
}

/** cancelOrder 액션 본체를 inline 재현 (CONFIRMED → RELEASE) */
async function cancelInline(orderId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const cur = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: { id: true, productSizeId: true, quantity: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!cur) throw new Error("order 없음");
    const releasedStock = cur.status === "CONFIRMED";
    if (releasedStock) {
      for (const it of cur.items) {
        await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "tenant_altibio"."ProductSize"
          WHERE id = ${it.productSizeId}
          FOR UPDATE
        `;
        const size = await tx.productSize.findUnique({
          where: { id: it.productSizeId },
        });
        if (!size) throw new Error("사이즈 없음");
        const nextAvailable = size.availableStock + it.quantity;
        assertInvariant(size.physicalStock, nextAvailable);
        await tx.productSize.update({
          where: { id: size.id },
          data: { availableStock: nextAvailable },
        });
        await tx.inventoryLog.create({
          data: {
            productSizeId: size.id,
            type: "RELEASE",
            qtyDelta: it.quantity,
            physicalAfter: size.physicalStock,
            availableAfter: nextAvailable,
            relatedOrderId: orderId,
            note: `CANCEL: ${reason}`,
          },
        });
      }
    }
    return tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", note: `[취소] ${reason}` },
    });
  });
}

async function main() {
  const client = await prisma.client.findFirst({ where: { active: true } });
  if (!client) throw new Error("활성 거래처 없음");
  const size = await prisma.productSize.findFirst({
    where: { product: { active: true } },
    include: { product: { select: { id: true, name: true } } },
  });
  if (!size) throw new Error("사이즈 없음");

  // 다른 사이즈도 준비 (시나리오 C 의 롤백 검증용)
  const size2 = await prisma.productSize.findFirst({
    where: { product: { active: true }, id: { not: size.id } },
    include: { product: { select: { id: true, name: true } } },
  });
  if (!size2) throw new Error("두번째 사이즈 없음");

  console.log(
    `사이즈1: ${size.product.name}/${size.sizeCode} (phy=${size.physicalStock}, avail=${size.availableStock})`,
  );
  console.log(
    `사이즈2: ${size2.product.name}/${size2.sizeCode} (phy=${size2.physicalStock}, avail=${size2.availableStock})`,
  );

  // ─── 시나리오 A: CONFIRM → availableStock 차감 ─────────────
  const dA = await createDraft(client.id, [
    { sizeId: size.id, productId: size.product.id, quantity: 3 },
  ]);
  await submitInline(dA.id);
  await confirmInline(dA.id);

  const after = await prisma.productSize.findUnique({ where: { id: size.id } });
  if (!after) throw new Error("사이즈 사라짐");
  const availDiff = size.availableStock - after.availableStock;
  if (availDiff !== 3)
    throw new Error(
      `avail 차감 오류: expected -3, got ${availDiff} (before=${size.availableStock}, after=${after.availableStock})`,
    );
  if (after.physicalStock !== size.physicalStock)
    throw new Error("physicalStock 이 변했습니다 — CONFIRM 은 physical 불변이어야 함");
  console.log(
    `✓ [A] CONFIRM → avail ${size.availableStock} → ${after.availableStock} (−3), phy 불변`,
  );

  const resLog = await prisma.inventoryLog.findFirst({
    where: { relatedOrderId: dA.id, type: "RESERVE" },
  });
  if (!resLog || resLog.qtyDelta !== -3)
    throw new Error("RESERVE 로그 누락");
  console.log(
    `✓ [A] InventoryLog RESERVE qtyDelta=${resLog.qtyDelta} availableAfter=${resLog.availableAfter}`,
  );

  // ─── 시나리오 B: CANCEL CONFIRMED → RELEASE ────────────────
  await cancelInline(dA.id, "테스트 취소");
  const back = await prisma.productSize.findUnique({ where: { id: size.id } });
  if (!back) throw new Error("사이즈 사라짐");
  if (back.availableStock !== size.availableStock)
    throw new Error(
      `RELEASE 후 복원 실패: expected ${size.availableStock}, got ${back.availableStock}`,
    );
  console.log(
    `✓ [B] CANCEL CONFIRMED → avail 복원 (${back.availableStock})`,
  );

  const relLog = await prisma.inventoryLog.findFirst({
    where: { relatedOrderId: dA.id, type: "RELEASE" },
  });
  if (!relLog || relLog.qtyDelta !== 3)
    throw new Error("RELEASE 로그 누락");
  console.log(
    `✓ [B] InventoryLog RELEASE qtyDelta=${relLog.qtyDelta} availableAfter=${relLog.availableAfter}`,
  );

  // ─── 시나리오 C: 재고 부족 → CONFIRM 실패 + 롤백 ───────────
  // size2 의 avail 을 0으로 잠시 낮춤 (qty=1 주문이 실패하도록)
  const size2Before = await prisma.productSize.findUnique({
    where: { id: size2.id },
  });
  if (!size2Before) throw new Error("사이즈2 사라짐");

  // size2 를 일시적으로 0 으로 (physical 은 기존 유지 — 불변식은 physical>=available 이므로 ok)
  const size2Saved = size2Before.availableStock;
  await prisma.productSize.update({
    where: { id: size2.id },
    data: { availableStock: 0 },
  });

  // 라인 2개: line1 = size(qty=2, 가능), line2 = size2(qty=1, 실패)
  const dC = await createDraft(client.id, [
    { sizeId: size.id, productId: size.product.id, quantity: 2 },
    { sizeId: size2.id, productId: size2.product.id, quantity: 1 },
  ]);
  await submitInline(dC.id);

  const availBeforeC = (
    await prisma.productSize.findUnique({ where: { id: size.id } })
  )?.availableStock;

  let confirmFailed = false;
  try {
    await confirmInline(dC.id);
  } catch (e) {
    confirmFailed = true;
    console.log(`✓ [C] CONFIRM 실패 기대대로: ${(e as Error).message}`);
  }
  if (!confirmFailed) throw new Error("[C] CONFIRM 실패 기대했으나 통과함");

  // size1 은 영향 없어야 (롤백)
  const availAfterC = (
    await prisma.productSize.findUnique({ where: { id: size.id } })
  )?.availableStock;
  if (availAfterC !== availBeforeC)
    throw new Error(
      `[C] 롤백 실패: size1 avail 변동 (${availBeforeC} → ${availAfterC})`,
    );
  console.log(
    `✓ [C] 전체 트랜잭션 롤백 — size1 avail 불변 (${availAfterC})`,
  );

  // size2 복원
  await prisma.productSize.update({
    where: { id: size2.id },
    data: { availableStock: size2Saved },
  });

  // ─── 청소 ───────────────────────────────────────────────────
  await prisma.inventoryLog.deleteMany({
    where: { relatedOrderId: { in: [dA.id, dC.id] } },
  });
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: [dA.id, dC.id] } },
  });
  await prisma.order.deleteMany({
    where: { id: { in: [dA.id, dC.id] } },
  });
  console.log(`✓ 테스트 주문 2건 + 로그 삭제`);

  console.log(`\n✅ CONFIRM/RELEASE 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
