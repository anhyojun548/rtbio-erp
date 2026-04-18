/**
 * 수금(Payment) + 은행 입금(BankTransaction) Zod 스키마 — Phase 3D-3b (R12).
 *
 * 도메인 규칙:
 *   - Payment 는 거래처 단위(Client) 로 기록. 특정 Invoice 에 직접 연결 X — 월단위 원장에서 집계.
 *     (스키마상 Payment.clientId 만 있고 invoiceId 없음.)
 *   - status: PENDING → PARTIAL → PAID (또는 OVERDUE).
 *     앱 로직에선 입력 시 method/amount 만 받고 status 는 사용자가 명시 (또는 PAID 기본).
 *   - method: "계좌이체" | "카드" | "현금" | "기타" 등 자유문자열.
 *   - BankTransaction: 은행 입금 수기 입력 → 이후 Payment 에 매칭(FK) 시 matched=true.
 *
 * Matching 플로우:
 *   1) 경영지원이 은행 거래 내역을 보고 BankTransaction 레코드 수기 생성.
 *   2) 관련 거래처/월의 Payment 를 찾아 matchBankTransaction 으로 연결.
 *   3) 매칭된 BankTransaction.matched = true, Payment.bankTxnId = bankTxn.id.
 *
 * RBAC: TENANT_OWNER / ADMIN.
 */
import { z } from "zod";

const optionalNote = z
  .string()
  .trim()
  .max(1000)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const positiveAmount = z
  .coerce
  .number()
  .positive("금액은 0보다 커야 합니다.")
  .max(1_000_000_000_000, "금액이 너무 큽니다.");

const PAYMENT_STATUSES = ["PENDING", "PARTIAL", "PAID", "OVERDUE"] as const;
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatusLiteral = (typeof PAYMENT_STATUSES)[number];

/**
 * recordPayment — 수금(입금) 레코드 생성.
 * - status 기본 PAID (경영지원이 은행 내역 확인 후 입력하는 것이 일반적).
 * - bankTxnId 를 동시에 주면 해당 BankTransaction 도 matched=true 로 전환 (액션 내부에서 처리).
 */
export const recordPaymentSchema = z.object({
  clientId: z.string().cuid("유효한 거래처 ID 가 필요합니다."),
  amount: positiveAmount,
  paidAt: z.coerce.date(),
  method: z.string().trim().min(1, "결제수단을 입력해주세요.").max(40),
  status: paymentStatusSchema.optional(), // default = PAID (액션 단에서 기본값 세팅)
  bankTxnId: z.string().cuid().optional(),
  note: optionalNote,
});
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

/**
 * updatePayment — 금액/메서드/상태/비고 수정.
 * bankTxnId 재매핑은 별도 액션(matchBankTransaction / unmatchBankTransaction).
 */
export const updatePaymentSchema = z.object({
  amount: positiveAmount.optional(),
  paidAt: z.coerce.date().optional(),
  method: z.string().trim().min(1).max(40).optional(),
  status: paymentStatusSchema.optional(),
  note: optionalNote,
});
export type UpdatePaymentInput = z.input<typeof updatePaymentSchema>;

export const cancelPaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "사유는 3자 이상 입력해주세요.")
    .max(500, "사유는 500자 이내여야 합니다."),
});
export type CancelPaymentInput = z.input<typeof cancelPaymentSchema>;

/**
 * createBankTransaction — 은행 입금 수기 입력.
 * reference: 비고/참조번호 (이체 메모).
 */
export const createBankTxnSchema = z.object({
  bankName: z.string().trim().min(1, "은행명을 입력해주세요.").max(30),
  payer: z.string().trim().min(1, "입금자명을 입력해주세요.").max(40),
  amount: positiveAmount,
  txnDate: z.coerce.date(),
  reference: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});
export type CreateBankTxnInput = z.input<typeof createBankTxnSchema>;

export const updateBankTxnSchema = createBankTxnSchema.partial();
export type UpdateBankTxnInput = z.input<typeof updateBankTxnSchema>;

/**
 * matchBankTransaction — BankTransaction 을 Payment 에 연결.
 * 이미 매칭된 은행 거래는 거부 (unmatch 후 재매칭).
 */
export const matchBankTxnSchema = z.object({
  paymentId: z.string().cuid("유효한 수금 ID 가 필요합니다."),
});
export type MatchBankTxnInput = z.input<typeof matchBankTxnSchema>;
