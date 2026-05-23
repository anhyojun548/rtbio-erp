/**
 * 월간 보고서 (Phase 3D-4c, R16).
 *
 * - 월 선택기 (`?month=YYYY-MM`, default = 현재 월)
 * - 상단 stat: 매출/수금/출고/미수금 + 전월 대비 증감
 * - 상태별 Invoice/Payment 분포
 * - 거래처별 매출 Top 10
 * - 원장 요약 (carry/sales/received/balance 합)
 */
import { requireRole } from "@/lib/session";
import { getMonthlyReportWithPrev } from "@/lib/actions/report";
import { MonthlyReportBoard } from "@/components/admin/reports/MonthlyReportBoard";

type SearchParams = { month?: string };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const month =
    searchParams.month && MONTH_RE.test(searchParams.month)
      ? searchParams.month
      : defaultMonth();

  const { current, previous } = await getMonthlyReportWithPrev(month);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0"> 월간 보고서</h1>
        <p className="text-caption text-ink-secondary mt-1"> 매출·수금·출고·원장 요약 (R16). 전월 대비 증감 포함.
        </p>
      </header>

      <MonthlyReportBoard
        month={month}
        current={current}
        previous={previous}
      />
    </div> );
}
