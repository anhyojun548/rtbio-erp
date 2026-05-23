/**
 * QC 재고 알럼 — /admin/alerts/stock 과 동일, requireRole 에 QC 포함.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  listLowStockAlerts,
  countStockAlerts,
} from "@/lib/actions/stock-alert";
import { StockAlertBoard } from "@/components/admin/alerts/StockAlertBoard";

export default async function QcStockAlertsPage() {
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
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display m-0"> 재고 임계치 알럼</h1>
          <p className="text-caption text-ink-secondary mt-1"> 실재고 <code className="font-mono text-tiny bg-canvas px-1 rounded">physicalStock ≤ reorderPoint</code> 조건 사이즈 목록 (R14).
          </p>
        </div>
        <Link
          href="/qc/inventory"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        > 전체 재고 →
        </Link>
      </header>

      <section className="grid grid-cols-4 gap-3">
        <StatCard
          label="품절"
          value={counts.OUT}
          tone="rose"
          note="physicalStock = 0"
        />
        <StatCard
          label="부족"
          value={counts.LOW}
          tone="amber"
          note="≤ reorderPoint"
        />
        <StatCard
          label="정상"
          value={counts.OK}
          tone="emerald"
          note="여유분 있음"
        />
        <StatCard
          label="활성 사이즈 합계"
          value={counts.totalActiveSizes}
          tone="slate"
          note="active 제품 기준"
        />
      </section>

      <StockAlertBoard rows={view} />
    </div> );
}

function StatCard({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: number;
  tone: "rose" | "amber" | "emerald" | "slate";
  note: string;
}) {
  const toneClass =
    tone === "rose"
      ? "border-rose-200 bg-rose-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white";
  const textTone =
    tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "emerald"
          ? "text-emerald-700"
          : "text-slate-800";
  return (
    <div className={`rounded-lg border ${toneClass} p-4`}>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${textTone}`}> {value.toLocaleString()}
      </div>
      <div className="text-[11px] text-slate-500 mt-1">{note}</div>
    </div> );
}
