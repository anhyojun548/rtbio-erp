/**
 * Phase 3D-1 가격 규칙 스모크 테스트.
 *
 * 시나리오:
 *   1) 거래처 A 에 카테고리 할인율 10% + 고정가 규칙 1건 upsert
 *   2) pricing.ts 의 calculatePriceSnapshot 이 fixedPrice 우선 적용하는지 확인
 *   3) 고정가 없는 다른 카테고리 제품은 할인율 적용되는지 확인
 *   4) 카테고리·고정가 모두 없는 제품은 basePrice 그대로 적용되는지 확인
 *   5) 저장값 정리 (삭제)
 *
 * 실행: `npx tsx scripts/smoke-pricing.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { calculatePriceSnapshot } from "../src/lib/pricing";

async function main() {
  const client = await prisma.client.findFirst({ where: { active: true } });
  if (!client) {
    console.error("✗ 활성 거래처가 없습니다.");
    process.exit(1);
  }

  const products = await prisma.product.findMany({
    where: { active: true, category: { not: null } },
    take: 3,
  });
  if (products.length < 2) {
    console.error("✗ 카테고리 있는 활성 제품이 2개 이상 필요합니다.");
    process.exit(1);
  }

  const [pA, pB] = products;
  if (!pA || !pB) throw new Error("unreachable");
  console.log(
    `거래처: ${client.name}(${client.code})\n제품 A: ${pA.name} / 카테고리=${pA.category} / basePrice=${pA.basePrice}\n제품 B: ${pB.name} / 카테고리=${pB.category} / basePrice=${pB.basePrice}`,
  );

  // ─── 1) upsert discount + fixedPrice ────────────────────
  const discount = await prisma.clientDiscount.upsert({
    where: { clientId_category: { clientId: client.id, category: pA.category! } },
    create: {
      clientId: client.id,
      category: pA.category!,
      discountRate: new Prisma.Decimal("0.1"),
    },
    update: { discountRate: new Prisma.Decimal("0.1") },
    select: { id: true },
  });
  const fixedPrice = await prisma.clientFixedPrice.upsert({
    where: { clientId_productId: { clientId: client.id, productId: pA.id } },
    create: {
      clientId: client.id,
      productId: pA.id,
      fixedPrice: new Prisma.Decimal("99000"),
    },
    update: { fixedPrice: new Prisma.Decimal("99000") },
    select: { id: true },
  });
  console.log(
    `✓ 할인율 upsert (카테고리=${pA.category}, 10%) + 고정가 upsert (제품 A, 99000원)`,
  );

  // ─── 2) fixedPrice 우선 적용 확인 ────────────────────────
  const snapA = calculatePriceSnapshot({
    basePrice: pA.basePrice,
    category: pA.category,
    clientDiscounts: [{ category: pA.category!, discountRate: "0.1" }],
    clientFixedPrice: "99000",
  });
  console.log(
    `✓ 제품 A 스냅샷: unitPrice=${snapA.unitPrice} fixedApplied=${snapA.fixedPriceAppliedAtOrder} discount=${snapA.discountRateAtOrder}`,
  );
  if (Number(snapA.unitPrice) !== 99000) {
    throw new Error(`fixedPrice 우선 실패: ${snapA.unitPrice}`);
  }
  if (!snapA.fixedPriceAppliedAtOrder) throw new Error("fixedPriceAppliedAtOrder false");

  // ─── 3) 제품 B: 다른 카테고리 + 할인 없음 → basePrice ──
  const snapB = calculatePriceSnapshot({
    basePrice: pB.basePrice,
    category: pB.category,
    clientDiscounts:
      pA.category === pB.category
        ? [{ category: pA.category!, discountRate: "0.1" }]
        : [],
    clientFixedPrice: null,
  });
  console.log(
    `✓ 제품 B 스냅샷: unitPrice=${snapB.unitPrice} (카테고리 ${pA.category === pB.category ? "동일 → 할인적용" : "상이 → basePrice"})`,
  );
  if (pA.category !== pB.category) {
    if (Number(snapB.unitPrice) !== Number(pB.basePrice)) {
      throw new Error(`basePrice 적용 실패: ${snapB.unitPrice}`);
    }
  } else {
    const expected = Math.round(Number(pB.basePrice) * 0.9);
    if (Number(snapB.unitPrice) !== expected) {
      throw new Error(
        `할인 적용 실패: expect ${expected} got ${snapB.unitPrice}`,
      );
    }
  }

  // ─── 4) 카테고리 매칭 스냅샷 (제품 A 제외하고 할인만) ─
  const snapDiscOnly = calculatePriceSnapshot({
    basePrice: "100000",
    category: pA.category,
    clientDiscounts: [{ category: pA.category!, discountRate: "0.1" }],
    clientFixedPrice: null,
  });
  console.log(
    `✓ 할인만 적용 스냅샷 (base=100000, 10%): unitPrice=${snapDiscOnly.unitPrice} discountRate=${snapDiscOnly.discountRateAtOrder}`,
  );
  if (Number(snapDiscOnly.unitPrice) !== 90000) {
    throw new Error(`할인 계산 실패: ${snapDiscOnly.unitPrice}`);
  }

  // ─── 5) 청소 ─────────────────────────────────────────────
  await prisma.clientFixedPrice.delete({ where: { id: fixedPrice.id } });
  await prisma.clientDiscount.delete({ where: { id: discount.id } });
  console.log(`✓ 테스트 데이터 삭제 완료`);

  console.log(`\n✅ 가격 규칙 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
