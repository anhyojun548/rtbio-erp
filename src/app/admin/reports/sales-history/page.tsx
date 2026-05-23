/**
 * 기간별 영업 이력서 — Phase 3G-3 (R21).
 *
 * 쿼리 파라미터: ?repId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 * 기본: 로그인 유저가 EXEC 면 본인, TENANT_OWNER/ADMIN 이면 첫 담당자.
 * 기간 기본: 이번 달 1일 ~ 오늘.
 */
import { requireRole } from "@/lib/session";
import {
  getSalesHistory,
  listAssignableSalesReps,
} from "@/lib/actions/sales-history";
import {
  defaultRange,
  parseYmd,
} from "@/lib/validators/sales-history";
import { SalesHistoryBoard } from "@/components/admin/reports/SalesHistoryBoard";

export default async function SalesHistoryPage({
  searchParams,
}: {
  searchParams: { repId?: string; from?: string; to?: string };
}) {
  const me = await requireRole("TENANT_OWNER", "ADMIN");
  const reps = await listAssignableSalesReps();
  const defaults = defaultRange();

  const repId =
    searchParams.repId && reps.find((r) => r.id === searchParams.repId)
      ? searchParams.repId
      : (reps[0]?.id ?? me.id);

  const fromStr =
    searchParams.from && parseYmd(searchParams.from)
      ? searchParams.from
      : defaults.from;
  const toStr =
    searchParams.to && parseYmd(searchParams.to)
      ? searchParams.to
      : defaults.to;

  const from = parseYmd(fromStr)!;
  const to = parseYmd(toStr)!;

  const history = await getSalesHistory({
    salesRepId: repId,
    from,
    to,
  });

  // 직렬화 (Client 컴포넌트 전달)
  const serialized = {
    ...history,
    from: history.from.toISOString(),
    to: history.to.toISOString(),
    events: history.events.map((e) => ({
      ...e,
      occurredAt: e.occurredAt.toISOString(),
    })),
  };

  const selectedRep = reps.find((r) => r.id === repId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0">️ 기간별 영업 이력서</h1>
        <p className="text-caption text-ink-secondary mt-1"> 담당자 × 기간 별 활동 요약입니다 (R21). 주문 접수·명세서 발행·수금 확인·학회
          방문자 4종 이벤트를 시간순으로 정리합니다.
        </p>
      </header>

      <SalesHistoryBoard
        history={serialized}
        reps={reps}
        currentRepId={repId}
        currentRepName={selectedRep?.name ?? "(알 수 없음)"}
        from={fromStr}
        to={toStr}
        isOwnerOrAdmin={true}
      />
    </div> );
}
