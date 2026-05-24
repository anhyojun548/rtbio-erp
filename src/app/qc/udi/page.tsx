/**
 * QC 포털 UDI 보고서 — 읽기 전용
 *
 * 품질팀은 식약처 보고 이력을 모니터링하지만 직접 생성/전송 권한은 없음.
 * (TENANT_OWNER/ADMIN 만 생성/전송 가능)
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listUdiReports, getUdiMonthPreview } from "@/lib/actions/udi";
import { UDI_STATUS_LABEL } from "@/lib/validators/udi";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { formatKRW } from "@/lib/format";

type SearchParams = { month?: string };

function defaultMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const ny = m === 0 ? y - 1 : y;
  const nm = m === 0 ? 12 : m;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export default async function QcUdiPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("QC", "ADMIN", "TENANT_OWNER");

  const month = (searchParams.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month))
    ? searchParams.month
    : defaultMonth();

  let reports: Awaited<ReturnType<typeof listUdiReports>> = [];
  let preview = { hospitalCount: 0, itemCount: 0, totalQty: 0, totalAmount: 0, hasExistingReport: false };
  try {
    [reports, preview] = await Promise.all([
      listUdiReports(),
      getUdiMonthPreview(month),
    ]);
  } catch (e) {
    console.warn("[QcUdiPage] DB 접근 실패:", (e as Error).message);
  }

  const currentMonthReport = reports.find((r) => r.reportMonth === month);

  return (
    <div className="space-y-6">
      <PageHeader
        title="UDI 공급내역 보고 (모니터링)"
        subtitle="품질팀은 식약처 보고 이력을 확인합니다. 보고서 생성·전송은 경영지원팀이 진행합니다."
      />

      <div className="bg-accent-light border border-accent/30 text-accent-dark rounded p-3 text-tiny">
        읽기 전용 모드 — 보고서 작성/전송은 경영지원팀(ADMIN/OWNER) 권한이 필요합니다.
      </div>

      {/* 월 선택 — 단순 form */}
      <form className="bg-surface border border-border rounded p-4 flex items-center gap-2">
        <label className="text-caption text-ink-secondary">조회 월</label>
        <input
          type="month"
          name="month"
          defaultValue={month}
          className="rounded-xs border border-border px-3 py-1.5 text-caption"
        />
        <button type="submit" className="px-3 py-1.5 rounded-xs bg-primary text-white text-caption font-semibold">
          조회
        </button>
        <span className="text-tiny text-ink-muted ml-2">
          {currentMonthReport ? `보고서 ${UDI_STATUS_LABEL[currentMonthReport.status]}` : "보고서 미생성"}
        </span>
      </form>

      {/* 4 stat */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="대상 병원" value={preview.hospitalCount} desc={`${month} 납품`} variant="primary" icon="" />
        <StatCard label="총 품목" value={preview.itemCount} desc="건수" variant="accent" icon="" />
        <StatCard label="총 수량" value={preview.totalQty.toLocaleString()} desc="편측 기준" variant="warning" icon="" />
        <StatCard
          label="공급가 합"
          value={formatKRW(preview.totalAmount)}
          desc={currentMonthReport ? UDI_STATUS_LABEL[currentMonthReport.status] : "미보고"}
          variant={currentMonthReport?.status === "ACCEPTED" ? "success" : "danger"}
          icon=""
        />
      </section>

      {/* 보고 이력 */}
      <section className="bg-surface rounded shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-h3 m-0">월간 보고 이력</h2>
          <span className="text-tiny text-ink-muted">{reports.length}건</span>
        </div>
        {reports.length === 0 ? (
          <div className="p-8 text-center text-caption text-ink-muted">
            작성된 UDI 보고서가 없습니다.
          </div>
        ) : (
          <table className="w-full text-caption">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase">보고월</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase">상태</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase">접수번호</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase">품목수</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase">공급가 합</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase">전송일시</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-canvas">
                  <td className="px-4 py-2.5 font-mono font-semibold">{r.reportMonth}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-tiny font-semibold ${
                      r.status === "ACCEPTED"  ? "bg-success-light text-success" :
                      r.status === "SUBMITTED" ? "bg-accent-light text-accent-dark" :
                                                  "bg-canvas text-ink-muted"
                    }`}>
                      {UDI_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-tiny text-ink-secondary">{r.receiptNo ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r._count.items.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatKRW(Number(r.totalAmount))}</td>
                  <td className="px-4 py-2.5 tabular-nums text-tiny">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/qc/udi/${r.id}`} className="text-tiny text-primary hover:underline px-2 py-1">
                      상세 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
