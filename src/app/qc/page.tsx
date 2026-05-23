/**
 * QC 대시보드 — 품질관리 포털 홈.
 *
 * 2026-05-22: prototype 디자인 그대로 이식.
 *   - 4장 KPI 카드
 *   - 칸반 단계별 / 재고 알럼 Top5 2분할
 *   - 유통기한 임박 로트 30일 이내
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  listKanbanColumns,
  listShipmentsForBoard,
} from "@/lib/actions/shipment";
import {
  countStockAlerts,
  listLowStockAlerts,
} from "@/lib/actions/stock-alert";
import { listExpiringSoon } from "@/lib/actions/expiry";
import { classifyExpiry } from "@/lib/validators/expiry";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default async function QcHome() {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const [columns, shipments, alertCount, topAlerts, expiring, submittedCount] =
    await Promise.all([
      listKanbanColumns(),
      listShipmentsForBoard(),
      countStockAlerts(),
      listLowStockAlerts({ limit: 5 }),
      listExpiringSoon(30),
      prisma.order.count({ where: { status: "SUBMITTED" } }),
    ]);

  const activeShipments = shipments.filter((s) => !s.completedAt);
  const byCol = new Map<string, number>();
  for (const s of activeShipments) {
    byCol.set(s.currentStageId, (byCol.get(s.currentStageId) ?? 0) + 1);
  }

  let expiredCnt = 0;
  let urgentCnt = 0;
  for (const lot of expiring) {
    const cls = classifyExpiry(lot.expiryDate);
    if (cls.stage === "EXPIRED") expiredCnt++;
    else if (cls.stage === "URGENT") urgentCnt++;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="품질관리 대시보드"
        subtitle={`${user.name}님 환영합니다. 출고 · 재고 · 유통기한 현황을 한 눈에 확인하세요.`}
      /> {/* 4장 KPI */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="확정 대기"
          value={submittedCount}
          desc="SUBMITTED 주문"
          variant="primary"
          icon=""
          href="/admin/orders?status=SUBMITTED"
        />
        <StatCard
          label="진행중 출고"
          value={activeShipments.length}
          desc="칸반 진행"
          variant="accent"
          icon=""
          href="/qc/shipments"
        />
        <StatCard
          label="재고 품절/부족"
          value={alertCount.OUT + alertCount.LOW}
          desc={`품절 ${alertCount.OUT} · 부족 ${alertCount.LOW}`}
          variant={alertCount.OUT > 0 ? "danger" : alertCount.LOW > 0 ? "warning" : "success"}
          icon=""
          href="/qc/alerts"
        />
        <StatCard
          label="유통기한 임박"
          value={expiredCnt + urgentCnt}
          desc={`만료 ${expiredCnt} · 30일 내 ${urgentCnt}`}
          variant={expiredCnt > 0 ? "danger" : urgentCnt > 0 ? "warning" : "success"}
          icon="⏰"
          href="/qc/expiry"
        />
      </section> {/* 2분할: 칸반 현황 / 재고 알럼 Top5 */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface rounded shadow-sm border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-h3 m-0"> 칸반 단계별 현황</h2>
            <Link href="/qc/shipments" className="text-tiny text-primary hover:underline"> 보드 열기 →
            </Link>
          </div> {columns.length === 0 ? (
            <div className="p-8 text-center text-caption text-ink-muted"> 칸반 단계가 설정되어 있지 않습니다.
            </div> ) : (
            <ul className="divide-y divide-border"> {columns.map((col) => (
                <li key={col.id} className="flex items-center px-5 py-3 text-caption">
                  <span className="flex-1 font-semibold text-ink"> {col.label}
                    {col.isTerminal && (
                      <span className="ml-2 text-tiny px-1.5 py-0.5 rounded-xs bg-success-light text-success font-semibold"> terminal
                      </span> )}
                  </span>
                  <span className="tabular-nums font-bold text-ink"> {byCol.get(col.id) ?? 0}건
                  </span>
                </li> ))}
            </ul> )}
        </div>

        <div className="bg-surface rounded shadow-sm border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-h3 m-0"> 재고 알럼 Top 5</h2>
            <Link href="/qc/alerts" className="text-tiny text-primary hover:underline"> 전체 →
            </Link>
          </div> {topAlerts.length === 0 ? (
            <div className="p-8 text-center text-caption text-success bg-success-light/30"> 임계치 이하 재고가 없습니다 ✅
            </div> ) : (
            <ul className="divide-y divide-border"> {topAlerts.map((r) => (
                <li key={r.sizeId} className="flex items-center px-5 py-3 text-caption hover:bg-canvas transition">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink truncate"> {r.productName}
                      <span className="ml-2 text-tiny font-mono text-ink-muted">{r.sizeCode}</span>
                    </div>
                    <div className="text-tiny text-ink-muted mt-0.5"> 실재고 {r.physicalStock} / 재주문점 {r.reorderPoint}
                    </div>
                  </div>
                  <StatusBadge status={r.level} variant="stock" small />
                </li> ))}
            </ul> )}
        </div>
      </section> {/* 유통기한 임박 로트 */}
      <section className="bg-surface rounded shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-h3 m-0">⏰ 유통기한 임박 (30일 이내)</h2>
          <Link href="/qc/expiry" className="text-tiny text-primary hover:underline"> 전체 →
          </Link>
        </div> {expiring.length === 0 ? (
          <div className="p-8 text-center text-caption text-success bg-success-light/30"> 30일 이내 만료 로트가 없습니다 ✅
          </div> ) : (
          <table className="w-full text-caption">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">제품</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">사이즈</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">로트</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase tracking-wide">잔여</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">만료일</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border"> {expiring.slice(0, 10).map((lot) => {
                const cls = classifyExpiry(lot.expiryDate);
                return (
                  <tr key={lot.id} className="hover:bg-canvas transition">
                    <td className="px-4 py-2.5">{lot.productSize.product.name}</td>
                    <td className="px-4 py-2.5 font-mono text-tiny">{lot.productSize.sizeCode}</td>
                    <td className="px-4 py-2.5 font-mono text-tiny">{lot.lotNumber}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{lot.remainingQty}</td>
                    <td className="px-4 py-2.5 tabular-nums text-ink-secondary"> {new Date(lot.expiryDate).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        status={cls.stage}
                        variant="expiry"
                        suffix={cls.stage !== "EXPIRED" ? `D-${cls.daysLeft}` : undefined}
                        small
                      />
                    </td>
                  </tr> );
              })}
            </tbody>
          </table> )}
      </section>
    </div> );
}
