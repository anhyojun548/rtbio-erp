import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  listLowStockAlerts,
  countStockAlerts,
} from "@/lib/actions/stock-alert";
import { STOCK_LEVEL_LABEL } from "@/lib/validators/stock-alert";
import { listExpiringSoon } from "@/lib/actions/sales-contract";
import { CONTRACT_STATUS_LABEL } from "@/lib/validators/sales-contract";

export default async function AdminHome() {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  // 빠른 통계 — 아직 Phase 3 시작이므로 몇 가지만
  const [
    clientCount,
    addressCount,
    productCount,
    alertCounts,
    topAlerts,
    expiringContracts,
  ] = await Promise.all([
    prisma.client.count({ where: { active: true } }),
    prisma.clientAddress.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true } }),
    countStockAlerts(),
    listLowStockAlerts({ limit: 5 }),
    listExpiringSoon(30),
  ]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">경영지원 대시보드</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user.name}님 환영합니다. 테넌트:{" "}
          <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">
            {user.tenantCode ?? "-"}
          </code>
        </p>
      </header>

      <section className="grid grid-cols-3 gap-4">
        <StatCard label="활성 거래처" value={clientCount} href="/admin/clients" />
        <StatCard label="등록 배송지" value={addressCount} href="/admin/clients" />
        <StatCard label="활성 제품" value={productCount} href="/admin/products" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            🚨 재고 임계치 알럼
            {(alertCounts.OUT > 0 || alertCounts.LOW > 0) && (
              <span className="text-xs font-normal text-slate-500">
                (
                {alertCounts.OUT > 0 && (
                  <span className="text-rose-700 font-semibold">
                    품절 {alertCounts.OUT}
                  </span>
                )}
                {alertCounts.OUT > 0 && alertCounts.LOW > 0 && " · "}
                {alertCounts.LOW > 0 && (
                  <span className="text-amber-700 font-semibold">
                    부족 {alertCounts.LOW}
                  </span>
                )}
                )
              </span>
            )}
          </h2>
          <Link
            href="/admin/alerts/stock"
            className="text-xs text-sky-700 hover:underline"
          >
            전체 보기 →
          </Link>
        </div>
        {topAlerts.length === 0 ? (
          <div className="p-6 text-center text-sm text-emerald-700 bg-emerald-50/50">
            ✨ 모든 활성 사이즈가 정상 재고입니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">레벨</th>
                <th className="px-3 py-2 text-left">제품</th>
                <th className="px-3 py-2 text-left">사이즈</th>
                <th className="px-3 py-2 text-right">실재고</th>
                <th className="px-3 py-2 text-right">기준치</th>
                <th className="px-3 py-2 text-right">부족</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topAlerts.map((r) => (
                <tr key={r.sizeId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        r.level === "OUT"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {STOCK_LEVEL_LABEL[r.level]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/products/${r.productId}`}
                      className="text-sky-700 hover:underline"
                    >
                      {r.productName}
                    </Link>
                    <span className="font-mono text-[10px] text-slate-400 ml-1">
                      {r.productCode}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-700">
                    {r.sizeCode}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-semibold ${
                      r.level === "OUT" ? "text-rose-700" : "text-amber-700"
                    }`}
                  >
                    {r.physicalStock}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {r.reorderPoint}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">
                    {r.deficit > 0 ? r.deficit : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            📝 판매 계약서 만료 임박 (30일 이내)
            {expiringContracts.length > 0 && (
              <span className="text-xs font-normal text-amber-700">
                ({expiringContracts.length}건)
              </span>
            )}
          </h2>
          <Link
            href="/admin/contracts?status=ENDING_SOON"
            className="text-xs text-sky-700 hover:underline"
          >
            전체 보기 →
          </Link>
        </div>
        {expiringContracts.length === 0 ? (
          <div className="p-6 text-center text-sm text-emerald-700 bg-emerald-50/50">
            ✨ 30일 이내 만료 예정인 계약이 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-left">제목</th>
                <th className="px-3 py-2 text-left">거래처</th>
                <th className="px-3 py-2 text-right">종료일</th>
                <th className="px-3 py-2 text-right">남은 일수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expiringContracts.slice(0, 5).map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                      {CONTRACT_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/contracts/${c.id}`}
                      className="text-slate-900 hover:underline"
                    >
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sky-700">{c.client.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-slate-600">
                    {c.endDate?.toISOString().slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-700">
                    {c.daysLeft !== null ? `${c.daysLeft}일` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
        <h2 className="font-semibold text-slate-900">Phase 진행 상황</h2>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>✅ Phase 1 — 스키마·마이그레이션·복수 배송지</li>
          <li>✅ Phase 2 — 인증·RBAC·감사로그</li>
          <li>✅ Phase 3A~D — 거래처/제품/재고/주문/출고/거래명세서/수금/원장/유통기한/월간보고서</li>
          <li>🔄 Phase 3E — 칸반·테넌트설정·재고알럼 (진행 중)</li>
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white p-5 hover:border-sky-400 hover:shadow-sm transition"
    >
      <div className="text-xs text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-3xl font-bold text-slate-900 mt-2">
        {value.toLocaleString()}
      </div>
    </Link>
  );
}
