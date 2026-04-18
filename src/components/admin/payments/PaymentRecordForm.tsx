"use client";

/**
 * 수금 등록 폼 — 거래처 선택 + 금액/날짜/방법/상태/비고 + 선택적 은행거래 매칭.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordPayment } from "@/lib/actions/payment";

type Client = { id: string; code: string; name: string };
type UnmatchedTxn = {
  id: string;
  bankName: string;
  payer: string;
  amount: number;
  txnDate: string;
};

const METHODS = ["계좌이체", "카드", "현금", "기타"];
const STATUSES: { v: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE"; label: string }[] =
  [
    { v: "PAID", label: "완납" },
    { v: "PARTIAL", label: "일부입금" },
    { v: "PENDING", label: "확인중" },
    { v: "OVERDUE", label: "연체" },
  ];

export function PaymentRecordForm({
  clients,
  unmatchedTxns,
}: {
  clients: Client[];
  unmatchedTxns: UnmatchedTxn[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [method, setMethod] = useState("계좌이체");
  const [status, setStatus] = useState<
    "PENDING" | "PARTIAL" | "PAID" | "OVERDUE"
  >("PAID");
  const [bankTxnId, setBankTxnId] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  function reset() {
    setClientId("");
    setAmount("");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setMethod("계좌이체");
    setStatus("PAID");
    setBankTxnId("");
    setNote("");
  }

  function save() {
    if (!clientId) {
      setMsg({ type: "err", text: "거래처를 선택해주세요." });
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setMsg({ type: "err", text: "금액은 0보다 커야 합니다." });
      return;
    }
    start(async () => {
      const res = await recordPayment({
        clientId,
        amount: n,
        paidAt: new Date(paidAt),
        method,
        status,
        bankTxnId: bankTxnId || undefined,
        note: note.trim() ? note : undefined,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "수금이 등록되었습니다." });
      reset();
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">수금 등록</h2>
        <span className="text-xs text-slate-500">
          은행 거래와 매칭하려면 "매칭" 드롭다운에서 선택
        </span>
      </header>

      {msg && (
        <p
          className={`text-sm rounded px-3 py-2 border ${
            msg.type === "ok"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-red-600 bg-red-50 border-red-200"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">거래처 *</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">— 선택 —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">입금일 *</label>
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">금액 *</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">결제수단</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">상태</label>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as typeof status)
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs text-slate-500 mb-1">
            은행 거래 매칭 (선택)
          </label>
          <select
            value={bankTxnId}
            onChange={(e) => setBankTxnId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">— 매칭 없음 —</option>
            {unmatchedTxns.map((t) => (
              <option key={t.id} value={t.id}>
                {new Date(t.txnDate).toLocaleDateString("ko-KR")} · {t.bankName} ·{" "}
                {t.payer} · {t.amount.toLocaleString("ko-KR")}원
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs text-slate-500 mb-1">비고</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="메모 (선택)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "등록 중…" : "수금 등록"}
        </button>
      </div>
    </section>
  );
}
