/**
 * 베트남 발주 트래킹 — 경영지원 포털
 */
export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/session";
import { listProcurementProjects } from "@/lib/actions/procurement";
import { PROC_CATEGORY_LABEL, PROC_STATUS_LABEL, TRANSPORT_LABEL } from "@/lib/validators/procurement";
import { PageHeader } from "@/components/shared/PageHeader";

export default async function ProcurementPage() {
  await requireRole("TENANT_OWNER", "ADMIN");
  // DB 마이그레이션 전에는 빈 배열 (테이블 없음)
  let projects: Awaited<ReturnType<typeof listProcurementProjects>> = [];
  try {
    projects = await listProcurementProjects();
  } catch (e) {
    console.warn("[ProcurementPage] DB 접근 실패 — 마이그레이션 필요:", (e as Error).message);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="🚢 베트남 발주 트래킹"
        subtitle="원단/부자재/제품 생산발주를 항공·선박으로 분할 입고합니다."
      />

      {projects.length === 0 ? (
        <div className="bg-surface border border-border rounded p-12 text-center text-ink-muted">
          등록된 발주가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const progress = p.totalQty > 0 ? Math.round((p.receivedQty / p.totalQty) * 100) : 0;
            return (
              <div key={p.id} className="bg-surface border border-border rounded p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-mono text-tiny text-ink-muted">{p.code}</div>
                    <h3 className="text-h3 m-0 mt-0.5">{p.title}</h3>
                  </div>
                  <span className="text-tiny font-semibold px-2 py-0.5 rounded-full bg-canvas text-ink-secondary">
                    {PROC_STATUS_LABEL[p.status]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-tiny text-ink-secondary mb-3">
                  <div>분류: <strong className="text-ink">{PROC_CATEGORY_LABEL[p.category]}</strong></div>
                  <div>주문일: <strong className="text-ink">{p.orderDate.toISOString().slice(0, 10)}</strong></div>
                  <div>발주량: <strong className="text-ink tabular-nums">{p.totalQty.toLocaleString()}</strong></div>
                  <div>입고량: <strong className="text-ink tabular-nums">{p.receivedQty.toLocaleString()}</strong></div>
                </div>

                <div className="bg-canvas h-2 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-tiny text-ink-muted text-right tabular-nums mb-3">{progress}%</div>

                {p.shipments.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <div className="text-tiny text-ink-muted uppercase font-semibold mb-2">선적 내역</div>
                    <ul className="space-y-1.5">
                      {p.shipments.map((s) => (
                        <li key={s.id} className="flex items-center justify-between text-caption">
                          <span>
                            {TRANSPORT_LABEL[s.transport]} ·{" "}
                            <span className="tabular-nums">{s.qty.toLocaleString()}</span>
                            {s.expectedDate && <span className="text-ink-muted ml-1">예정 {s.expectedDate.toISOString().slice(0, 10)}</span>}
                          </span>
                          {s.arrivalDate ? (
                            <span className="text-tiny text-success font-semibold">✓ {s.arrivalDate.toISOString().slice(0, 10)} 입고</span>
                          ) : (
                            <span className="text-tiny text-warning font-semibold">운송중</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
