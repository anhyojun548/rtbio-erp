/**
 * Phase 3D-2c 스모크 — Shipment 수명주기 (출고 시작 · 단계 이동 · 완료 · 보류 · 재개).
 *
 * 시나리오:
 *   A. DRAFT(qty=2) → SUBMIT → CONFIRM → startShipment
 *      → 모든 중간 스테이지 이동 → terminal 도달 시 자동 완료
 *      ✓ physicalStock 이 정확히 2 감소
 *      ✓ availableStock 은 변하지 않음 (CONFIRM 에서 이미 차감됨)
 *      ✓ InventoryLog type=SHIP, qtyDelta=-2 기록
 *      ✓ Order.status=COMPLETED, completedAt 세팅
 *      ✓ Shipment.completedAt 세팅
 *      ✓ ShipmentStageLog 에 스테이지 수-1 건 이동 이력
 *   B. startShipment 재시도 (이미 완료된 주문) → 실패 기대 (CONFIRMED 아님)
 *   C. hold → resume 왕복
 *   D. 중복 startShipment (이미 진행중) → 실패 기대
 *
 * 실행: `npx tsx scripts/smoke-shipment.ts`
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
  sizeId: string,
  productId: string,
  quantity: number,
) {
  const size = await prisma.productSize.findUnique({
    where: { id: sizeId },
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
  return prisma.order.create({
    data: {
      orderNumber: draftOrderNumber(),
      clientId,
      status: "DRAFT",
      orderDate: new Date(),
      items: {
        create: [
          {
            productId,
            productSizeId: sizeId,
            quantity,
            unitPrice: unit,
            basePriceAtOrder: base,
            discountRateAtOrder: null,
            fixedPriceAppliedAtOrder: false,
            lineTotal: unit.mul(quantity),
          },
        ],
      },
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
        throw new Error(`재고 부족`);
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

/** startShipment inline (requireRole 우회) */
async function startShipmentInline(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { shipments: { select: { id: true, completedAt: true } } },
    });
    if (!order) throw new Error("order 없음");
    if (order.status !== "CONFIRMED")
      throw new Error(`startShipment 가드: ${order.status}`);
    const active = order.shipments.find((s) => s.completedAt === null);
    if (active) throw new Error("이미 진행중 출고");
    const firstStage = await tx.kanbanColumn.findFirst({
      orderBy: { sortOrder: "asc" },
    });
    if (!firstStage) throw new Error("칸반 단계 없음");
    const sh = await tx.shipment.create({
      data: {
        orderId,
        currentStageId: firstStage.id,
        enteredStageAt: new Date(),
      },
    });
    await tx.shipmentStageLog.create({
      data: {
        shipmentId: sh.id,
        fromStageId: null,
        toStageId: firstStage.id,
        note: "START",
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "SHIPPING" },
    });
    return sh;
  });
}

/** moveShipmentStage inline (terminal 이면 자동 완료) */
async function moveStageInline(shipmentId: string, toStageId: string) {
  return prisma.$transaction(async (tx) => {
    const sh = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        order: {
          include: {
            items: {
              select: { id: true, productSizeId: true, quantity: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
    if (!sh) throw new Error("shipment 없음");
    if (sh.completedAt !== null) throw new Error("이미 완료됨");
    if (sh.currentStageId === toStageId) throw new Error("동일 단계");
    const toStage = await tx.kanbanColumn.findUnique({
      where: { id: toStageId },
    });
    if (!toStage) throw new Error("단계 없음");
    const now = new Date();
    await tx.shipment.update({
      where: { id: shipmentId },
      data: { currentStageId: toStage.id, enteredStageAt: now },
    });
    await tx.shipmentStageLog.create({
      data: {
        shipmentId,
        fromStageId: sh.currentStageId,
        toStageId: toStage.id,
      },
    });
    if (toStage.isTerminal) {
      for (const it of sh.order.items) {
        await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "tenant_altibio"."ProductSize"
          WHERE id = ${it.productSizeId}
          FOR UPDATE
        `;
        const size = await tx.productSize.findUnique({
          where: { id: it.productSizeId },
        });
        if (!size) throw new Error("사이즈 없음");
        const nextPhysical = size.physicalStock - it.quantity;
        assertInvariant(nextPhysical, size.availableStock);
        await tx.productSize.update({
          where: { id: size.id },
          data: { physicalStock: nextPhysical },
        });
        await tx.inventoryLog.create({
          data: {
            productSizeId: size.id,
            type: "SHIP",
            qtyDelta: -it.quantity,
            physicalAfter: nextPhysical,
            availableAfter: size.availableStock,
            relatedOrderId: sh.order.id,
            note: "SHIP (terminal)",
          },
        });
      }
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { completedAt: now },
      });
      await tx.order.update({
        where: { id: sh.order.id },
        data: { status: "COMPLETED", completedAt: now },
      });
    }
    return { completed: toStage.isTerminal };
  });
}

async function holdShipmentInline(shipmentId: string, reason: string) {
  return prisma.shipment.update({
    where: { id: shipmentId },
    data: { holdReason: reason },
  });
}

async function resumeShipmentInline(shipmentId: string) {
  return prisma.shipment.update({
    where: { id: shipmentId },
    data: { holdReason: null },
  });
}

async function main() {
  const client = await prisma.client.findFirst({ where: { active: true } });
  if (!client) throw new Error("활성 거래처 없음");
  const size = await prisma.productSize.findFirst({
    where: { product: { active: true }, availableStock: { gte: 2 } },
    include: { product: { select: { id: true, name: true } } },
  });
  if (!size) throw new Error("재고 충분한 사이즈 없음");

  const stages = await prisma.kanbanColumn.findMany({
    orderBy: { sortOrder: "asc" },
  });
  if (stages.length < 2) throw new Error("칸반 단계 2개 이상 필요");

  console.log(
    `사이즈: ${size.product.name}/${size.sizeCode} (phy=${size.physicalStock}, avail=${size.availableStock})`,
  );
  console.log(
    `칸반 단계: ${stages.map((s) => `${s.key}${s.isTerminal ? "*" : ""}`).join(" → ")}`,
  );

  // ─── 시나리오 A: 전체 수명주기 ─────────────────────────
  const dA = await createDraft(client.id, size.id, size.product.id, 2);
  await submitInline(dA.id);
  await confirmInline(dA.id);

  const afterConfirm = await prisma.productSize.findUnique({
    where: { id: size.id },
  });
  if (!afterConfirm) throw new Error("사이즈 사라짐");
  console.log(
    `[A] CONFIRM 후: phy=${afterConfirm.physicalStock}, avail=${afterConfirm.availableStock}`,
  );

  // startShipment
  const shipment = await startShipmentInline(dA.id);
  console.log(`✓ [A] startShipment → shipment=${shipment.id.slice(0, 8)}...`);

  // 중간 단계 모두 이동 → terminal 도달 (A → B → ... → terminal)
  let cursor = 0;
  for (let i = 1; i < stages.length; i++) {
    const next = stages[i]!;
    const prev = stages[i - 1]!;
    const res = await moveStageInline(shipment.id, next.id);
    cursor = i;
    const marker = res.completed ? "✓ COMPLETED" : "→";
    console.log(
      `  ${marker} ${prev.key} → ${next.key}${res.completed ? " (terminal, SHIP 실행)" : ""}`,
    );
    if (res.completed) break;
  }
  if (!stages[cursor]!.isTerminal)
    throw new Error("terminal 도달 실패");

  // 검증
  const afterShip = await prisma.productSize.findUnique({
    where: { id: size.id },
  });
  if (!afterShip) throw new Error("사이즈 사라짐");
  const phyDiff = size.physicalStock - afterShip.physicalStock;
  if (phyDiff !== 2)
    throw new Error(
      `physical 차감 오류: expected -2, got ${phyDiff} (before=${size.physicalStock}, after=${afterShip.physicalStock})`,
    );
  if (afterShip.availableStock !== afterConfirm.availableStock)
    throw new Error(
      `available 변동 오류: CONFIRM 후 값(${afterConfirm.availableStock}) 과 달라짐 (${afterShip.availableStock})`,
    );
  console.log(
    `✓ [A] SHIP 검증: phy ${size.physicalStock} → ${afterShip.physicalStock} (−2), avail 불변 (${afterShip.availableStock})`,
  );

  const shipLog = await prisma.inventoryLog.findFirst({
    where: { relatedOrderId: dA.id, type: "SHIP" },
  });
  if (!shipLog || shipLog.qtyDelta !== -2)
    throw new Error("SHIP 로그 누락/오류");
  console.log(
    `✓ [A] InventoryLog SHIP qtyDelta=${shipLog.qtyDelta} physicalAfter=${shipLog.physicalAfter}`,
  );

  const orderFinal = await prisma.order.findUnique({ where: { id: dA.id } });
  if (orderFinal?.status !== "COMPLETED" || !orderFinal.completedAt)
    throw new Error("Order 상태/completedAt 오류");
  console.log(
    `✓ [A] Order.status=COMPLETED, completedAt=${orderFinal.completedAt.toISOString()}`,
  );

  const shipFinal = await prisma.shipment.findUnique({
    where: { id: shipment.id },
    include: { stageHistory: true },
  });
  if (!shipFinal?.completedAt) throw new Error("Shipment.completedAt 누락");
  // stageHistory: START(1) + (stages.length - 1) 회 이동
  if (shipFinal.stageHistory.length !== stages.length)
    throw new Error(
      `stageHistory 건수 오류: expected ${stages.length}, got ${shipFinal.stageHistory.length}`,
    );
  console.log(
    `✓ [A] Shipment.completedAt 세팅, stageHistory ${shipFinal.stageHistory.length}건 기록`,
  );

  // ─── 시나리오 B: 이미 완료된 주문에 startShipment 재시도 ─
  let bBlocked = false;
  try {
    await startShipmentInline(dA.id);
  } catch (e) {
    bBlocked = true;
    console.log(`✓ [B] 재-startShipment 가드: ${(e as Error).message}`);
  }
  if (!bBlocked) throw new Error("[B] startShipment 재시도 가드 실패");

  // ─── 시나리오 C: hold / resume 왕복 ─────────────────────
  const dC = await createDraft(client.id, size.id, size.product.id, 1);
  await submitInline(dC.id);
  await confirmInline(dC.id);
  const shC = await startShipmentInline(dC.id);

  await holdShipmentInline(shC.id, "테스트 보류");
  const heldSh = await prisma.shipment.findUnique({ where: { id: shC.id } });
  if (heldSh?.holdReason !== "테스트 보류")
    throw new Error("hold 실패");
  console.log(`✓ [C] hold → holdReason="${heldSh.holdReason}"`);

  await resumeShipmentInline(shC.id);
  const resumedSh = await prisma.shipment.findUnique({
    where: { id: shC.id },
  });
  if (resumedSh?.holdReason !== null) throw new Error("resume 실패");
  console.log(`✓ [C] resume → holdReason=null`);

  // ─── 시나리오 D: 중복 startShipment ────────────────────
  let dBlocked = false;
  try {
    await startShipmentInline(dC.id);
  } catch (e) {
    dBlocked = true;
    console.log(`✓ [D] 중복 startShipment 가드: ${(e as Error).message}`);
  }
  if (!dBlocked) throw new Error("[D] 중복 startShipment 가드 실패");

  // ─── 청소 ───────────────────────────────────────────────
  // dC 는 SHIPPING 상태 — 정리 위해 physicalStock 복원 & 재고 RELEASE 는 생략 (테스트 전용)
  // dA 는 COMPLETED — physicalStock 2 복원
  await prisma.productSize.update({
    where: { id: size.id },
    data: {
      physicalStock: size.physicalStock,
      availableStock: size.availableStock,
    },
  });
  await prisma.inventoryLog.deleteMany({
    where: { relatedOrderId: { in: [dA.id, dC.id] } },
  });
  await prisma.shipmentStageLog.deleteMany({
    where: { shipmentId: { in: [shipment.id, shC.id] } },
  });
  await prisma.shipment.deleteMany({
    where: { id: { in: [shipment.id, shC.id] } },
  });
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: [dA.id, dC.id] } },
  });
  await prisma.order.deleteMany({ where: { id: { in: [dA.id, dC.id] } } });
  console.log(
    `✓ 정리: 주문 2건 · shipment 2건 · 재고 복원 (phy=${size.physicalStock}, avail=${size.availableStock})`,
  );

  console.log(`\n✅ Shipment 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
