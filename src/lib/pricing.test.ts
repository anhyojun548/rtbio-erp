/**
 * pricing 단위 테스트 — CLAUDE.md 가격 규칙 검증
 */
import { describe, expect, it } from "vitest";
import { calculatePriceSnapshot } from "./pricing";

describe("calculatePriceSnapshot", () => {
  it("고정가가 있으면 최우선으로 적용된다", () => {
    const snap = calculatePriceSnapshot({
      basePrice: 100000,
      category: "관절",
      clientDiscounts: [{ category: "관절", discountRate: 0.2 }],
      clientFixedPrice: 80000,
    });
    expect(snap.unitPrice).toBe(80000);
    expect(snap.fixedPriceAppliedAtOrder).toBe(true);
    expect(snap.discountRateAtOrder).toBeNull();
  });

  it("고정가 없고 카테고리 할인율 있으면 할인 적용", () => {
    const snap = calculatePriceSnapshot({
      basePrice: 100000,
      category: "관절",
      clientDiscounts: [{ category: "관절", discountRate: 0.15 }],
    });
    expect(snap.unitPrice).toBe(85000);
    expect(snap.discountRateAtOrder).toBe(0.15);
    expect(snap.fixedPriceAppliedAtOrder).toBe(false);
  });

  it("둘 다 없으면 기본가 그대로", () => {
    const snap = calculatePriceSnapshot({
      basePrice: 50000,
      category: "봉합",
      clientDiscounts: [],
    });
    expect(snap.unitPrice).toBe(50000);
    expect(snap.discountRateAtOrder).toBeNull();
    expect(snap.fixedPriceAppliedAtOrder).toBe(false);
  });

  it("카테고리 불일치 시 할인 미적용", () => {
    const snap = calculatePriceSnapshot({
      basePrice: 100000,
      category: "심혈관",
      clientDiscounts: [{ category: "관절", discountRate: 0.2 }],
    });
    expect(snap.unitPrice).toBe(100000);
    expect(snap.discountRateAtOrder).toBeNull();
  });

  it("basePriceAtOrder 는 항상 원본 basePrice 를 기록한다", () => {
    const snap = calculatePriceSnapshot({
      basePrice: 123456,
      category: null,
      clientDiscounts: [],
    });
    expect(snap.basePriceAtOrder).toBe(123456);
  });
});
