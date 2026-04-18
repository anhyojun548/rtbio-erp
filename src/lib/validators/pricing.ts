/**
 * 거래처 × 가격 규칙 Zod 스키마 (Phase 3D-1).
 *
 * 우선순위 (pricing.ts 와 동일):
 *   ClientFixedPrice > ClientDiscount[category] > Product.basePrice
 *
 * 제약 (pricing-specialist 리뷰 반영):
 * - discountRate ∈ (0, 1) — 0% 할인은 row 생성 무의미, 100% 할인은 무료화라 비즈니스상 금지
 * - fixedPrice >= 0 — 0 허용 (무상공급)
 * - 카테고리/제품 존재 여부는 서버 액션에서 별도 체크 (스키마는 문자열만 검증)
 */
import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// Decimal 입력 — 문자열/숫자 허용, 숫자로 변환된 뒤 refine
const decimalInput = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v), "숫자 형식 오류");

// ─── 할인율 ───────────────────────────────────
export const discountRateSchema = decimalInput
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v), "할인율 소수점 4자리까지만 허용")
  .refine((v) => Number(v) > 0, "할인율은 0 보다 커야 합니다 (0은 row 무의미)")
  .refine((v) => Number(v) < 1, "할인율은 1 미만이어야 합니다 (100% 할인 금지)");

export const clientDiscountUpsertSchema = z.object({
  category: z.string().trim().min(1, "카테고리 필수").max(100),
  discountRate: discountRateSchema,
  note: optionalString,
});
export type ClientDiscountUpsertInput = z.input<typeof clientDiscountUpsertSchema>;

// ─── 고정가 ───────────────────────────────────
export const fixedPriceSchema = decimalInput
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), "금액은 소수점 2자리까지만 허용")
  .refine((v) => Number(v) >= 0, "고정가는 0 이상이어야 합니다");

export const clientFixedPriceUpsertSchema = z.object({
  productId: z.string().trim().min(1, "제품 선택 필수"),
  fixedPrice: fixedPriceSchema,
  note: optionalString,
});
export type ClientFixedPriceUpsertInput = z.input<typeof clientFixedPriceUpsertSchema>;

/**
 * 의심 할인율 판정 (pricing-specialist 권고).
 * - 50% 이상은 ADMIN 이상 role 만 저장 가능 + 감사 로그에 WARN 플래그
 */
export function isSuspiciousDiscount(rate: number): boolean {
  return rate >= 0.5;
}
