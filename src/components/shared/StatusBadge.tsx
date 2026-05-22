/**
 * StatusBadge — 주문/명세서/배송 등 상태 배지
 *
 * 사용:
 *   <StatusBadge status="SUBMITTED" />
 *   <StatusBadge status="OUT_OF_STOCK" variant="stock" />
 *
 * prototype 의 .badge-* 클래스를 일관된 React 컴포넌트로 변환.
 */

export type OrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CONFIRMED"
  | "SHIPPING"
  | "COMPLETED"
  | "HELD"
  | "REJECTED"
  | "CANCELLED";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "SENT" | "CANCELLED";

export type StockLevel = "OUT" | "LOW" | "OK";

export type ExpiryLevel = "EXPIRED" | "URGENT" | "SOON" | "SAFE";

export type ContractStatus = "ACTIVE" | "ENDING_SOON" | "EXPIRED" | "FUTURE";

// ── 매핑 ────────────────────────────────────────────────
const ORDER_META: Record<OrderStatus, { label: string; bg: string; color: string }> = {
  DRAFT:     { label: "임시",   bg: "#F3F4F6", color: "#6B7280" },
  SUBMITTED: { label: "접수",   bg: "#DBEAFE", color: "#1E40AF" },
  CONFIRMED: { label: "확정",   bg: "#CFFAFE", color: "#0E7490" },
  SHIPPING:  { label: "출고중", bg: "#EDE9FE", color: "#6D28D9" },
  COMPLETED: { label: "완료",   bg: "#D1FAE5", color: "#047857" },
  HELD:      { label: "보류",   bg: "#FFF3E0", color: "#B45309" },
  REJECTED:  { label: "반려",   bg: "#FFEBEE", color: "#C62828" },
  CANCELLED: { label: "취소",   bg: "#F3F4F6", color: "#9CA3AF" },
};

const INVOICE_META: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  DRAFT:     { label: "초안",     bg: "#F3F4F6", color: "#6B7280" },
  ISSUED:    { label: "발행",     bg: "#DBEAFE", color: "#1E40AF" },
  SENT:      { label: "발송완료", bg: "#D1FAE5", color: "#047857" },
  CANCELLED: { label: "취소",     bg: "#F3F4F6", color: "#9CA3AF" },
};

const STOCK_META: Record<StockLevel, { label: string; bg: string; color: string }> = {
  OUT: { label: "품절", bg: "#FFEBEE", color: "#C62828" },
  LOW: { label: "부족", bg: "#FFF3E0", color: "#B45309" },
  OK:  { label: "정상", bg: "#D1FAE5", color: "#047857" },
};

const EXPIRY_META: Record<ExpiryLevel, { label: string; bg: string; color: string }> = {
  EXPIRED: { label: "만료",     bg: "#FFEBEE", color: "#C62828" },
  URGENT:  { label: "임박",     bg: "#FFF3E0", color: "#B45309" },
  SOON:    { label: "주의",     bg: "#FEF3C7", color: "#92400E" },
  SAFE:    { label: "안전",     bg: "#D1FAE5", color: "#047857" },
};

const CONTRACT_META: Record<ContractStatus, { label: string; bg: string; color: string }> = {
  ACTIVE:       { label: "활성",     bg: "#D1FAE5", color: "#047857" },
  ENDING_SOON:  { label: "만료임박", bg: "#FFF3E0", color: "#B45309" },
  EXPIRED:      { label: "만료",     bg: "#FFEBEE", color: "#C62828" },
  FUTURE:       { label: "예정",     bg: "#DBEAFE", color: "#1E40AF" },
};

// ── 컴포넌트 ────────────────────────────────────────────
type Variant = "order" | "invoice" | "stock" | "expiry" | "contract";

interface Props {
  /** 상태 코드 */
  status: string;
  /** 어떤 종류의 상태인지 (기본 'order') */
  variant?: Variant;
  /** 추가 텍스트 (예: "D-5") */
  suffix?: string;
  /** 작게 표시 */
  small?: boolean;
}

export function StatusBadge({ status, variant = "order", suffix, small = false }: Props) {
  const meta = pickMeta(variant, status);

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-semibold
        ${small ? "text-tiny px-2 py-0.5" : "text-caption px-2.5 py-1"}
      `}
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      {meta.label}
      {suffix && <span className="font-normal opacity-80">{suffix}</span>}
    </span>
  );
}

function pickMeta(variant: Variant, status: string) {
  const fallback = { label: status, bg: "#F3F4F6", color: "#6B7280" };
  switch (variant) {
    case "order":    return ORDER_META[status as OrderStatus] ?? fallback;
    case "invoice":  return INVOICE_META[status as InvoiceStatus] ?? fallback;
    case "stock":    return STOCK_META[status as StockLevel] ?? fallback;
    case "expiry":   return EXPIRY_META[status as ExpiryLevel] ?? fallback;
    case "contract": return CONTRACT_META[status as ContractStatus] ?? fallback;
    default:         return fallback;
  }
}
