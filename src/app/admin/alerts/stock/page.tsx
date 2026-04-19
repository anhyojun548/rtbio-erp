/**
 * 재고 임계치 알럼 페이지 — Phase 3E-3 (R14).
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listLowStockAlerts, countStockAlerts } from "@/lib/actions/stock-alert";
import { StockAlertBoard } from "@/components/admin/alerts/StockAlertBoard";

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
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">재고 임계치 알럼</h1>
          <p className="text-sm text-slate-500 mt-1">
            실재고 <code>physicalStock ≤ reorderPoint</code> 조건 사이즈 목록입니다
            (R14).
            <br />
            <strong>품절(OUT)</strong>은 즉시 발주, <strong>부족(LOW)</strong>은
            reorderPoint 설정값 기준 — <Link href="/admin/products" className="text-sky-700 hover:underline">제품 상세에서 조정</Link> 가능합니다.
          </p>
        </div>
        <Link
          href="/admin/inventory"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          전체 재고 →
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
    </div>
  );
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
      <div className={`text-3xl font-bold mt-1 ${textTone}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] text-slate-500 mt-1">{note}</div>
    </div>
  );
}
