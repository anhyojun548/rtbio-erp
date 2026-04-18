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
 * 3D-2b-1 (이번 커밋): SUBMIT 만 구현.
 *   - DRAFT → SUBMITTED
 *   - 임시 orderNumber(DRAFT-xxx) → 공식 `ORD-YYYYMMDD-NNN` 재발급
 *   - 가격 재스냅샷 (현시점 pricing.ts 로 재계산)
 *   - 재고 변동 없음
 */
import { z } from "zod";

const optionalNote = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/**
 * SUBMIT (거래처가 주문서 제출 → QC 대기열 진입).
 * - 추가 입력 없음. 선택적 메모는 추후 클라이언트 포털에서 확장.
 */
export const orderSubmitSchema = z.object({
  note: optionalNote,
});
export type OrderSubmitInput = z.input<typeof orderSubmitSchema>;
