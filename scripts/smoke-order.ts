/**
 * Phase 3D-2a 주문 DRAFT 스모크 테스트.
 *
 * 시나리오:
 *   1) 활성 거래처 + 활성 제품사이즈 조회
 *   2) 가격 스냅샷 미리 계산해 Order + OrderItem 생성
 *   3) OrderItem 추가 (라인 하나 더)
 *   4) OrderItem 수량 변경
 *   5) 생성된 주문 조회 → 금액/스냅샷 검증
 *   6) DRAFT 삭제 (Cascade 로 라인도 삭제되는지 확인)
 *
 * NOTE: requireRole 을 우회하여 prisma 로 직접 CRUD — DB 파이프라인만 검증.
 * 실제 Server Action 경로는 UI / 수동 테스트로 확인.
 *
 * 실행: `npx tsx scripts/smoke-order.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { calculatePriceSnapshot } from "../src/lib/pricing";

function draftOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `DRAFT-${rand}`;
}

async function main() {
  // ─── 1) 활성 거래처 + 사이즈 ────────────────────────────────
  const client = await prisma.client.findFirst({ where: { active: true } });
  if (!client) throw new Error("활성 거래처 없음");

  const sizes = await prisma.productSize.findMany({
    where: { product: { active: true } },
    take: 2,
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          basePrice: true,
          category: true,
        },
      },
    },
  });
  if (sizes.length < 2) throw new Error("활성 사이즈가 2개 이상 필요");
  const [s1, s2] = sizes;
  if (!s1 || !s2) throw new Error("unreachable");

  console.log(
    `거래처: ${client.name}(${client.code})\n사이즈1: ${s1.product.name}/${s1.sizeCode} base=${s1.product.basePrice}\n사이즈2: ${s2.product.name}/${s2.sizeCode} base=${s2.product.basePrice}`,
  );

  // ─── 2) 첫 라인 스냅샷 계산 ─────────────────────────────────
  const [discounts, fixedPrices] = await Promise.all([
    prisma.clientDiscount.findMany({
      where: { clientId: client.id },
      select: { category: true, discountRate: true },
    }),
    prisma.clientFixedPrice.findMany({
      where: { clientId: client.id, productId: { in: [s1.product.id, s2.product.id] } },
      select: { productId: true, fixedPrice: true },
    }),
  ]);
  const fixedByPid = new Map(fixedPrices.map((f) => [f.productId, f.fixedPrice]));

  function snapFor(
    product: { basePrice: Prisma.Decimal; category: string | null; id: string },
  ) {
    return calculatePriceSnapshot({
      basePrice: product.basePrice,
      category: product.category,
      clientDiscounts: discounts.map((d) => ({
        category: d.category,
        discountRate: d.discountRate,
      })),
      clientFixedPrice: fixedByPid.get(product.id) ?? null,
    });
  }

  const snap1 = snapFor(s1.product);
  const qty1 = 2;
  const unitPrice1 = new Prisma.Decimal(Number(snap1.unitPrice).toFixed(2));
  const base1 = new Prisma.Decimal(Number(snap1.basePriceAtOrder).toFixed(2));
  const disc1 =
    snap1.discountRateAtOrder === null
      ? null
      : new Prisma.Decimal(Number(snap1.discountRateAtOrder).toFixed(4));

  // ─── 3) Order + 첫 라인 생성 ────────────────────────────────
  const created = await prisma.order.create({
    data: {
      orderNumber: draftOrderNumber(),
      clientId: client.id,
      status: "DRAFT",
      orderDate: new Date(),
      note: "smoke-order.ts",
      items: {
        create: [
          {
            productId: s1.product.id,
            productSizeId: s1.id,
            quantity: qty1,
            unitPrice: unitPrice1,
            basePriceAtOrder: base1,
            discountRateAtOrder: disc1,
            fixedPriceAppliedAtOrder: snap1.fixedPriceAppliedAtOrder,
            lineTotal: unitPrice1.mul(qty1),
          },
        ],
      },
    },
    include: { items: true },
  });
  console.log(
    `✓ DRAFT 생성: ${created.orderNumber} (id=${created.id}) / 라인 ${created.items.length}개`,
  );

  const firstItem = created.items[0];
  if (!firstItem) throw new Error("라인이 비어있음");
  if (firstItem.quantity !== qty1)
    throw new Error(`qty 불일치: ${firstItem.quantity}`);
  if (!firstItem.lineTotal.equals(unitPrice1.mul(qty1)))
    throw new Error(`lineTotal 불일치`);

  // ─── 4) 두번째 라인 추가 ────────────────────────────────────
  const snap2 = snapFor(s2.product);
  const qty2 = 3;
  const unitPrice2 = new Prisma.Decimal(Number(snap2.unitPrice).toFixed(2));
  const base2 = new Prisma.Decimal(Number(snap2.basePriceAtOrder).toFixed(2));
  const disc2 =
    snap2.discountRateAtOrder === null
      ? null
      : new Prisma.Decimal(Number(snap2.discountRateAtOrder).toFixed(4));
  const line2 = await prisma.orderItem.create({
    data: {
      orderId: created.id,
      productId: s2.product.id,
      productSizeId: s2.id,
      quantity: qty2,
      unitPrice: unitPrice2,
      basePriceAtOrder: base2,
      discountRateAtOrder: disc2,
      fixedPriceAppliedAtOrder: snap2.fixedPriceAppliedAtOrder,
      lineTotal: unitPrice2.mul(qty2),
    },
  });
  console.log(
    `✓ 두번째 라인 추가: unit=${line2.unitPrice} qty=${line2.quantity} total=${line2.lineTotal}`,
  );

  // ─── 5) 수량 변경 (unitPrice 유지, lineTotal 재계산) ────────
  const newQty = 5;
  const updated = await prisma.orderItem.update({
    where: { id: firstItem.id },
    data: { quantity: newQty, lineTotal: firstItem.unitPrice.mul(newQty) },
  });
  if (updated.quantity !== newQty) throw new Error("수량 업데이트 실패");
  if (!updated.lineTotal.equals(firstItem.unitPrice.mul(newQty)))
    throw new Error("lineTotal 재계산 실패");
  console.log(`✓ 수량 변경: ${qty1} → ${newQty}, lineTotal=${updated.lineTotal}`);

  // ─── 6) 전체 합계 검증 ──────────────────────────────────────
  const full = await prisma.order.findUnique({
    where: { id: created.id },
    include: { items: true },
  });
  if (!full) throw new Error("주문 조회 실패");
  const total = full.items.reduce((s, l) => s + Number(l.lineTotal), 0);
  console.log(
    `✓ 최종 라인 ${full.items.length}개 / 합계 ${total.toLocaleString()}원`,
  );

  // ─── 7) DRAFT 삭제 (OrderItem Cascade) ──────────────────────
  await prisma.order.delete({ where: { id: created.id } });
  const leftover = await prisma.orderItem.findMany({
    where: { orderId: created.id },
  });
  if (leftover.length > 0)
    throw new Error(`Cascade 실패 — ${leftover.length}개 라인 잔존`);
  console.log(`✓ DRAFT 삭제 + Cascade 검증 (라인 0개 잔존)`);

  console.log(`\n✅ 주문 DRAFT 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
