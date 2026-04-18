/**
 * 가격 계산 로직 (CLAUDE.md 도메인 규칙)
 *
 * 우선순위 (높은 → 낮은):
 *   1. ClientFixedPrice  (거래처 × 제품 고정가)
 *   2. ClientDiscount    (거래처 × 카테고리 할인율)
 *   3. Product.basePrice (기본가)
 *
 * 주문 확정 시점에 계산된 값을 OrderItem 에 스냅샷으로 저장.
 * 추후 제품/할인율 변경이 기존 주문에 영향 주지 않아야 함.
 */
import type { Prisma } from "@prisma/client";

export type PriceSnapshot = {
  unitPrice: Prisma.Decimal | number;
  basePriceAtOrder: Prisma.Decimal | number;
  discountRateAtOrder: Prisma.Decimal | number | null;
  fixedPriceAppliedAtOrder: boolean;
};

export type PriceInputs = {
  basePrice: Prisma.Decimal | number;
  category: string | null;
  clientDiscounts: Array<{ category: string; discountRate: Prisma.Decimal | number }>;
  clientFixedPrice?: Prisma.Decimal | number | null;
};

/**
 * 단가 계산 — 스냅샷 형태로 반환.
 * 호출 측은 그대로 OrderItem 에 저장하면 됨.
 */
export function calculatePriceSnapshot(input: PriceInputs): PriceSnapshot {
  const base = Number(input.basePrice);

  // 1) 고정가 최우선
  if (input.clientFixedPrice != null) {
    return {
      unitPrice: Number(input.clientFixedPrice),
      basePriceAtOrder: base,
      discountRateAtOrder: null,
      fixedPriceAppliedAtOrder: true,
    };
  }

  // 2) 카테고리 할인율
  if (input.category) {
    const match = input.clientDiscounts.find((d) => d.category === input.category);
    if (match) {
      const rate = Number(match.discountRate);
      const unit = base * (1 - rate);
      return {
        unitPrice: roundCurrency(unit),
        basePriceAtOrder: base,
        discountRateAtOrder: rate,
        fixedPriceAppliedAtOrder: false,
      };
    }
  }

  // 3) 기본가
  return {
    unitPrice: base,
    basePriceAtOrder: base,
    discountRateAtOrder: null,
    fixedPriceAppliedAtOrder: false,
  };
}

function roundCurrency(value: number): number {
  // 원 단위 반올림 (내림도 고려 가능)
  return Math.round(value);
}
