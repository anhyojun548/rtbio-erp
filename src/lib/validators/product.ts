/**
 * 제품/사이즈 Zod 스키마 — 서버 액션 공통.
 *
 * 도메인 규칙:
 * - code (제품코드) 는 테넌트 내 unique
 * - basePrice 는 Decimal(12,2) — 문자열/숫자 모두 허용, 음수 금지
 * - expiryMonths 는 optional Int (유통기한, R19)
 * - sizeCode 는 제품 내 unique (예: "S", "M", "12x8")
 * - physicalStock, availableStock 은 0 이상 Int (재고 음수 금지)
 * - reorderPoint 는 재고 알람 기준 (R14) — optional
 */
import { z } from "zod";

// 빈 문자열을 undefined 로 정규화 — 폼에서 미입력 필드는 "" 로 오는데 DB 엔 null 로 저장 하기 위해.
const optionalString = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// Decimal 은 string/number 모두 허용하여 폼에서 편하게 입력
const decimalInput = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v), "금액 형식 오류 (소수점 2자리까지)")
  .refine((v) => Number(v) >= 0, "금액은 0 이상이어야 합니다");

// UDI-DI 14자리 (GS1 표준) — 숫자만 14자
const udiCodeInput = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine(
    (v) => v === undefined || /^\d{14}$/.test(v),
    "UDI-DI 는 14자리 숫자여야 합니다 (예: 08801234567890)",
  );

/**
 * UDI-DI 14자리 GS1 체크 디지트 검증.
 * 마지막 자리는 앞 13자리로 계산한 mod-10 체크 디지트.
 *  - 홀수 위치 ×3 + 짝수 위치 ×1 합계 → 10 보수
 */
export function isValidUdiCheckDigit(udiCode: string): boolean {
  if (!/^\d{14}$/.test(udiCode)) return false;
  const digits = udiCode.split("").map(Number);
  const check = digits[13];
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = digits[i]!;
    // 0-indexed 기준 짝수 위치(i=0,2,...,12) ×3
    sum += i % 2 === 0 ? d * 3 : d;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}

// ─── 제품 (Product) ───
export const productCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "제품 코드는 2자 이상")
    .max(32, "제품 코드는 32자 이하")
    .regex(/^[A-Z0-9\-_]+$/, "대문자/숫자/-/_ 만 허용"),
  name: z.string().trim().min(1, "제품명 필수").max(120),
  brand: optionalString,
  category: optionalString,
  part: optionalString,
  basePrice: decimalInput,
  expiryMonths: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v > 0 && v <= 600),
      "유통기한은 1~600개월 정수",
    ),
  // UDI 등록 정보 (선택, 등록된 제품만)
  udiCode: udiCodeInput,
  udiRegisteredAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }),
  udiCertificateUrl: optionalString,
});
export type ProductCreateInput = z.input<typeof productCreateSchema>;
export type ProductCreateParsed = z.output<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema.partial().extend({
  active: z.boolean().optional(),
});
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;

// ─── 제품 사이즈 (ProductSize) ───
export const productSizeCreateSchema = z.object({
  sizeCode: z
    .string()
    .trim()
    .min(1, "사이즈 코드 필수")
    .max(32, "사이즈 코드는 32자 이하"),
  physicalStock: z.coerce.number().int().min(0, "재고는 0 이상").default(0),
  availableStock: z.coerce.number().int().min(0, "가용재고는 0 이상").default(0),
  reorderPoint: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 0),
      "알람 기준은 0 이상 정수",
    ),
});
export type ProductSizeCreateInput = z.input<typeof productSizeCreateSchema>;

export const productSizeUpdateSchema = productSizeCreateSchema.partial();
export type ProductSizeUpdateInput = z.input<typeof productSizeUpdateSchema>;
