/**
 * 영업 대시보드 — Phase 3F-1.
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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">영업 대시보드</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user.name}님 환영합니다. 배정된{" "}
          <strong className="text-slate-800">{clients.length}개</strong>{" "}
          거래처에서 이번 달({monthLabel}) 매출 현황입니다.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-4">
        <StatCard
          label="내 거래처"
          value={clients.length}
          note="활성 배정"
          href="/exec/clients"
          tone="sky"
        />
        <StatCard
          label="진행 주문"
          value={activeOrderCount}
          note="DRAFT + SUBMITTED + CONFIRMED"
          href="/exec/orders"
          tone="amber"
        />
        <StatCard
          label="완료 주문"
          value={completedCount}
          note="COMPLETED"
          href="/exec/orders?status=COMPLETED"
          tone="emerald"
        />
        <StatCard
          label="이번 달 매출"
          value={thisMonthSales}
          note="ISSUED+SENT 기준 (₩)"
          href="/exec/clients"
          tone="violet"
          isCurrency
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">
              🏆 Top 5 거래처 ({monthLabel})
            </h2>
            <Link
              href="/exec/clients"
              className="text-xs text-sky-700 hover:underline"
            >
              전체 →
            </Link>
          </div>
          {topClients.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              이번 달 발행된 거래명세서가 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topClients.map((c, i) => (
                <li
                  key={c.id}
                  className="flex items-center px-4 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="w-6 text-slate-400 tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="flex-1 font-medium text-slate-800">
                    {c.name}
                    <span className="ml-2 text-[11px] font-mono text-slate-400">
                      {c.code}
                    </span>
                  </span>
                  <span className="text-slate-500 text-xs tabular-nums mr-3">
                    {c.count}건
                  </span>
                  <span className="tabular-nums font-semibold text-slate-900">
                    ₩{c.total.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">📦 최근 주문 5건</h2>
            <Link
              href="/exec/orders"
              className="text-xs text-sky-700 hover:underline"
            >
              전체 →
            </Link>
          </div>
          {orderSummary.recent.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              등록된 주문이 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orderSummary.recent.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center px-4 py-2 text-sm hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-sky-700 hover:underline font-mono text-xs"
                    >
                      {o.orderNumber ?? "(DRAFT)"}
                    </Link>
                    <div className="text-slate-700 truncate">
                      {o.client.name}
                    </div>
                  </div>
                  <StatusBadge status={o.status} />
                  <span className="ml-3 text-xs text-slate-500 tabular-nums">
                    {new Date(o.orderDate).toLocaleDateString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                    })}
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

function StatCard({
  label,
  value,
  note,
  href,
  tone,
  isCurrency,
}: {
  label: string;
  value: number;
  note: string;
  href: string;
  tone: "sky" | "amber" | "emerald" | "violet";
  isCurrency?: boolean;
}) {
  const toneClass =
    tone === "sky"
      ? "hover:border-sky-400"
      : tone === "amber"
        ? "hover:border-amber-400"
        : tone === "emerald"
          ? "hover:border-emerald-400"
          : "hover:border-violet-400";
  const textTone =
    tone === "sky"
      ? "text-sky-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "emerald"
          ? "text-emerald-700"
          : "text-violet-700";
  return (
    <Link
      href={href}
      className={`rounded-lg border border-slate-200 bg-white p-5 transition hover:shadow-sm ${toneClass}`}
    >
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${textTone}`}>
        {isCurrency ? "₩" : ""}
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] text-slate-500 mt-1">{note}</div>
    </Link>
  );
}

const STATUS_BADGE: Record<
  string,
  { label: string; tone: "slate" | "sky" | "amber" | "emerald" | "rose" }
> = {
  DRAFT: { label: "DRAFT", tone: "slate" },
  SUBMITTED: { label: "제출", tone: "sky" },
  CONFIRMED: { label: "확정", tone: "amber" },
  COMPLETED: { label: "완료", tone: "emerald" },
  CANCELLED: { label: "취소", tone: "rose" },
  HELD: { label: "보류", tone: "rose" },
  REJECTED: { label: "반려", tone: "rose" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGE[status] ?? { label: status, tone: "slate" as const };
  const tone =
    meta.tone === "emerald"
      ? "bg-emerald-100 text-emerald-800"
      : meta.tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : meta.tone === "sky"
          ? "bg-sky-100 text-sky-800"
          : meta.tone === "rose"
            ? "bg-rose-100 text-rose-800"
            : "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${tone}`}
    >
      {meta.label}
    </span>
  );
}
