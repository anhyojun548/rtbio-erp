/**
 * 유통기한 로트(ExpiryLot) Zod 스키마 — Phase 3D-4a (R19).
 *
 * 도메인 규칙:
 *   - 로트(Lot)는 제품 사이즈(ProductSize) 단위로 추적.
 *   - 하나의 사이즈에 여러 로트가 공존할 수 있음 (예: 입고 배치별로 다른 유통기한).
 *   - `quantity` 는 입고 시 최초 수량 (불변).
 *   - `remainingQty` 는 현재 남은 수량 (출고·폐기로 감소).
 *   - 합계(모든 로트의 remainingQty) 가 `ProductSize.physicalStock` 과 항상 일치할 필요는 없음
 *     — 로트가 등록되지 않은 기존 재고도 허용. 경영지원이 점진 등록.
 *   - `expiryDate` 과거 날짜도 허용 (이미 만료된 로트 수기 기록 가능).
 */
import { z } from "zod";

const lotNumberField = z
  .string()
  .trim()
  .min(1, "로트 번호를 입력해주세요.")
  .max(50, "로트 번호는 50자 이내여야 합니다.");

const quantityField = z
  .coerce.number()
  .int("수량은 정수여야 합니다.")
  .positive("수량은 1 이상이어야 합니다.")
  .max(1_000_000, "수량이 너무 큽니다.");

const noteField = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

/**
 * 로트 생성 — 입고 시점 또는 수기 등록.
 * quantity · remainingQty 를 같은 값으로 초기화 (액션 내부에서 처리).
 */
export const createExpiryLotSchema = z.object({
  productSizeId: z.string().cuid("유효한 사이즈 ID 가 필요합니다."),
  lotNumber: lotNumberField,
  expiryDate: z.coerce.date(),
  quantity: quantityField,
  note: noteField,
});
export type CreateExpiryLotInput = z.input<typeof createExpiryLotSchema>;

/**
 * 로트 업데이트 — 주로 `remainingQty` 와 `note` 조정.
 * quantity 는 감사 목적상 수정 불가 (재작성 필요 시 삭제 후 재생성).
 */
export const updateExpiryLotSchema = z.object({
  lotNumber: lotNumberField.optional(),
  expiryDate: z.coerce.date().optional(),
  remainingQty: z
    .coerce.number()
    .int("수량은 정수여야 합니다.")
    .nonnegative("수량은 0 이상이어야 합니다.")
    .max(1_000_000)
    .optional(),
  note: noteField,
});
export type UpdateExpiryLotInput = z.input<typeof updateExpiryLotSchema>;

// ─── 만료 단계 계산 ─────────────────────────────────────────

/**
 * 유통기한 임박 단계. 대시보드 배지/정렬에 사용.
 *   EXPIRED   : 이미 지남
 *   URGENT    : 30일 이내
 *   SOON      : 90일 이내
 *   SAFE      : 90일 초과
 */
export type ExpiryStage = "EXPIRED" | "URGENT" | "SOON" | "SAFE";

export function classifyExpiry(
  expiryDate: Date,
  now: Date = new Date(),
): { stage: ExpiryStage; daysLeft: number } {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const diffMs = expiryDate.getTime() - now.getTime();
  const daysLeft = Math.floor(diffMs / MS_PER_DAY);
  let stage: ExpiryStage;
  if (daysLeft < 0) stage = "EXPIRED";
  else if (daysLeft <= 30) stage = "URGENT";
  else if (daysLeft <= 90) stage = "SOON";
  else stage = "SAFE";
  return { stage, daysLeft };
}
