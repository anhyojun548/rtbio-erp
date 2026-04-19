"use client";

/**
 * 내 주문 테이블 — 상태/기간/검색 필터. URL 쿼리 기반으로 서버 쿼리에 전달.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { OrderStatus } from "@prisma/client";

type Row = {
  id: string;
  orderNumber: string | null;
  orderDate: string;
  status: OrderStatus;
  client: { id: string; code: string; name: string };
  itemCount: number;
  totalAmount: number;
  shipToLabel: string | null;
  shipToRecipient: string | null;
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "DRAFT",
  SUBMITTED: "제출",
  CONFIRMED: "확정",
  HOLD: "보류",
  REJECTED: "반려",
  SHIPPING: "출고중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-sky-50 text-sky-700",
  CONFIRMED: "bg-indigo-50 text-indigo-700",
  HOLD: "bg-amber-50 text-amber-700",
  REJECTED: "bg-red-50 text-red-700",
  SHIPPING: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500 line-through",
};

const ALL_STATUSES: OrderStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "HOLD",
  "REJECTED",
  "SHIPPING",
  "COMPLETED",
  "CANCELLED",
];

export function MyOrdersTable({
  rows,
  defaultValues,
}: {
  rows: Row[];
  defaultValues: {
    q: string;
    status: OrderStatus | "ALL";
    from: string;
    to: string;
  };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(defaultValues.q);
  const [status, setStatus] = useState<OrderStatus | "ALL">(defaultValues.status);
  const [from, setFrom] = useState(defaultValues.from);
  const [to, setTo] = useState(defaultValues.to);

  function apply() {
    const next = new URLSearchParams(params.toString());
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    if (status !== "ALL") next.set("status", status);
    else next.delete("status");
    if (from) next.set("from", from);
    else next.delete("from");
    if (to) next.set("to", to);
    else next.delete("to");
    startTransition(() => {
      router.push(`/exec/orders?${next.toString()}`);
    });
  }

  function reset() {
    setQ("");
    setStatus("ALL");
    setFrom("");
    setTo("");
    startTransition(() => {
      router.push(`/exec/orders`);
    });
  }

  const hasFilter = q || status !== "ALL" || from || to;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input
          type="text"
          placeholder="주문번호·거래처명·코드"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
          className="flex-1 min-w-[12rem] rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "ALL")}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="ALL">전체 상태</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <span className="text-slate-400 text-xs">~</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          className="rounded-md bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "조회중…" : "조회"}
        </button>
        {hasFilter && (
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            초기화
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {hasFilter
            ? "필터 조건에 해당하는 주문이 없습니다."
            : "등록된 주문이 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">주문번호</th>
                <th className="px-3 py-2 text-left">주문일</th>
                <th className="px-3 py-2 text-left">거래처</th>
                <th className="px-3 py-2 text-left">배송지</th>
                <th className="px-3 py-2 text-right">라인</th>
                <th className="px-3 py-2 text-right">합계</th>
                <th className="px-3 py-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      {o.orderNumber ?? "(DRAFT)"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600 tabular-nums">
                    {new Date(o.orderDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-800 font-medium">
                      {o.client.name}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {o.client.code}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {o.shipToLabel ?? "-"}
                    {o.shipToRecipient ? ` / ${o.shipToRecipient}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {o.itemCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                    {o.totalAmount > 0
                      ? `₩${o.totalAmount.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
