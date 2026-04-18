/**
 * 월 마감 원장(ClosingLedger) Zod 스키마 — Phase 3D-3b (R09, R10).
 *
 * 도메인:
 *   - `closingMonth`: "YYYY-MM" 포맷.
 *   - 월별/거래처별 유일 (스키마 unique index).
 *   - 필드:
 *       carryOver    = 전월 잔액 (balance)
 *       monthlySales = 당월 발행(ISSUED/SENT) Invoice.totalAmount 의 합
 *       received     = 당월 paidAt 기준 Payment.amount 의 합 (CANCELLED 제외)
 *       balance      = carryOver + monthlySales - received
 *   - 마감(closedAt) 후에는 rebuild 거부. reopenMonth 로 재개.
 *
 * RBAC: TENANT_OWNER / ADMIN.
 */
import { z } from "zod";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const closingMonthField = z
  .string()
  .trim()
  .regex(monthPattern, "closingMonth 은 'YYYY-MM' 형식이어야 합니다.");

/**
 * recomputeLedger — 특정 거래처/월의 원장을 집계 후 upsert.
 * 마감된 원장은 거부 (명시적 reopenMonth 필요).
 */
export const recomputeLedgerSchema = z.object({
  clientId: z.string().cuid(),
  closingMonth: closingMonthField,
});
export type RecomputeLedgerInput = z.input<typeof recomputeLedgerSchema>;

/**
 * recomputeLedgerMonth — 특정 월에 존재하는 모든 거래처 원장을 일괄 재계산.
 */
export const recomputeLedgerMonthSchema = z.object({
  closingMonth: closingMonthField,
});
export type RecomputeLedgerMonthInput = z.input<
  typeof recomputeLedgerMonthSchema
>;

export const closeMonthSchema = z.object({
  clientId: z.string().cuid(),
  closingMonth: closingMonthField,
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});
export type CloseMonthInput = z.input<typeof closeMonthSchema>;

export const reopenMonthSchema = z.object({
  clientId: z.string().cuid(),
  closingMonth: closingMonthField,
  reason: z
    .string()
    .trim()
    .min(3, "사유는 3자 이상 입력해주세요.")
    .max(500),
});
export type ReopenMonthInput = z.input<typeof reopenMonthSchema>;

// ─── 기간 유틸 ─────────────────────────────────────────────

/**
 * "YYYY-MM" → [start(포함), end(미포함)] Date 범위.
 * Postgres 인덱스 활용을 위해 exclusive end 로 반환.
 */
export function monthToRange(closingMonth: string): {
  start: Date;
  end: Date;
} {
  const m = closingMonth.match(monthPattern);
  if (!m) throw new Error(`invalid closingMonth: ${closingMonth}`);
  const year = Number.parseInt(closingMonth.slice(0, 4), 10);
  const month = Number.parseInt(closingMonth.slice(5, 7), 10); // 1-12
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

export function prevMonth(closingMonth: string): string {
  const year = Number.parseInt(closingMonth.slice(0, 4), 10);
  const month = Number.parseInt(closingMonth.slice(5, 7), 10);
  const pm = month === 1 ? 12 : month - 1;
  const py = month === 1 ? year - 1 : year;
  return `${py}-${String(pm).padStart(2, "0")}`;
}
