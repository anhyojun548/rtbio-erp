/**
 * 출고 (Shipment) Zod 스키마 — Phase 3D-2c.
 *
 * 출고 수명주기:
 *   Order.CONFIRMED ──startShipment──▶ Shipment 생성 (첫 번째 KanbanColumn 에 진입)
 *                                       │  Order.status=SHIPPING
 *                                       ▼
 *              moveShipmentStage (다음 스테이지로 이동; fromStageId → toStageId 기록)
 *                                       │
 *                                       ▼ (isTerminal=true 에 도달하면 자동 완료)
 *                                   Shipment.completedAt = now()
 *                                   Order.status = COMPLETED, completedAt
 *                                   각 라인 physicalStock -= quantity (SHIP)
 *                                   availableStock 은 CONFIRM 때 이미 예약 차감된 상태이므로 불변
 *
 * 보조 전이:
 *   - holdShipment(reason): Shipment.holdReason 설정 (주문 상태는 그대로)
 *   - resumeShipment(): Shipment.holdReason = null
 *
 * 감사:
 *   - SHIPMENT_START / SHIPMENT_MOVE / SHIPMENT_COMPLETE / SHIPMENT_HOLD / SHIPMENT_RESUME
 *   - ShipmentStageLog 에 단계 이동 이력 (DB 레벨)
 *   - InventoryLog type=SHIP 에 physicalStock 차감 이력
 */
import { z } from "zod";

const optionalNote = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const requiredReason = z
  .string()
  .trim()
  .min(3, "사유는 3자 이상 입력해주세요.")
  .max(500, "사유는 500자 이내여야 합니다.");

const cuid = z.string().min(1, "id는 필수입니다.");

/**
 * startShipment — Order.CONFIRMED → SHIPPING + Shipment 생성.
 * - orderId 는 라우트 파라미터로 받고 body 에는 note 만.
 * - 첫 번째 KanbanColumn(sortOrder=1) 에 자동 진입.
 */
export const startShipmentSchema = z.object({
  note: optionalNote,
});
export type StartShipmentInput = z.input<typeof startShipmentSchema>;

/**
 * moveShipmentStage — Shipment 단계 이동.
 * - toStageId 는 KanbanColumn.id.
 * - 같은 단계로의 이동은 거부 (액션 레이어에서 검증).
 * - toStageId 가 isTerminal=true 면 자동으로 완료 처리 → physicalStock 차감.
 */
export const moveShipmentStageSchema = z.object({
  toStageId: cuid,
  note: optionalNote,
});
export type MoveShipmentStageInput = z.input<typeof moveShipmentStageSchema>;

/**
 * holdShipment — 출고 보류 (출고 단계에서 재고·품질 이슈 발견 등).
 * - Order 는 SHIPPING 유지. Shipment.holdReason 에 사유 저장.
 * - 보류는 재고 변동을 유발하지 않음 (RESERVE 는 유지, SHIP 은 아직 안 한 상태).
 */
export const holdShipmentSchema = z.object({
  reason: requiredReason,
});
export type HoldShipmentInput = z.input<typeof holdShipmentSchema>;

/**
 * resumeShipment — 보류 해제.
 * - Shipment.holdReason = null. 스테이지는 그대로.
 */
export const resumeShipmentSchema = z.object({
  note: optionalNote,
});
export type ResumeShipmentInput = z.input<typeof resumeShipmentSchema>;
