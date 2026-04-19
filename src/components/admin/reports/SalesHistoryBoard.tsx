"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  SALES_EVENT_LABEL,
  SALES_EVENT_ICON,
  type SalesEventType,
} from "@/lib/validators/sales-history";

type Rep = { id: string; name: string; email: string; role: string };

type Event = {
  type: SalesEventType;
  occurredAt: string;
  refId: string;
  clientId: string | null;
  clientName: string;
  title: string;
  amount: number | null;
  meta?: Record<string, string | number | null>;
};

type History = {
  salesRepId: string;
  from: string;
  to: string;
  totals: {
    orders: { count: number; amount: number };
    invoices: { count: number; amount: number };
    payments: { count: number; amount: number };
    visitors: { count: number };
  };
  byClient: Array<{
    clientId: string;
    clientName: string;
    clientCode: string;
    orders: number;
    invoiceAmount: number;
    paymentAmount: number;
    visitors: number;
  }>;
  events: Event[];
};

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtDateTime(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function eventHref(e: Event): string | null {
  switch (e.type) {
    case "ORDER_CREATED":
      return `/admin/orders/${e.refId}`;
    case "INVOICE_ISSUED":
      return `/admin/invoices/${e.refId}`;
    case "PAYMENT_RECEIVED":
      return `/admin/payments`;
    case "CONFERENCE_VISITOR":
      return null;
  }
}

export function SalesHistoryBoard({
  history,
  reps,
  currentRepId,
  currentRepName,
  from,
  to,
  isOwnerOrAdmin,
}: {
  history: History;
  reps: Rep[];
  currentRepId: string;
  currentRepName: string;
  from: string;
  to: string;
  isOwnerOrAdmin: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [repId, setRepId] = useState(currentRepId);
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [typeFilter, setTypeFilter] = useState<SalesEventType | "ALL">("ALL");

  function apply() {
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set("repId", repId);
    next.set("from", fromDate);
    next.set("to", toDate);
    start(() =>
      router.push(`/admin/reports/sales-history?${next.toString()}`),
    );
  }

  const filteredEvents =
    typeFilter === "ALL"
      ? history.events
      : history.events.filter((e) => e.type === typeFilter);

  return (
    <div className="space-y-6">
      {/* ─── 필터 바 ───────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3">
        {isOwnerOrAdmin && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">담당자</label>
            <select
              value={repId}
              onChange={(e) => setRepId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm min-w-[180px]"
            >
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.role})
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-500 mb-1">시작일</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">종료일</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={apply}
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
        >
          조회
        </button>
        <div className="ml-auto text-sm text-slate-500">
          <span className="font-medium text-slate-700">{currentRepName}</span> 님의 기간{" "}
          <span className="font-mono text-xs">
            {from} ~ {to}
          </span>
        </div>
      </div>

      {/* ─── 요약 카드 ─────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="주문 접수"
          icon="📝"
          count={history.totals.orders.count}
          amount={history.totals.orders.amount}
          color="sky"
        />
        <SummaryCard
          label="명세서 발행"
          icon="🧾"
          count={history.totals.invoices.count}
          amount={history.totals.invoices.amount}
          color="emerald"
        />
        <SummaryCard
          label="수금 확인"
          icon="💰"
          count={history.totals.payments.count}
          amount={history.totals.payments.amount}
          color="amber"
        />
        <SummaryCard
          label="학회 방문자"
          icon="🎓"
          count={history.totals.visitors.count}
          amount={null}
          color="violet"
        />
      </section>

      {/* ─── 거래처별 Breakdown ─────────────────────── */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">거래처별 활동</h2>
          <span className="text-xs text-slate-500">
            {history.byClient.length}개 거래처
          </span>
        </div>
        {history.byClient.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            해당 기간에 활동 내역이 없습니다.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left font-medium">거래처</th>
                <th className="px-4 py-2 text-right font-medium">주문수</th>
                <th className="px-4 py-2 text-right font-medium">명세서 합</th>
                <th className="px-4 py-2 text-right font-medium">수금 합</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.byClient.map((c) => (
                <tr key={c.clientId} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/clients/${c.clientId}`}
                      className="text-sky-700 hover:underline"
                    >
                      {c.clientName}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400 font-mono">
                      {c.clientCode}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.orders}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                    ₩{fmt(c.invoiceAmount)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-amber-700">
                    ₩{fmt(c.paymentAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ─── 타임라인 ─────────────────────────────── */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-slate-900">
            이벤트 타임라인
            <span className="ml-2 text-xs font-normal text-slate-500">
              ({filteredEvents.length}건)
            </span>
          </h2>
          <div className="flex gap-1">
            {(["ALL", ...Object.keys(SALES_EVENT_LABEL)] as const).map(
              (t) => (
                <button
                  key={t}
                  onClick={() =>
                    setTypeFilter(t as SalesEventType | "ALL")
                  }
                  className={`rounded-md px-3 py-1 text-xs border ${
                    typeFilter === t
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t === "ALL"
                    ? "전체"
                    : SALES_EVENT_LABEL[t as SalesEventType]}
                </button>
              ),
            )}
          </div>
        </div>
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            해당 기간·필터에 해당하는 이벤트가 없습니다.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {filteredEvents.map((e) => (
              <li key={`${e.type}:${e.refId}`} className="p-4 hover:bg-slate-50">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5">
                    {SALES_EVENT_ICON[e.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs">
                        {SALES_EVENT_LABEL[e.type]}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {e.clientName}
                      </span>
                      {e.amount !== null && (
                        <span className="text-sm tabular-nums text-slate-700">
                          ₩{fmt(e.amount)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {fmtDateTime(e.occurredAt)} ·{" "}
                      {eventHref(e) ? (
                        <Link
                          href={eventHref(e)!}
                          className="text-sky-700 hover:underline"
                        >
                          {e.title}
                        </Link>
                      ) : (
                        <span>{e.title}</span>
                      )}
                      {e.meta?.status && (
                        <span className="ml-2 text-slate-400">
                          [{String(e.meta.status)}]
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  icon,
  count,
  amount,
  color,
}: {
  label: string;
  icon: string;
  count: number;
  amount: number | null;
  color: "sky" | "emerald" | "amber" | "violet";
}) {
  const classes: Record<typeof color, { bg: string; text: string; border: string }> = {
    sky: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
    emerald: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    violet: {
      bg: "bg-violet-50",
      text: "text-violet-700",
      border: "border-violet-200",
    },
  };
  const c = classes[color];
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-4`}>
      <div className={`text-xs font-medium ${c.text} mb-1 flex items-center gap-1`}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${c.text} tabular-nums`}>
        {count.toLocaleString()}
      </div>
      {amount !== null && (
        <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
          ₩{fmt(amount)}
        </div>
      )}
    </div>
  );
}
