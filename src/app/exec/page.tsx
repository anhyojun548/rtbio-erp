/**
 * 영업 대시보드 — Phase 3F-1 → 2026-05-22 UI 재작성.
 *
 * 본인에게 배정된 거래처 / 진행 주문 / 이번 달 Top 5 거래처 요약.
 * ADMIN/TENANT_OWNER 도 동일 화면을 보되, 본인 id 기준으로 필터됨(초기 버전).
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  listMyClients,
  getMyOrderSummary,
  getMyTopClientsByMonth,
} from "@/lib/actions/exec";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default async function ExecHome() {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");

  const [clients, orderSummary, topClients] = await Promise.all([
    listMyClients(),
    getMyOrderSummary({ recentLimit: 5 }),
    getMyTopClientsByMonth({ limit: 5 }),
  ]);

  const activeOrderCount =
    (orderSummary.byStatus.DRAFT ?? 0) +
    (orderSummary.byStatus.SUBMITTED ?? 0) +
    (orderSummary.byStatus.CONFIRMED ?? 0);
  const completedCount = orderSummary.byStatus.COMPLETED ?? 0;
  const thisMonthSales = clients.reduce((s, c) => s + c.thisMonthSales, 0);

  const now = new Date();
  const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 주문 상태 → 우리 StatusBadge 키 매핑
  const mapStatus = (s: string) => (s === "HOLD" ? "HELD" : s);

  return (
    <div className="space-y-6">
      <PageHeader
        title="🟡 영업 대시보드"
        subtitle={
          <>
            {user.name}님 환영합니다. 배정된{" "}
            <strong className="text-primary">{clients.length}개</strong> 거래처에서{" "}
            이번 달({monthLabel}) 매출 현황입니다.
          </>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="내 거래처"
          value={clients.length}
          desc="활성 배정"
          variant="primary"
          icon="🏢"
          href="/exec/clients"
        />
        <StatCard
          label="진행 주문"
          value={activeOrderCount}
          desc="DRAFT+SUBMITTED+CONFIRMED"
          variant="warning"
          icon="📋"
          href="/exec/orders"
        />
        <StatCard
          label="완료 주문"
          value={completedCount}
          desc="COMPLETED"
          variant="success"
          icon="✅"
          href="/exec/orders?status=COMPLETED"
        />
        <StatCard
          label="이번 달 매출"
          value={`₩${thisMonthSales.toLocaleString()}`}
          desc="ISSUED+SENT 기준"
          variant="purple"
          icon="💰"
          href="/exec/clients"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface rounded shadow-sm border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-h3 m-0">🏆 Top 5 거래처 ({monthLabel})</h2>
            <Link href="/exec/clients" className="text-tiny text-primary hover:underline">
              전체 →
            </Link>
          </div>
          {topClients.length === 0 ? (
            <div className="p-8 text-center text-caption text-ink-muted">
              이번 달 발행된 거래명세서가 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {topClients.map((c, i) => (
                <li key={c.id} className="flex items-center px-5 py-3 text-caption hover:bg-canvas transition">
                  <span className="w-6 text-ink-muted tabular-nums font-semibold">{i + 1}.</span>
                  <span className="flex-1 font-semibold text-ink truncate">
                    {c.name}
                    <span className="ml-2 text-tiny font-mono text-ink-muted">{c.code}</span>
                  </span>
                  <span className="text-ink-secondary text-tiny tabular-nums mr-3">{c.count}건</span>
                  <span className="tabular-nums font-bold text-ink">₩{c.total.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-surface rounded shadow-sm border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-h3 m-0">📦 최근 주문 5건</h2>
            <Link href="/exec/orders" className="text-tiny text-primary hover:underline">
              전체 →
            </Link>
          </div>
          {orderSummary.recent.length === 0 ? (
            <div className="p-8 text-center text-caption text-ink-muted">
              등록된 주문이 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {orderSummary.recent.map((o) => (
                <li key={o.id} className="flex items-center px-5 py-3 text-caption hover:bg-canvas transition">
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/orders/${o.id}`} className="text-primary hover:underline font-mono text-tiny font-semibold">
                      {o.orderNumber ?? "(DRAFT)"}
                    </Link>
                    <div className="text-ink truncate">{o.client.name}</div>
                  </div>
                  <StatusBadge status={mapStatus(o.status)} variant="order" small />
                  <span className="ml-3 text-tiny text-ink-muted tabular-nums">
                    {new Date(o.orderDate).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
