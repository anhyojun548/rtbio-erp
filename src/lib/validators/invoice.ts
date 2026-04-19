/**
 * 거래명세서 (Invoice) Zod 스키마 — Phase 3D-3a.
 *
 * 수명주기:
 *   DRAFT ──issueInvoice──▶ ISSUED ──(외부 발송/수동)──▶ SENT
 *      │                       │
 *      └──cancelInvoice────────┴──▶ CANCELLED (terminal)
 *
 * 생성 규칙:
 *   - 주문(Order.status=COMPLETED) 에서만 거래명세서 생성.
 *   - 주문의 OrderItem 을 InvoiceItem 에 복제 (제품코드·사이즈·단가·수량·금액).
 *   - 공급가액 = Σ lineTotal. VAT = round(공급가액 × 0.1). 총액 = 공급가액 + VAT. (R18)
 *   - 한 주문당 활성 거래명세서는 1건 (CANCELLED 제외). — 앱 로직으로 보장.
 *
 * invoiceNumber 채번 (ISSUED 시):
 *   - `INV-YYYYMMDD-NNN` 포맷.
 *   - Postgres advisory lock + 같은 prefix 최대 seq 조회 (orderNumber 와 동일 패턴).
 *
 * RBAC: TENANT_OWNER / ADMIN (거래명세서 발급은 경영지원 고유 업무).
 */
import { z } from "zod";

const optionalNote = z
  .string()
  .trim()
  .max(1000)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const requiredReason = z
  .string()
  .trim()
  .min(3, "사유는 3자 이상 입력해주세요.")
  .max(500, "사유는 500자 이내여야 합니다.");

/**
 * createInvoiceFromOrder — 주문 → DRAFT 거래명세서 생성.
 * - `issueDate`: 발행(예정)일. 기본값은 서버에서 now() 사용.
 * - `dueDate`: 지급기한 (선택).
 * - `note`: 비고.
 */
export const createInvoiceFromOrderSchema = z.object({
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  note: optionalNote,
});
export type CreateInvoiceFromOrderInput = z.input<
  typeof createInvoiceFromOrderSchema
>;

/**
 * updateInvoiceDraft — DRAFT 상태의 Invoice 에서 issueDate/dueDate/note 만 수정.
 * 라인/금액은 불변 (주문 스냅샷이 원본).
 */
export const updateInvoiceDraftSchema = z.object({
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  note: optionalNote,
});
export type UpdateInvoiceDraftInput = z.input<typeof updateInvoiceDraftSchema>;

/**
 * issueInvoice — DRAFT → ISSUED.
 * - invoiceNumber 채번 (INV-YYYYMMDD-NNN).
 * - issueDate 재확정 (원하면 덮어쓰기).
 */
export const issueInvoiceSchema = z.object({
  issueDate: z.coerce.date().optional(),
});
export type IssueInvoiceInput = z.input<typeof issueInvoiceSchema>;

/**
 * markInvoiceSent — ISSUED → SENT (외부 발송 완료 표시).
 * - sentAt = now() 자동. note 선택.
 */
export const markInvoiceSentSchema = z.object({
  note: optionalNote,
});
export type MarkInvoiceSentInput = z.input<typeof markInvoiceSentSchema>;

/**
 * cancelInvoice — DRAFT / ISSUED / SENT → CANCELLED.
 * - 이미 취소된 건은 거부.
 * - 재고/주문 상태는 건드리지 않음 (invoice 는 회계 표현, 실물 재고와 별개).
 */
export const cancelInvoiceSchema = z.object({
  reason: requiredReason,
});
export type CancelInvoiceInput = z.input<typeof cancelInvoiceSchema>;

// ─── 금액 계산 유틸 ─────────────────────────────────────────

/**
 * VAT 반올림 (R18).
 *   supply: 공급가액 (Decimal 호환 숫자 문자열 또는 number)
 *   rate:   부가세율 (기본값 0.10 = 10%). TenantSetting.vat_rate 로 덮어쓸 수 있음.
 *   returns: { vat, total } — 모두 소수점 둘째 자리 반올림.
 *
 * 규칙:
 *   - VAT = round(supply × rate, 2) — 금융 반올림 (half away from zero).
 *   - total = supply + vat.
 *
 * 계산을 순수 함수로 뽑은 이유: 단위 테스트에서 스키마/DB 없이 검증하기 위함.
 */
export function calcVatTotal(
  supply: number,
  rate = 0.1,
): { vat: number; total: number } {
  const vatRaw = supply * rate;
  // toFixed 는 half-away-from-zero 가 아닌 banker's rounding 이슈 회피 위해 Math.round 사용
  const vat = Math.round(vatRaw * 100) / 100;
  const total = Math.round((supply + vat) * 100) / 100;
  return { vat, total };
}
