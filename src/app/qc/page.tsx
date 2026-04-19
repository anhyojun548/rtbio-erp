/**
 * QC 대시보드 — 품질관리 포털 홈.
 *
 * 요약:
 *   - 칸반 진행 현황(컬럼별 건수)
 *   - 재고 알럼 (OUT/LOW 건수)
 *   - 유통기한 임박 (EXPIRED/URGENT) 건수
 *   - 오늘 자 SUBMITTED 주문 (확정 대기)
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

  // 유통기한 분류
  let expiredCnt = 0;
  let urgentCnt = 0;
  for (const lot of expiring) {
    const cls = classifyExpiry(lot.expiryDate);
    if (cls.stage === "EXPIRED") expiredCnt++;
    else if (cls.stage === "URGENT") urgentCnt++;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">품질관리 대시보드</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user.name}님 환영합니다. 출고 · 재고 · 유통기한 현황을 한 눈에 확인하세요.
        </p>
      </header>

      {/* ─── 상단 4장 Stat 카드 ──────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="확정 대기"
          value={submittedCount}
          note="SUBMITTED 주문"
          href="/admin/orders?status=SUBMITTED"
          tone="sky"
        />
        <StatCard
          label="진행중 출고"
          value={activeShipments.length}
          note="칸반 진행"
          href="/qc/shipments"
          tone="amber"
        />
        <StatCard
          label="재고 품절/부족"
          value={alertCount.OUT + alertCount.LOW}
          note={`품절 ${alertCount.OUT} · 부족 ${alertCount.LOW}`}
          href="/qc/alerts"
          tone={alertCount.OUT > 0 ? "rose" : "amber"}
        />
        <StatCard
          label="유통기한 임박"
          value={expiredCnt + urgentCnt}
          note={`만료 ${expiredCnt} · 30일 내 ${urgentCnt}`}
          href="/qc/expiry"
          tone={expiredCnt > 0 ? "rose" : "amber"}
        />
      </section>

      {/* ─── 2분할: 칸반 단계별 / 재고 알럼 Top5 ──────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">🪧 칸반 단계별 현황</h2>
            <Link
              href="/qc/shipments"
              className="text-xs text-sky-700 hover:underline"
            >
              보드 열기 →
            </Link>
          </div>
          {columns.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              칸반 단계가 설정되어 있지 않습니다.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {columns.map((col) => (
                <li
                  key={col.id}
                  className="flex items-center px-4 py-2 text-sm"
                >
                  <span className="flex-1 font-medium text-slate-800">
                    {col.label}
                    {col.isTerminal && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        terminal
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums font-semibold text-slate-900">
                    {byCol.get(col.id) ?? 0}건
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">🚨 재고 알럼 Top 5</h2>
            <Link
              href="/qc/alerts"
              className="text-xs text-sky-700 hover:underline"
            >
              전체 →
            </Link>
          </div>
          {topAlerts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              임계치 이하 재고가 없습니다 ✅
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topAlerts.map((r) => (
                <li
                  key={r.sizeId}
                  className="flex items-center px-4 py-2 text-sm hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">
                      {r.productName}
                      <span className="ml-2 text-[11px] font-mono text-slate-400">
                        {r.sizeCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      실재고 {r.physicalStock} / 재주문점 {r.reorderPoint}
                    </div>
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                      r.level === "OUT"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.level === "OUT" ? "품절" : "부족"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ─── 유통기한 임박 로트 ─────────────────────────── */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">⏰ 유통기한 임박 (30일 이내)</h2>
          <Link
            href="/qc/expiry"
            className="text-xs text-sky-700 hover:underline"
          >
            전체 →
          </Link>
        </div>
        {expiring.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            30일 이내 만료 로트가 없습니다 ✅
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">제품</th>
                <th className="px-4 py-2 text-left">사이즈</th>
                <th className="px-4 py-2 text-left">로트</th>
                <th className="px-4 py-2 text-right">잔여</th>
                <th className="px-4 py-2 text-left">만료일</th>
                <th className="px-4 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expiring.slice(0, 10).map((lot) => {
                const cls = classifyExpiry(lot.expiryDate);
                return (
                  <tr key={lot.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">{lot.productSize.product.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {lot.productSize.sizeCode}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {lot.lotNumber}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {lot.remainingQty}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(lot.expiryDate).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          cls.stage === "EXPIRED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {cls.stage === "EXPIRED"
                          ? "만료됨"
                          : `${cls.daysLeft}일`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  href,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  href: string;
  tone: "sky" | "amber" | "rose" | "emerald";
}) {
  const hoverTone =
    tone === "sky"
      ? "hover:border-sky-400"
      : tone === "amber"
        ? "hover:border-amber-400"
        : tone === "rose"
          ? "hover:border-rose-400"
          : "hover:border-emerald-400";
  const textTone =
    tone === "sky"
      ? "text-sky-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "rose"
          ? "text-rose-700"
          : "text-emerald-700";
  return (
    <Link
      href={href}
      className={`rounded-lg border border-slate-200 bg-white p-5 transition hover:shadow-sm ${hoverTone}`}
    >
      <div className="text-xs text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-3xl font-bold mt-2 ${textTone} tabular-nums`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] text-slate-500 mt-1">{note}</div>
    </Link>
  );
}
