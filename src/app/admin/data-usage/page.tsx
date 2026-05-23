/**
 * 데이터 사용량 입력 — Phase 3G-1 (R22).
 *
 * - 월 선택기 (?month=YYYY-MM, default 현재월)
 * - 카테고리별 사용량 테이블 + 전월 대비 증감
 * - 인라인 추가/편집/삭제
 */
import { requireRole } from "@/lib/session";
import {
  getMonthSummary,
  getMonthWithPrev,
  listAvailableMonths,
} from "@/lib/actions/data-usage";
import { DataUsageBoard } from "@/components/admin/data-usage/DataUsageBoard";

type SearchParams = { month?: string };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DataUsagePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const month =
    searchParams.month && MONTH_RE.test(searchParams.month)
      ? searchParams.month
      : defaultMonth();

  const [summary, comparison, availableMonths] = await Promise.all([
    getMonthSummary(month),
    getMonthWithPrev(month),
    listAvailableMonths(24),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0"> 데이터 사용량</h1>
        <p className="text-caption text-ink-secondary mt-1"> 월별·카테고리별 사용량을 수기로 입력·관리합니다 (R22). 서버·스토리지·이메일 등
          외부 자원 사용량을 누적 기록해 운영비 집계에 활용합니다.
        </p>
      </header>

      <DataUsageBoard
        month={month}
        summary={summary}
        comparison={comparison}
        availableMonths={availableMonths}
      />
    </div> );
}
