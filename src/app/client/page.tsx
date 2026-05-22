/**
 * 거래처 포털 대시보드 — 내 발주/미수금/계약 요약 (읽기 전용).
 */
import Link from "next/link";
import { getMyDashboard, getMyClient } from "@/lib/actions/client-portal";

export default async function ClientDashboard() {
  const [client, dash] = await Promise.all([getMyClient(), getMyDashboard()]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0">⚪ {client?.name ?? "거래처"} 포털</h1>
        <p className="text-caption text-ink-secondary mt-1">
          <code className="font-mono text-tiny bg-canvas px-1.5 py-0.5 rounded-xs">{client?.code}</code>{" "}
          · 발주·명세서·수금 현황을 확인하세요.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-3">
        <StatCard
          label="진행 중 발주"
          value={`${dash.openOrderCount.toLocaleString()} 건`}
          href="/client/orders?status=OPEN"
          tone="sky"
        />
        <StatCard
          label="완료된 발주"
          value={`${dash.completedOrderCount.toLocaleString()} 건`}
          href="/client/orders?status=COMPLETED"
          tone="emerald"
        />
        <StatCard
          label="이번 달 거래금액"
          value={`${dash.thisMonthSales.toLocaleString()} 원`}
          href="/client/invoices"
          tone="amber"
        />
        <StatCard
          label="미수금 잔액"
          value={`${dash.outstanding.toLocaleString()} 원`}
          note={dash.ledgerMonth}
          href="/client/payments"
          tone={dash.outstanding > 0 ? "rose" : "slate"}
        />
      </section>

      <section className="grid grid-cols-2 gap-4">
        <Panel
          title="최근 발주 5건"
          href="/client/orders"
          empty={dash.recentOrders.length === 0 ? "최근 발주가 없습니다." : null}
        >
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">주문번호</th>
                <th className="px-3 py-2 text-left">날짜</th>
                <th className="px-3 py-2 text-right">수량</th>
                <th className="px-3 py-2 text-right">합계</th>
                <th className="px-3 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dash.recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/client/orders/${o.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(o.orderDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {o.itemCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {o.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="최근 거래명세서 5건"
          href="/client/invoices"
          empty={
            dash.recentInvoices.length === 0
              ? "아직 발행된 거래명세서가 없습니다."
              : null
          }
        >
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">번호</th>
                <th className="px-3 py-2 text-left">발행일</th>
                <th className="px-3 py-2 text-right">합계</th>
                <th className="px-3 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dash.recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/client/invoices/${inv.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(inv.issueDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {inv.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </section>

      {dash.expiringContracts.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900 text-sm mb-2">
            ⚠️ 만료 임박 계약서 (30일 이내)
          </h2>
          <ul className="space-y-1 text-sm">
            {dash.expiringContracts.map((c) => (
              <li key={c.id} className="flex justify-between">
                <Link
                  href={`/client/contracts/${c.id}`}
                  className="text-amber-800 hover:underline"
                >
                  {c.title}
                </Link>
                <span className="text-xs text-amber-700 tabular-nums">
                  {c.endDate
                    ? new Date(c.endDate).toLocaleDateString("ko-KR")
                    : "-"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 작은 컴포넌트들
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  note,
  href,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
  tone?: "sky" | "emerald" | "amber" | "rose" | "slate";
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : tone === "sky"
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-slate-200 bg-white text-slate-800";
  const inner = (
    <div className={`rounded-lg border p-4 ${toneCls}`}>
      <p className="text-xs opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {note && <p className="text-[11px] opacity-60 mt-1">{note}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:brightness-95 transition">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Panel({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href?: string;
  empty?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 text-sm">{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-sky-700 hover:underline">
            전체 보기 →
          </Link>
        )}
      </div>
      {empty ? (
        <div className="p-6 text-center text-sm text-slate-500">{empty}</div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

const ORDER_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-sky-100 text-sky-800",
  CONFIRMED: "bg-amber-100 text-amber-800",
  SHIPPING: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
  HELD: "bg-rose-100 text-rose-800",
  REJECTED: "bg-rose-100 text-rose-800",
};
const ORDER_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  SUBMITTED: "제출",
  CONFIRMED: "확정",
  SHIPPING: "출고중",
  COMPLETED: "완료",
  CANCELLED: "취소",
  HELD: "보류",
  REJECTED: "반려",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
        ORDER_TONE[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {ORDER_LABEL[status] ?? status}
    </span>
  );
}

const INVOICE_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-sky-100 text-sky-800",
  SENT: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};
const INVOICE_LABEL: Record<string, string> = {
  DRAFT: "임시",
  ISSUED: "발행",
  SENT: "전송",
  CANCELLED: "취소",
};

function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
        INVOICE_TONE[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {INVOICE_LABEL[status] ?? status}
    </span>
  );
}
