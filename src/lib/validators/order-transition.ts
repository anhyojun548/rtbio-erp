/**
 * 주문 상태 전이 (Order Transition) Zod 스키마 — Phase 3D-2b.
 *
 * 상태 머신:
 *   DRAFT ──SUBMIT──▶ SUBMITTED ──CONFIRM──▶ CONFIRMED ──(3D-2c SHIP)──▶ SHIPPING ──▶ COMPLETED
 *                         │             │
 *                         ├──REJECT─────┤──▶ REJECTED (terminal)
 *                         ├──HOLD ──▶ HOLD ──RESUME──▶ SUBMITTED
 *                         └──CANCEL──▶ CANCELLED (RELEASE reserved if was CONFIRMED)
 *
 * 3D-2b-1 ✅ SUBMIT
 * 3D-2b-2 ✅ REJECT · HOLD · RESUME · CANCEL (SUBMITTED/HOLD 만)
 * 3D-2b-3 (이번 커밋): CONFIRM (RESERVE — availableStock 차감) + CANCEL 확장 (CONFIRMED → RELEASE)
 */
import { z } from "zod";

const optionalNote = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/**
 * 필수 사유 (REJECT / HOLD). 3~500자. trim 후 빈 문자열은 거부.
 * - REJECT: 반려 사유 — 거래처/감사 추적에 필수.
 * - HOLD: 보류 사유 — 재고 부족·확인 필요 등.
 */
const requiredReason = z
  .string()
  .trim()
  .min(3, "사유는 3자 이상 입력해주세요.")
  .max(500, "사유는 500자 이내여야 합니다.");

/**
 * SUBMIT (거래처가 주문서 제출 → QC 대기열 진입).
 * - 추가 입력 없음. 선택적 메모는 추후 클라이언트 포털에서 확장.
 */
export const orderSubmitSchema = z.object({
  note: optionalNote,
});
export type OrderSubmitInput = z.input<typeof orderSubmitSchema>;

/**
 * REJECT (QC 가 반려 → REJECTED, terminal).
 * - 허용 출발 상태: SUBMITTED, HOLD.
 * - 재고 영향 없음 (CONFIRMED 전).
 */
export const orderRejectSchema = z.object({
  reason: requiredReason,
});
export type OrderRejectInput = z.input<typeof orderRejectSchema>;

/**
 * HOLD (보류 — SUBMITTED → HOLD).
 * - 재고 영향 없음. 재고 확보 전 상태이므로.
 */
export const orderHoldSchema = z.object({
  reason: requiredReason,
});
export type OrderHoldInput = z.input<typeof orderHoldSchema>;

/**
 * RESUME (HOLD → SUBMITTED 로 복귀).
 * - 이후 다시 CONFIRM/REJECT/HOLD/CANCEL 가능.
 */
export const orderResumeSchema = z.object({
  note: optionalNote,
});
export type OrderResumeInput = z.input<typeof orderResumeSchema>;

/**
 * CANCEL (취소 — CANCELLED, terminal).
 * - SUBMITTED / HOLD → CANCELLED (재고 미영향).
 * - CONFIRMED → CANCELLED (+ RELEASE availableStock, InventoryLog RELEASE).
 * - CANCELLED / REJECTED / COMPLETED / SHIPPING 은 취소 불가.
 */
export const orderCancelSchema = z.object({
  reason: requiredReason,
});
export type OrderCancelInput = z.input<typeof orderCancelSchema>;

/**
 * CONFIRM (SUBMITTED → CONFIRMED).
 * - 각 라인별 availableStock 차감 (RESERVE). physicalStock 은 유지.
 * - 재고 부족 시 전체 트랜잭션 롤백.
 * - InventoryLog type=RESERVE 기록 (라인 수만큼).
 * - `confirmedAt = now()`.
 * - note 선택.
 */
export const orderConfirmSchema = z.object({
  note: optionalNote,
});
export type OrderConfirmInput = z.input<typeof orderConfirmSchema>;
