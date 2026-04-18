/**
 * Phase 3D-2b-1 SUBMIT 스모크 테스트.
 *
 * 시나리오:
 *   1) DRAFT 주문 생성 (smoke-order 와 동일 구조)
 *   2) `issueOfficialOrderNumber` 의 채번 로직 재현:
 *      - advisory lock + MAX(seq)+1
 *   3) pricing.ts 기반 가격 재스냅샷 후 상태 SUBMITTED 로 전환
 *   4) 동일 orderDate 로 한 건 더 생성 → 채번이 NNN 증가하는지 확인
 *   5) 청소 (SUBMITTED 는 deleteOrder 로 못 지우므로 prisma 직접 삭제)
 *
 * NOTE: Server Action(submitOrder) 은 requireRole 로 세션이 필요해 prisma 직접 사용.
 *       내부 로직을 inline 재현해 SQL + 채번 + 재스냅샷까지 검증.
 *
 * 실행: `npx tsx scripts/smoke-order-submit.ts`
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
    const cur = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!cur) throw new Error("order 없음");
    if (cur.status !== "DRAFT") throw new Error(`상태 오류: ${cur.status}`);

    const newNumber = await issueOfficial(tx, cur.orderDate);

    // 간단한 재스냅샷 (할인 없음)
    for (const it of cur.items) {
      const size = await tx.productSize.findUnique({
        where: { id: it.productSizeId },
        include: { product: { select: { basePrice: true, category: true } } },
      });
      if (!size) continue;
      const snap = calculatePriceSnapshot({
        basePrice: size.product.basePrice,
        category: size.product.category,
        clientDiscounts: [],
        clientFixedPrice: null,
      });
      const unit = new Prisma.Decimal(Number(snap.unitPrice).toFixed(2));
      await tx.orderItem.update({
        where: { id: it.id },
        data: {
          unitPrice: unit,
          basePriceAtOrder: new Prisma.Decimal(
            Number(snap.basePriceAtOrder).toFixed(2),
          ),
          discountRateAtOrder: null,
          fixedPriceAppliedAtOrder: false,
          lineTotal: unit.mul(it.quantity),
        },
      });
    }

    const bmY = cur.orderDate.getFullYear();
    const bmM = `${cur.orderDate.getMonth() + 1}`.padStart(2, "0");

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: "SUBMITTED",
        orderNumber: newNumber,
        billingMonth: `${bmY}-${bmM}`,
      },
      include: { items: true },
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

  // ─── 1) DRAFT 생성 ──────────────────────────────────────
  const d1 = await createDraft(client.id, size.id, size.product.id);
  console.log(`✓ DRAFT #1 생성: ${d1.orderNumber}`);
  if (!d1.orderNumber.startsWith("DRAFT-"))
    throw new Error("임시 orderNumber 형식 오류");

  // ─── 2) SUBMIT #1 ──────────────────────────────────────
  const s1 = await submitInline(d1.id);
  console.log(`✓ SUBMIT #1 → ${s1.orderNumber} (status=${s1.status})`);
  if (s1.status !== "SUBMITTED") throw new Error("상태 전환 실패");
  if (!s1.orderNumber.startsWith("ORD-"))
    throw new Error(`공식 orderNumber 형식 오류: ${s1.orderNumber}`);
  if (!s1.billingMonth) throw new Error("billingMonth 누락");
  console.log(`  billingMonth=${s1.billingMonth}`);

  const seq1 = Number(s1.orderNumber.slice(-3));
  if (!Number.isFinite(seq1) || seq1 < 1)
    throw new Error(`seq 파싱 실패: ${s1.orderNumber}`);

  // ─── 3) SUBMIT #2 — seq 증가 확인 ───────────────────────
  const d2 = await createDraft(client.id, size.id, size.product.id);
  const s2 = await submitInline(d2.id);
  const seq2 = Number(s2.orderNumber.slice(-3));
  console.log(`✓ SUBMIT #2 → ${s2.orderNumber} (seq ${seq1} → ${seq2})`);
  if (seq2 !== seq1 + 1)
    throw new Error(`seq 증가 실패: expect ${seq1 + 1} got ${seq2}`);

  // ─── 4) DRAFT 가 아닌 상태에서 재 SUBMIT 시도 → 실패 기대 ─
  let rejected = false;
  try {
    await submitInline(s1.id);
  } catch (e) {
    rejected = true;
    console.log(`✓ 이미 SUBMITTED 인 주문은 재제출 거부: ${(e as Error).message}`);
  }
  if (!rejected) throw new Error("재제출 가드 실패");

  // ─── 5) 청소 — SUBMITTED 는 deleteOrder 로 못 지우므로 prisma 직접 삭제 ─
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: [s1.id, s2.id] } },
  });
  await prisma.order.deleteMany({ where: { id: { in: [s1.id, s2.id] } } });
  console.log(`✓ 테스트 주문 2건 삭제`);

  console.log(`\n✅ SUBMIT 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
