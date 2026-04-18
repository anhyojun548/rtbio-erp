/**
 * Phase 3D-2b-2 전이 스모크 테스트 — REJECT / HOLD / RESUME / CANCEL.
 *
 * 시나리오:
 *   A. DRAFT → SUBMIT → HOLD → RESUME → REJECT
 *   B. DRAFT → SUBMIT → CANCEL
 *   C. CANCELLED 상태에서 재-CANCEL 시도 → 실패 기대 (가드 확인)
 *   D. DRAFT 상태에서 바로 REJECT 시도 → 실패 기대 (가드 확인)
 *
 * NOTE: 서버 액션은 requireRole 로 세션이 필요해 prisma 직접 조작으로 재현.
 *       액션 본체 로직을 inline 재현해 상태 머신만 검증.
 *
 * 실행: `npx tsx scripts/smoke-order-transition.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { calculatePriceSnapshot } from "../src/lib/pricing";

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

async function createDraft(clientId: string, sizeId: string, productId: string) {
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
            quantity: 2,
            unitPrice: unit,
            basePriceAtOrder: base,
            discountRateAtOrder: null,
            fixedPriceAppliedAtOrder: false,
            lineTotal: unit.mul(2),
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

/** 상태 전이 헬퍼 — 허용 상태 체크 + 업데이트. */
async function transition(
  orderId: string,
  allowedFrom: ReadonlyArray<string>,
  nextStatus: "SUBMITTED" | "HOLD" | "REJECTED" | "CANCELLED",
  extra: Prisma.OrderUncheckedUpdateInput = {},
) {
  return prisma.$transaction(async (tx) => {
    const cur = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!cur) throw new Error("order 없음");
    if (!allowedFrom.includes(cur.status))
      throw new Error(`전이 가드 실패: ${cur.status} → ${nextStatus}`);
    return tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus, ...extra },
      select: {
        id: true,
        status: true,
        rejectedAt: true,
        rejectedReason: true,
        heldAt: true,
        heldReason: true,
        note: true,
      },
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

  console.log(
    `거래처: ${client.name} / 사이즈: ${size.product.name}/${size.sizeCode}`,
  );

  // ─── 시나리오 A: SUBMIT → HOLD → RESUME → REJECT ────────────
  const dA = await createDraft(client.id, size.id, size.product.id);
  await submitInline(dA.id);
  console.log(`✓ [A] DRAFT → SUBMITTED`);

  const held = await transition(dA.id, ["SUBMITTED"], "HOLD", {
    heldAt: new Date(),
    heldReason: "거래처 재고 확인 필요",
  });
  if (held.status !== "HOLD" || !held.heldReason)
    throw new Error("HOLD 필드 누락");
  console.log(`✓ [A] SUBMITTED → HOLD (reason="${held.heldReason}")`);

  const resumed = await transition(dA.id, ["HOLD"], "SUBMITTED", {
    heldAt: null,
    heldReason: null,
  });
  if (resumed.status !== "SUBMITTED" || resumed.heldReason !== null)
    throw new Error("RESUME 실패 — heldReason 초기화 안됨");
  console.log(`✓ [A] HOLD → SUBMITTED (RESUME, heldReason=null)`);

  const rejected = await transition(
    dA.id,
    ["SUBMITTED", "HOLD"],
    "REJECTED",
    {
      rejectedAt: new Date(),
      rejectedReason: "불량 발견",
    },
  );
  if (rejected.status !== "REJECTED" || !rejected.rejectedReason)
    throw new Error("REJECT 필드 누락");
  console.log(
    `✓ [A] SUBMITTED → REJECTED (reason="${rejected.rejectedReason}")`,
  );

  // ─── 시나리오 B: SUBMIT → CANCEL ────────────────────────────
  const dB = await createDraft(client.id, size.id, size.product.id);
  await submitInline(dB.id);
  const cancelled = await transition(
    dB.id,
    ["SUBMITTED", "HOLD"],
    "CANCELLED",
    { note: "[취소] 거래처 요청" },
  );
  if (cancelled.status !== "CANCELLED" || !cancelled.note?.startsWith("[취소]"))
    throw new Error("CANCEL 실패");
  console.log(`✓ [B] SUBMITTED → CANCELLED (note="${cancelled.note}")`);

  // ─── 시나리오 C: CANCELLED 에서 재-CANCEL → 실패 기대 ────────
  let cBlocked = false;
  try {
    await transition(dB.id, ["SUBMITTED", "HOLD"], "CANCELLED");
  } catch (e) {
    cBlocked = true;
    console.log(`✓ [C] 재-CANCEL 가드: ${(e as Error).message}`);
  }
  if (!cBlocked) throw new Error("재-CANCEL 가드 실패");

  // ─── 시나리오 D: DRAFT 에서 바로 REJECT → 실패 기대 ─────────
  const dD = await createDraft(client.id, size.id, size.product.id);
  let dBlocked = false;
  try {
    await transition(dD.id, ["SUBMITTED", "HOLD"], "REJECTED");
  } catch (e) {
    dBlocked = true;
    console.log(`✓ [D] DRAFT 에서 REJECT 가드: ${(e as Error).message}`);
  }
  if (!dBlocked) throw new Error("DRAFT→REJECT 가드 실패");

  // ─── 청소 ───────────────────────────────────────────────────
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: [dA.id, dB.id, dD.id] } },
  });
  await prisma.order.deleteMany({
    where: { id: { in: [dA.id, dB.id, dD.id] } },
  });
  console.log(`✓ 테스트 주문 3건 삭제`);

  console.log(`\n✅ 전이 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
