/**
 * 주문 (Order) / 주문 라인 (OrderItem) Zod 스키마 (Phase 3D-2a).
 *
 * 이 단계(DRAFT) 스코프:
 * - 거래처 선택 + 배송지 선택/임시주소 + 희망배송일 + 메모
 * - 라인 추가/수정 (productSizeId + quantity)
 *
 * 다음 단계(3D-2b) 에서 확장:
 * - 상태 전환 (SUBMIT/CONFIRM/REJECT/CANCEL)
 * - orderNumber 정식 채번
 * - 가격 스냅샷 잠금 (FOR SHARE)
 */
import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalShortString = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// ISO 날짜 (YYYY-MM-DD) — 폼에서 오는 값 허용
const dateInput = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine(
    (v) => v instanceof Date && !Number.isNaN(v.getTime()),
    "올바른 날짜가 아닙니다",
  );

const optionalDateInput = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    return v instanceof Date ? v : new Date(v);
  })
  .refine(
    (v) => v === undefined || (v instanceof Date && !Number.isNaN(v.getTime())),
    "올바른 날짜가 아닙니다",
  );

// ─── 배송지 서브스키마 ──────────────────────────────────────
//
// 두 경로 허용:
//   (a) shipToAddressId 제공 → 서버에서 ClientAddress 조회 후 스냅샷 주입
//   (b) shipToAddressId 없이 shipTo* 직접 입력 (임시 주소)
export const shipToSchema = z.object({
  shipToAddressId: optionalShortString, // 선택 시 서버가 ClientAddress 에서 스냅샷 주입
  shipToLabel: optionalShortString,
  shipToRecipient: optionalShortString,
  shipToPhone: optionalShortString,
  shipToPostalCode: optionalShortString,
  shipToAddress: optionalShortString,
  shipToAddressDetail: optionalShortString,
  shipToMemo: optionalString,
  shipMethod: optionalShortString, // 택배/방문수령/퀵
});

// ─── 주문 라인 ─────────────────────────────────────────────
export const orderItemCreateSchema = z.object({
  productSizeId: z.string().trim().min(1, "사이즈 ID 필수"),
  quantity: z.coerce
    .number()
    .int("정수만 허용")
    .positive("수량은 1 이상이어야 합니다"),
});
export type OrderItemCreateInput = z.input<typeof orderItemCreateSchema>;

export const orderItemUpdateSchema = z.object({
  quantity: z.coerce
    .number()
    .int("정수만 허용")
    .positive("수량은 1 이상이어야 합니다"),
});
export type OrderItemUpdateInput = z.input<typeof orderItemUpdateSchema>;

// ─── 주문 헤더 ─────────────────────────────────────────────
export const orderCreateSchema = shipToSchema.extend({
  clientId: z.string().trim().min(1, "거래처 필수"),
  orderDate: dateInput,
  requestedDate: optionalDateInput,
  note: optionalString,
  items: z
    .array(orderItemCreateSchema)
    .min(1, "최소 1개 이상의 라인이 필요합니다"),
});
export type OrderCreateInput = z.input<typeof orderCreateSchema>;

/**
 * 업데이트는 헤더만 수정 (라인은 별도 액션으로 CRUD).
 * clientId 는 DRAFT 단계에서도 변경 금지 — 가격 규칙이 달라지기 때문.
 */
export const orderUpdateSchema = shipToSchema.extend({
  orderDate: optionalDateInput,
  requestedDate: optionalDateInput,
  note: optionalString,
});
export type OrderUpdateInput = z.input<typeof orderUpdateSchema>;
