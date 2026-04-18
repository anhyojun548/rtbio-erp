"use client";

/**
 * 수금 목록 — ?clientId · status · from · to 필터 + 인라인 취소(소프트).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelPayment } from "@/lib/actions/payment";

type Client = { id: string; code: string; name: string };

type PaymentRow = {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  note: string | null;
  client: { id: string; code: string; name: string };
  bankTxn: {
    id: string;
    bankName: string;
    payer: string;
    txnDate: string;
    reference: string | null;
  } | null;
};

const STATUSES: { v: string; label: string }[] = [
  { v: "ALL", label: "전체" },
  { v: "PAID", label: "완납" },
  { v: "PARTIAL", label: "일부입금" },
  { v: "PENDING", label: "확인중" },
  { v: "OVERDUE", label: "연체" },
];

function statusBadge(s: PaymentRow["status"]) {
  const map: Record<PaymentRow["status"], string> = {
    PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
    PARTIAL: "bg-amber-100 text-amber-800 border-amber-200",
    PENDING: "bg-slate-100 text-slate-700 border-slate-200",
    OVERDUE: "bg-red-100 text-red-800 border-red-200",
  };
  const label: Record<PaymentRow["status"], string> = {
    PAID: "완납",
    PARTIAL: "일부",
    PENDING: "확인중",
    OVERDUE: "연체",
  };
  return (
    <span
      className={`inline-block text-xs font-medium rounded px-2 py-0.5 border ${map[s]}`}
    >
      {label[s]}
    </span>
  );
}

function isCancelled(row: PaymentRow): boolean {
  return row.status === "PENDING" && (row.note?.includes("[취소]") ?? false);
}

export function PaymentList({
  payments,
  clients,
  defaults,
}: {
  payments: PaymentRow[];
  clients: Client[];
  defaults: { clientId: string; status: string; from: string; to: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState(defaults.clientId);
  const [status, setStatus] = useState(defaults.status);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [busyId, setBusyId] = useState<string | null>(null);

  function apply(
    overrides: Partial<{
      clientId: string;
      status: string;
      from: string;
      to: string;
    }> = {},
  ) {
    const next = new URLSearchParams(params.toString());
    const nc = overrides.clientId ?? clientId;
    const ns = overrides.status ?? status;
    const nf = overrides.from ?? from;
    const nt = overrides.to ?? to;
    if (nc) next.set("clientId", nc);
    else next.delete("clientId");
    if (ns && ns !== "ALL") next.set("status", ns);
    else next.delete("status");
    if (nf) next.set("from", nf);
    else next.delete("from");
    if (nt) next.set("to", nt);
    else next.delete("to");
    start(() => router.push(`/admin/payments?${next.toString()}`));
  }

  function clearFilters() {
    setClientId("");
    setStatus("ALL");
    setFrom("");
    setTo("");
    start(() => router.push(`/admin/payments`));
  }

  async function onCancel(row: PaymentRow) {
    const reason = window.prompt(
      `수금을 취소 처리합니다.\n거래처: ${row.client.name} / 금액: ${row.amount.toLocaleString("ko-KR")}원\n\n사유 (3자 이상):`,
    );
    if (!reason || reason.trim().length < 3) return;
    setBusyId(row.id);
    const res = await cancelPayment(row.id, { reason: reason.trim() });
    setBusyId(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  const total = payments.reduce((s, p) => s + (isCancelled(p) ? 0 : p.amount), 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between px-5 pt-5">
        <div>
          <h2 className="font-semibold text-slate-900">수금 목록</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            유효 합계(취소 제외):{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {total.toLocaleString("ko-KR")}원
            </span>{" "}
            · {payments.length}건
          </p>
        </div>
      </header>

      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="block text-xs text-slate-500 mb-1">거래처</label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              apply({ clientId: e.target.value });
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">전체</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">상태</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              apply({ status: e.target.value });
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">입금일 From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => apply()}
            disabled={pending}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "적용 중…" : "적용"}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-slate-300 bg-white text-slate-700 px-3 py-2 text-sm hover:bg-slate-50"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">입금일</th>
              <th className="px-4 py-2 font-medium">거래처</th>
              <th className="px-4 py-2 font-medium text-right">금액</th>
              <th className="px-4 py-2 font-medium">방법</th>
              <th className="px-4 py-2 font-medium">상태</th>
              <th className="px-4 py-2 font-medium">은행</th>
              <th className="px-4 py-2 font-medium">비고</th>
              <th className="px-4 py-2 font-medium text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-slate-400 text-sm"
                >
                  조건에 맞는 수금 기록이 없습니다.
                </td>
              </tr>
            )}
            {payments.map((p) => {
              const cancelled = isCancelled(p);
              return (
                <tr
                  key={p.id}
                  className={cancelled ? "bg-slate-50/60 text-slate-400" : ""}
                >
                  <td className="px-4 py-2 tabular-nums">
                    {new Date(p.paidAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900">
                      {p.client.name}
                    </div>
                    <div className="text-xs text-slate-500">{p.client.code}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {p.amount.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-4 py-2">{p.method}</td>
                  <td className="px-4 py-2">
                    {cancelled ? (
                      <span className="inline-block text-xs font-medium rounded px-2 py-0.5 border bg-slate-200 text-slate-500 border-slate-300">
                        취소
                      </span>
                    ) : (
                      statusBadge(p.status)
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {p.bankTxn ? (
                      <div className="text-xs">
                        <div className="font-medium text-slate-700">
                          {p.bankTxn.bankName} · {p.bankTxn.payer}
                        </div>
                        <div className="text-slate-400">
                          {new Date(p.bankTxn.txnDate).toLocaleDateString("ko-KR")}
                          {p.bankTxn.reference && ` · ${p.bankTxn.reference}`}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">미매칭</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600 max-w-[220px] truncate">
                    {p.note ?? ""}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!cancelled && (
                      <button
                        type="button"
                        onClick={() => onCancel(p)}
                        disabled={busyId === p.id}
                        className="rounded-md border border-red-200 text-red-600 px-2.5 py-1 text-xs hover:bg-red-50 disabled:opacity-50"
                      >
                        {busyId === p.id ? "처리 중…" : "취소"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
