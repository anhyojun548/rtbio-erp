/**
 * 재고 임계치 알럼 페이지 — Phase 3E-3 (R14) → 2026-05-22 UI 재작성.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listLowStockAlerts, countStockAlerts } from "@/lib/actions/stock-alert";
import { StockAlertBoard } from "@/components/admin/alerts/StockAlertBoard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/shared/Button";
import { StatCard } from "@/components/shared/StatCard";

export default async function StockAlertsPage() {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const [rows, counts] = await Promise.all([
    listLowStockAlerts(),
    countStockAlerts(),
  ]);

  const view = rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="재고 임계치 알럼"
        subtitle={
          <> 실재고 <code className="font-mono text-tiny bg-canvas px-1 rounded">physicalStock ≤ reorderPoint</code> 사이즈 목록 (R14). <br/>
            <strong>품절(OUT)</strong>은 즉시 발주, <strong>부족(LOW)</strong>은 reorderPoint 기준 —{" "}
            <Link href="/admin/products" className="text-primary hover:underline">제품 상세에서 조정</Link> 가능.
          </> }
        actions={
          <Button href="/admin/inventory" variant="outline">전체 재고 →</Button> }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="품절"
          value={counts.OUT}
          desc="physicalStock = 0"
          variant="danger"
          icon=""
        />
        <StatCard
          label="부족"
          value={counts.LOW}
          desc="≤ reorderPoint"
          variant="warning"
          icon=""
        />
        <StatCard
          label="정상"
          value={counts.OK}
          desc="여유분 있음"
          variant="success"
          icon=""
        />
        <StatCard
          label="활성 사이즈 합계"
          value={counts.totalActiveSizes}
          desc="active 제품 기준"
          variant="primary"
          icon=""
        />
      </section>

      <StockAlertBoard rows={view} />
    </div> );
}
