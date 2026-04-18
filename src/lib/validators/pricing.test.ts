/**
 * pricing.ts (거래처 가격 규칙) Zod 스키마 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  clientDiscountUpsertSchema,
  clientFixedPriceUpsertSchema,
  discountRateSchema,
  fixedPriceSchema,
  isSuspiciousDiscount,
} from "./pricing";

describe("discountRateSchema", () => {
  it("0.1 허용", () => {
    expect(discountRateSchema.safeParse("0.1").success).toBe(true);
  });

  it("0.9999 허용 (상한 미만)", () => {
    expect(discountRateSchema.safeParse("0.9999").success).toBe(true);
  });

  it("0 거부 (row 무의미)", () => {
    expect(discountRateSchema.safeParse("0").success).toBe(false);
  });

  it("음수 거부", () => {
    expect(discountRateSchema.safeParse("-0.1").success).toBe(false);
  });

  it("1.0 거부 (100% 할인 금지)", () => {
    expect(discountRateSchema.safeParse("1").success).toBe(false);
    expect(discountRateSchema.safeParse("1.0").success).toBe(false);
  });

  it("1 초과 거부", () => {
    expect(discountRateSchema.safeParse("1.5").success).toBe(false);
  });

  it("소수점 5자리 이상 거부", () => {
    expect(discountRateSchema.safeParse("0.12345").success).toBe(false);
  });

  it("숫자 입력 허용", () => {
    expect(discountRateSchema.safeParse(0.15).success).toBe(true);
  });
});

describe("fixedPriceSchema", () => {
  it("양수 허용", () => {
    expect(fixedPriceSchema.safeParse("120000").success).toBe(true);
  });

  it("0 허용 (무상공급)", () => {
    expect(fixedPriceSchema.safeParse("0").success).toBe(true);
  });

  it("음수 거부", () => {
    expect(fixedPriceSchema.safeParse("-100").success).toBe(false);
  });

  it("소수점 2자리까지 허용", () => {
    expect(fixedPriceSchema.safeParse("100.50").success).toBe(true);
  });

  it("소수점 3자리 이상 거부", () => {
    expect(fixedPriceSchema.safeParse("100.123").success).toBe(false);
  });
});

describe("clientDiscountUpsertSchema", () => {
  it("정상 입력 통과", () => {
    const res = clientDiscountUpsertSchema.safeParse({
      category: "관절보조기",
      discountRate: "0.15",
    });
    expect(res.success).toBe(true);
  });

  it("카테고리 필수", () => {
    const res = clientDiscountUpsertSchema.safeParse({
      category: "",
      discountRate: "0.1",
    });
    expect(res.success).toBe(false);
  });

  it("카테고리 공백만 거부", () => {
    const res = clientDiscountUpsertSchema.safeParse({
      category: "   ",
      discountRate: "0.1",
    });
    expect(res.success).toBe(false);
  });

  it("note 빈 문자열은 undefined", () => {
    const res = clientDiscountUpsertSchema.safeParse({
      category: "관절",
      discountRate: "0.1",
      note: "",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBeUndefined();
  });
});

describe("clientFixedPriceUpsertSchema", () => {
  it("정상 입력 통과", () => {
    const res = clientFixedPriceUpsertSchema.safeParse({
      productId: "prod-1",
      fixedPrice: "150000",
    });
    expect(res.success).toBe(true);
  });

  it("productId 필수", () => {
    const res = clientFixedPriceUpsertSchema.safeParse({
      productId: "",
      fixedPrice: "100",
    });
    expect(res.success).toBe(false);
  });

  it("fixedPrice = 0 허용", () => {
    const res = clientFixedPriceUpsertSchema.safeParse({
      productId: "prod-1",
      fixedPrice: "0",
    });
    expect(res.success).toBe(true);
  });
});

describe("isSuspiciousDiscount", () => {
  it("0.5 이상 → true (의심)", () => {
    expect(isSuspiciousDiscount(0.5)).toBe(true);
    expect(isSuspiciousDiscount(0.7)).toBe(true);
    expect(isSuspiciousDiscount(0.99)).toBe(true);
  });

  it("0.5 미만 → false", () => {
    expect(isSuspiciousDiscount(0.49)).toBe(false);
    expect(isSuspiciousDiscount(0.3)).toBe(false);
    expect(isSuspiciousDiscount(0.1)).toBe(false);
  });
});
