/**
 * UDI 공급내역 보고 — 경영지원 포털
 *
 * Phase 5 보강 (2026-05-24):
 *   - QuickMonthSelector + 4 stat 카드 (대상 병원/품목/수량/공급가)
 *   - 보고서 생성/전송/삭제 버튼 + 접수증 모달
 *   - 보고 이력 테이블 (상세 페이지 링크)
 */
export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/session";
import { listUdiReports, getUdiMonthPreview } from "@/lib/actions/udi";
import { PageHeader } from "@/components/shared/PageHeader";
import { UdiPageBoard, type SerializedReport } from "@/components/admin/udi/UdiPageBoard";

type SearchParams = {
  month?: string;
};

function defaultMonth(): string {
  const now = new Date();
  // 보고기한 = 익월 말일. 기본은 "지난 달" (예: 5월 → 4월 보고)
  const y = now.getFullYear();
  const m = now.getMonth(); // 0~11 — getMonth() 자체가 "이전 달" 인덱스가 됨
  const ny = m === 0 ? y - 1 : y;
  const nm = m === 0 ? 12 : m;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export default async function UdiPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const month = (searchParams.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month))
    ? searchParams.month
    : defaultMonth();

  let reportsRaw: Awaited<ReturnType<typeof listUdiReports>> = [];
  let preview = { hospitalCount: 0, itemCount: 0, totalQty: 0, totalAmount: 0, hasExistingReport: false };
  try {
    [reportsRaw, preview] = await Promise.all([
      listUdiReports(),
      getUdiMonthPreview(month),
    ]);
  } catch (e) {
    console.warn("[UdiPage] DB 접근 실패:", (e as Error).message);
  }

  // Decimal/Date → 직렬화
  const reports: SerializedReport[] = reportsRaw.map((r) => ({
    id:          r.id,
    reportMonth: r.reportMonth,
    status:      r.status,
    receiptNo:   r.receiptNo,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    totalItems:  r.totalItems,
    totalAmount: r.totalAmount.toString(),
    itemCount:   r._count.items,
    createdAt:   r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="UDI 공급내역 보고"
        subtitle="월별 병원 납품 거래를 식약처 의료기기통합정보시스템(udiportal.mfds.go.kr)에 보고. 거래명세서(ISSUED+SENT)에서 자동 집계."
      />

      <div className="bg-primary text-white rounded p-4 text-caption">
        <strong>UDI 보고 안내</strong> · 보고기한: 공급한 달의 익월 말일 · 대상: 의료기관(병원) 공급분만 · 인증: OAuth2 (실서비스 단계 연동 예정)
      </div>

      <UdiPageBoard
        month={month}
        preview={{
          hospitalCount: preview.hospitalCount,
          itemCount:     preview.itemCount,
          totalQty:      preview.totalQty,
          totalAmount:   preview.totalAmount,
          hasExistingReport: preview.hasExistingReport,
        }}
        reports={reports}
      />
    </div>
  );
}
