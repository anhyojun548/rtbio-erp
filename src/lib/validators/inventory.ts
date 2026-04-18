/**
 * 재고 변동 Zod 스키마.
 *
 * Phase 3C 범위:
 * - receiveSchema: 입고 (qty > 0)
 * - adjustmentSchema: 반품/폐기/실사조정 (qty != 0, reason 별 부호 제약)
 *
 * 3C 에선 SHIP/RESERVE/RELEASE 타입은 직접 조작 금지 — 주문 플로우(3D)에서만 발생.
 */
import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// 조정 사유 — 화이트리스트. "반품" | "폐기" | "실사조정" | "입고보정" 만 허용.
export const ADJUST_REASONS = ["반품", "폐기", "실사조정", "입고보정"] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

export const receiveSchema = z.object({
  productSizeId: z.string().trim().min(1, "사이즈 ID 필수"),
  qty: z.coerce
    .number()
    .int("정수만 허용")
    .positive("입고 수량은 1 이상"),
  note: optionalString,
});
export type ReceiveInput = z.input<typeof receiveSchema>;

export const adjustmentSchema = z
  .object({
    productSizeId: z.string().trim().min(1, "사이즈 ID 필수"),
    qty: z.coerce
      .number()
      .int("정수만 허용")
      .refine((v) => v !== 0, "수량은 0이 될 수 없음"),
    reason: z.enum(ADJUST_REASONS),
    note: optionalString,
    approvedBy: optionalString,
  })
  .superRefine((val, ctx) => {
    // 반품 / 입고보정 은 +qty 여야 한다
    if ((val.reason === "반품" || val.reason === "입고보정") && val.qty <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qty"],
        message: `${val.reason}은 양수만 허용됩니다.`,
      });
    }
    // 폐기 는 -qty 여야 한다
    if (val.reason === "폐기" && val.qty >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qty"],
        message: "폐기는 음수 수량만 허용됩니다.",
      });
    }
    // 실사조정 은 +/- 모두 허용
  });
export type AdjustmentInput = z.input<typeof adjustmentSchema>;
