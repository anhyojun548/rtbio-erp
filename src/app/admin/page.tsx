import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listLowStockAlerts, countStockAlerts } from "@/lib/actions/stock-alert";
import { STOCK_LEVEL_LABEL } from "@/lib/validators/stock-alert";
import { listExpiringSoon } from "@/lib/actions/sales-contract";
import { CONTRACT_STATUS_LABEL } from "@/lib/validators/sales-contract";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";

/**
 * 경영지원 대시보드 — prototype 디자인 그대로 이식.
 *
 * 2026-05-22:
 *   - 4장 KPI 카드 (활성거래처/배송지/제품/알럼)
 *   - 재고 임계치 알럼 Top 5
 *   - 만료 임박 계약 위젯
 */
export default async function AdminHome() {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

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

  const alertTotal = alertCounts.OUT + alertCounts.LOW;

  return (
    <div className="space-y-6"> {/* 헤더 */}
      <header>
        <h1 className="text-display m-0"> 경영지원 대시보드</h1>
        <p className="text-caption text-ink-secondary mt-1"> {user.name}님 환영합니다 · 테넌트:{" "}
          <code className="font-mono bg-canvas px-2 py-0.5 rounded-xs text-tiny"> {user.tenantCode ?? "-"}
          </code>
        </p>
      </header> {/* KPI 카드 4장 */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="활성 거래처"
          value={clientCount}
          variant="primary"
          icon=""
          href="/admin/clients"
        />
        <StatCard
          label="등록 배송지"
          value={addressCount}
          variant="accent"
          icon=""
          href="/admin/clients"
        />
        <StatCard
          label="활성 제품"
          value={productCount}
          variant="success"
          icon=""
          href="/admin/products"
        />
        <StatCard
          label="재고 알럼"
          value={alertTotal}
          desc={alertTotal === 0 ? "정상" : `품절 ${alertCounts.OUT} · 부족 ${alertCounts.LOW}`}
          variant={alertCounts.OUT > 0 ? "danger" : alertCounts.LOW > 0 ? "warning" : "success"}
          icon=""
          href="/admin/alerts/stock"
        />
      </section> {/* 재고 임계치 알럼 */}
      <section className="bg-surface rounded shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-h3 m-0 flex items-center gap-2"> 재고 임계치 알럼
            {alertTotal > 0 && (
              <span className="text-tiny font-normal text-ink-secondary"> ({alertCounts.OUT > 0 && <span className="text-danger font-semibold">품절 {alertCounts.OUT}</span>}
                {alertCounts.OUT > 0 && alertCounts.LOW > 0 && " · "}
                {alertCounts.LOW > 0 && <span className="text-warning font-semibold">부족 {alertCounts.LOW}</span>})
              </span> )}
          </h2>
          <Link href="/admin/alerts/stock" className="text-tiny text-primary hover:underline"> 전체 보기 →
          </Link>
        </div> {topAlerts.length === 0 ? (
          <div className="p-8 text-center text-caption text-success bg-success-light/30"> 모든 활성 사이즈가 정상 재고입니다.
          </div> ) : (
          <table className="w-full text-caption">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">레벨</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">제품</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">사이즈</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase tracking-wide">실재고</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase tracking-wide">기준치</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase tracking-wide">부족</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border"> {topAlerts.map((r) => (
                <tr key={r.sizeId} className="hover:bg-canvas">
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      status={r.level}
                      variant="stock"
                      small
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/products/${r.productId}`} className="text-primary hover:underline"> {r.productName}
                    </Link>
                    <span className="font-mono text-tiny text-ink-muted ml-1">{r.productCode}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-ink-secondary">{r.sizeCode}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${
                    r.level === "OUT" ? "text-danger" : "text-warning"
                  }`}> {r.physicalStock}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-muted"> {r.reorderPoint}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-ink"> {r.deficit > 0 ? r.deficit : "-"}
                  </td>
                </tr> ))}
            </tbody>
          </table> )}
      </section> {/* 만료 임박 계약 */}
      <section className="bg-surface rounded shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-h3 m-0 flex items-center gap-2"> 판매 계약서 만료 임박 (30일 이내)
            {expiringContracts.length > 0 && (
              <span className="text-tiny font-normal text-warning"> ({expiringContracts.length}건)
              </span> )}
          </h2>
          <Link href="/admin/contracts?status=ENDING_SOON" className="text-tiny text-primary hover:underline"> 전체 보기 →
          </Link>
        </div> {expiringContracts.length === 0 ? (
          <div className="p-8 text-center text-caption text-success bg-success-light/30"> 30일 이내 만료 예정인 계약이 없습니다.
          </div> ) : (
          <table className="w-full text-caption">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">상태</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">제목</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase tracking-wide">거래처</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase tracking-wide">종료일</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase tracking-wide">남은 일수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border"> {expiringContracts.slice(0, 5).map((c) => (
                <tr key={c.id} className="hover:bg-canvas">
                  <td className="px-4 py-2.5">
                    <StatusBadge status={c.status} variant="contract" small />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/contracts/${c.id}`} className="text-ink hover:underline"> {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-primary">{c.client.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-tiny text-ink-secondary"> {c.endDate?.toISOString().slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-warning"> {c.daysLeft !== null ? `${c.daysLeft}일` : "—"}
                  </td>
                </tr> ))}
            </tbody>
          </table> )}
      </section> {/* Phase 진행 상황 */}
      <section className="bg-primary-lighter rounded p-5 border border-primary/10">
        <h2 className="text-h3 m-0 mb-3 text-primary">Phase 진행 상황</h2>
        <ul className="text-caption text-ink-secondary space-y-1.5">
          <li>[완료] Phase 1·2 — 스키마·인증·RBAC·감사로그</li>
          <li>[완료] Phase 3A~H — 거래처/제품/재고/주문/출고/명세서/수금/원장/유통기한/QC·거래처 포털</li>
          <li>[진행] Phase 4 — prototype UI 이식 (사이드바·디자인 토큰 적용 완료)</li>
          <li>[예정] Phase 5 — 신규 모듈 (공지/베트남발주/UDI/매뉴얼/데이터탐색기)</li>
        </ul>
      </section>
    </div> );
}
