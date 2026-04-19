/**
 * 기간별 영업 이력(Sales History) — Phase 3G-3 (R21) 유틸.
 *
 * 하나의 기간 [from, to] 에 대해 담당자의 모든 영업 활동을 이벤트 스트림으로 집계.
 * 이벤트 유형:
 *   - ORDER_CREATED  (Order.createdAt)
 *   - INVOICE_ISSUED (Invoice.issueDate, status ∈ ISSUED/SENT)
 *   - PAYMENT_RECEIVED (Payment.paidAt, status ∈ PARTIAL/PAID)
 *   - CONFERENCE_VISITOR (ConferenceVisitor.createdAt, assignedRepId 기준)
 *
 * 날짜 범위는 `[from 00:00, to+1day 00:00)` 반열림 구간 — end-of-day 처리.
 */
import { z } from "zod";

export const SALES_EVENT_TYPES = [
  "ORDER_CREATED",
  "INVOICE_ISSUED",
  "PAYMENT_RECEIVED",
  "CONFERENCE_VISITOR",
] as const;
export type SalesEventType = (typeof SALES_EVENT_TYPES)[number];

export const SALES_EVENT_LABEL: Record<SalesEventType, string> = {
  ORDER_CREATED: "주문 접수",
  INVOICE_ISSUED: "명세서 발행",
  PAYMENT_RECEIVED: "수금 확인",
  CONFERENCE_VISITOR: "학회 방문자",
};

export const SALES_EVENT_ICON: Record<SalesEventType, string> = {
  ORDER_CREATED: "📝",
  INVOICE_ISSUED: "🧾",
  PAYMENT_RECEIVED: "💰",
  CONFERENCE_VISITOR: "🎓",
};

export const salesHistoryQuerySchema = z
  .object({
    salesRepId: z.string().cuid(),
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .superRefine((v, ctx) => {
    if (v.from.getTime() > v.to.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "종료일은 시작일 이후여야 합니다.",
      });
    }
  });
export type SalesHistoryQuery = z.infer<typeof salesHistoryQuerySchema>;

/**
 * 주어진 from/to 를 [start, end) 반열림 구간으로 변환.
 *   from 의 자정 00:00 (포함)  ~  to 의 다음날 자정 (제외).
 */
export function dateRangeToWindow(from: Date, to: Date): {
  start: Date;
  end: Date;
} {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * YYYY-MM-DD 문자열 → Date (로컬 자정).
 */
export function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * 이번 달 1일 ~ 오늘 을 기본 기간으로 반환.
 */
export function defaultRange(now: Date = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return { from: ymd(from), to: ymd(to) };
}
