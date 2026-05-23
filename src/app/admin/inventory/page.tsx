/**
 * 재고 현황 (Phase 3C → 2026-05-22 UI 재작성).
 * 사이즈 단위 실재고/가용재고 + 입고/조정 액션 버튼.
 */
import { requireRole } from "@/lib/session";
import { getInventorySummary } from "@/lib/actions/inventory";
import { InventorySummaryTable } from "@/components/admin/inventory/SummaryTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/shared/Button";
import { StatCard } from "@/components/shared/StatCard";

export default async function InventoryPage() {
  await requireRole("TENANT_OWNER", "ADMIN");

  const rows = await getInventorySummary();
  const lowCount = rows.filter((r) => r.low).length;
  const totalPhysical = rows.reduce((s, r) => s + r.physicalStock, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="재고 관리"
        subtitle="활성 제품의 사이즈별 재고를 조회하고, 입고·조정을 기록합니다."
        actions={
          <Button href="/admin/inventory/logs" variant="outline"> 변동 이력
          </Button> }
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="관리 사이즈 수"
          value={rows.length}
          variant="primary"
          icon=""
        />
        <StatCard
          label="총 실재고"
          value={totalPhysical}
          variant="accent"
          icon=""
        />
        <StatCard
          label="저재고 알람"
          value={lowCount}
          desc={lowCount === 0 ? "정상" : "안전재고 미달"}
          variant={lowCount > 0 ? "danger" : "success"}
          icon=""
          href="/admin/alerts/stock"
        />
      </section>

      <InventorySummaryTable rows={rows} />
    </div> );
}
