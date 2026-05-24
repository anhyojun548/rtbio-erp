/**
 * QC UDI 보고서 상세 — 읽기 전용
 *
 * 액션 버튼 없음. admin/udi/[id] 와 같은 정보를 표시하지만 전송/삭제 불가.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getUdiReport } from "@/lib/actions/udi";
import { UDI_STATUS_LABEL } from "@/lib/validators/udi";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatKRW } from "@/lib/format";

export default async function QcUdiDetailPage({ params }: { params: { id: string } }) {
  await requireRole("QC", "ADMIN", "TENANT_OWNER");

  const report = await getUdiReport(params.id).catch(() => null);
  if (!report) notFound();

  const byClient = new Map<string, {
    clientName: string;
    bizNumber: string;
    items: typeof report.items;
    totalQty: number;
    totalAmount: number;
  }>();
  for (const it of report.items) {
    const k = it.clientId;
    if (!byClient.has(k)) {
      byClient.set(k, {
        clientName: it.client?.name ?? "—",
        bizNumber:  it.bizNumber || it.client?.businessNumber || "—",
        items:      [],
        totalQty:   0,
        totalAmount: 0,
      });
    }
    const g = byClient.get(k)!;
    g.items.push(it);
    g.totalQty += it.qty;
    g.totalAmount += Number(it.totalAmount);
  }
  const grouped = Array.from(byClient.values()).sort((a, b) => b.totalAmount - a.totalAmount);

  return (
    <div className="space-y-6">
      <Link href="/qc/udi" className="text-tiny text-ink-secondary hover:text-primary">
        ← 목록으로
      </Link>

      <PageHeader
        title={`UDI 보고서 — ${report.reportMonth}`}
        subtitle={`상태 ${UDI_STATUS_LABEL[report.status]} · 품목 ${report.totalItems}건 · 합계 ${formatKRW(Number(report.totalAmount))} (읽기 전용)`}
      />

      <div className="bg-accent-light border border-accent/30 text-accent-dark rounded p-3 text-tiny">
        QC 읽기 전용 — 전송·취소 액션은 경영지원팀(ADMIN/OWNER) 권한이 필요합니다.
      </div>

      <section className="bg-surface border border-border rounded p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-caption">
        <div>
          <div className="text-tiny text-ink-secondary font-semibold uppercase mb-1">보고월</div>
          <div className="font-mono font-semibold text-h3">{report.reportMonth}</div>
        </div>
        <div>
          <div className="text-tiny text-ink-secondary font-semibold uppercase mb-1">상태</div>
          <div>
            <span className={`px-3 py-1 rounded-full text-caption font-semibold ${
              report.status === "ACCEPTED"  ? "bg-success-light text-success" :
              report.status === "SUBMITTED" ? "bg-accent-light text-accent-dark" :
                                              "bg-canvas text-ink-muted"
            }`}>
              {UDI_STATUS_LABEL[report.status]}
            </span>
          </div>
        </div>
        <div>
          <div className="text-tiny text-ink-secondary font-semibold uppercase mb-1">접수번호</div>
          <div className="font-mono text-caption">{report.receiptNo ?? "—"}</div>
        </div>
        <div>
          <div className="text-tiny text-ink-secondary font-semibold uppercase mb-1">전송일시</div>
          <div className="text-caption">
            {report.submittedAt
              ? new Date(report.submittedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
              : "—"}
          </div>
        </div>
      </section>

      <section className="bg-surface rounded shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-h3 m-0">병원별 공급 내역</h2>
        </div>
        {grouped.length === 0 ? (
          <div className="p-8 text-center text-caption text-ink-muted">공급 내역이 없습니다.</div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map((g, idx) => (
              <details key={idx} open className="group">
                <summary className="px-5 py-3 bg-canvas/50 cursor-pointer flex items-center justify-between flex-wrap gap-2 hover:bg-canvas transition">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-caption font-semibold">{g.clientName}</span>
                    <span className="font-mono text-tiny text-ink-secondary">{g.bizNumber}</span>
                    <span className="text-tiny text-ink-muted">{g.items.length}건</span>
                  </div>
                  <div className="flex items-center gap-4 text-caption tabular-nums">
                    <span>수량 <strong>{g.totalQty.toLocaleString()}</strong></span>
                    <span>합계 <strong>{formatKRW(g.totalAmount)}</strong></span>
                  </div>
                </summary>
                <table className="w-full text-caption">
                  <thead className="bg-canvas">
                    <tr>
                      <th className="px-4 py-2 text-left text-tiny font-semibold text-ink-secondary uppercase">제품명</th>
                      <th className="px-4 py-2 text-left text-tiny font-semibold text-ink-secondary uppercase">UDI-DI</th>
                      <th className="px-4 py-2 text-left text-tiny font-semibold text-ink-secondary uppercase">규격</th>
                      <th className="px-4 py-2 text-right text-tiny font-semibold text-ink-secondary uppercase">수량</th>
                      <th className="px-4 py-2 text-right text-tiny font-semibold text-ink-secondary uppercase">단가</th>
                      <th className="px-4 py-2 text-right text-tiny font-semibold text-ink-secondary uppercase">금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.items.map((it) => (
                      <tr key={it.id} className="hover:bg-canvas">
                        <td className="px-4 py-2">{it.productName}</td>
                        <td className="px-4 py-2 font-mono text-tiny text-ink-secondary">{it.udiCode}</td>
                        <td className="px-4 py-2 text-tiny text-ink-secondary">{it.spec ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{it.qty.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-tiny">{formatKRW(Number(it.unitPrice))}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatKRW(Number(it.totalAmount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
