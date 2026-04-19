"use client";

/**
 * 출고내역 필터 + 테이블 (R17).
 *
 * URLSearchParams 기반 필터. 값 변경 시 router.push 로 재요청.
 * 기간 입력은 yyyy-mm-dd, clientId 드롭다운, 자유 검색 q.
 */
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type Row = {
  id: string;
  completedAt: string | null;
  orderId: string;
  orderNumber: string;
  orderDate: string;
  clientCode: string;
  clientName: string;
  shipToRecipient: string | null;
  shipToAddress: string | null;
  itemCount: number;
  itemSummary: string;
  totalAmount: number;
};

type Client = { id: string; code: string; name: string };

type Selected = { clientId: string; from: string; to: string; q: string };

export function ShipmentHistoryBoard({
  rows,
  clients,
  selected,
}: {
  rows: Row[];
  clients: Client[];
  selected: Selected;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const [form, setForm] = useState(selected);

  function applyFilter(next: Selected) {
    const params = new URLSearchParams();
    if (next.clientId) params.set("clientId", next.clientId);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.q.trim()) params.set("q", next.q.trim());
    const qs = params.toString();
    start(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function reset() {
    const empty: Selected = { clientId: "", from: "", to: "", q: "" };
    setForm(empty);
    applyFilter(empty);
  }

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">거래처</label>
          <select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">전체</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">
            완료일(시작)
          </label>
          <input
            type="date"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">
            완료일(종료)
          </label>
          <input
            type="date"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">검색</label>
          <input
            type="text"
            value={form.q}
            onChange={(e) => setForm({ ...form, q: e.target.value })}
            placeholder="주문번호/거래처"
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilter(form);
            }}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => applyFilter(form)}
            disabled={pending}
            className="flex-1 rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {pending ? "…" : "적용"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="rounded-md border border-slate-300 bg-white text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">완료일시</th>
              <th className="px-3 py-2 font-medium">주문번호</th>
              <th className="px-3 py-2 font-medium">거래처</th>
              <th className="px-3 py-2 font-medium">품목</th>
              <th className="px-3 py-2 font-medium text-right">수량</th>
              <th className="px-3 py-2 font-medium text-right">합계</th>
              <th className="px-3 py-2 font-medium">배송지</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-slate-400 text-sm"
                >
                  조건에 맞는 출고 내역이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 tabular-nums text-xs text-slate-700">
                  {r.completedAt
                    ? new Date(r.completedAt).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/admin/orders/${r.orderId}`}
                    className="text-sky-700 hover:underline"
                  >
                    {r.orderNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">
                    {r.clientName}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {r.clientCode}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  {r.itemSummary || "-"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.itemCount.toLocaleString("ko-KR")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                  {r.totalAmount.toLocaleString("ko-KR")}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[220px]">
                  {r.shipToRecipient ? `${r.shipToRecipient} / ` : ""}
                  {r.shipToAddress ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sp.toString() && (
        <p className="text-xs text-slate-400">
          적용된 필터: <code className="font-mono">?{sp.toString()}</code>
        </p>
      )}
    </section>
  );
}
