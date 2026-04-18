/**
 * 재고 현황 (Phase 3C).
 * 사이즈 단위 실재고/가용재고 + 입고/조정 액션 버튼.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getInventorySummary } from "@/lib/actions/inventory";
import { InventorySummaryTable } from "@/components/admin/inventory/SummaryTable";

export default async function InventoryPage() {
  await requireRole("TENANT_OWNER", "ADMIN");

  const rows = await getInventorySummary();
  const lowCount = rows.filter((r) => r.low).length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">재고 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            활성 제품의 사이즈별 재고를 조회하고, 입고·조정을 기록합니다.
          </p>
        </div>
        <Link
          href="/admin/inventory/logs"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          변동 이력
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="관리 사이즈 수" value={rows.length} />
        <StatCard
          label="총 실재고"
          value={rows.reduce((s, r) => s + r.physicalStock, 0)}
        />
        <StatCard
          label="저재고 알람"
          value={lowCount}
          tone={lowCount > 0 ? "alert" : "default"}
        />
      </div>

      <InventorySummaryTable rows={rows} />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "alert";
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${
        tone === "alert" ? "border-red-200" : "border-slate-200"
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "alert" ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
