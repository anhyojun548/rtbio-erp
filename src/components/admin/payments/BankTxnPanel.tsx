"use client";

/**
 * 은행 입금 관리 패널 — 미매칭/매칭 2테이블.
 *   - 미매칭: 수기 입력 · 삭제 · (추가 매칭은 PaymentRecordForm 이용)
 *   - 매칭: 매칭 해제(unmatch)
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createBankTxn,
  deleteBankTxn,
  unmatchBankTxn,
} from "@/lib/actions/payment";

type PaymentSummary = {
  id: string;
  amount: number;
  clientCode: string;
  clientName: string;
};

type Txn = {
  id: string;
  bankName: string;
  payer: string;
  amount: number;
  txnDate: string;
  reference: string | null;
  payments: PaymentSummary[];
};

export function BankTxnPanel({
  unmatchedTxns,
  matchedTxns,
}: {
  unmatchedTxns: Txn[];
  matchedTxns: Txn[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // 수기 입력 폼
  const [bankName, setBankName] = useState("국민은행");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [txnDate, setTxnDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [reference, setReference] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  function onCreate() {
    const n = Number(amount);
    if (!payer.trim()) {
      setMsg({ type: "err", text: "입금자명을 입력해주세요." });
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setMsg({ type: "err", text: "금액은 0보다 커야 합니다." });
      return;
    }
    start(async () => {
      const res = await createBankTxn({
        bankName: bankName.trim(),
        payer: payer.trim(),
        amount: n,
        txnDate: new Date(txnDate),
        reference: reference.trim() ? reference.trim() : undefined,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "은행 거래를 등록했습니다." });
      setPayer("");
      setAmount("");
      setReference("");
      router.refresh();
    });
  }

  async function onDelete(txn: Txn) {
    if (!window.confirm(`${txn.bankName} · ${txn.payer} 거래를 삭제할까요?`))
      return;
    setBusyId(txn.id);
    const res = await deleteBankTxn(txn.id);
    setBusyId(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  async function onUnmatch(txn: Txn) {
    if (
      !window.confirm(
        `${txn.bankName} · ${txn.payer} 매칭을 해제할까요?\n연결된 수금 ${txn.payments.length}건의 은행 매칭이 제거됩니다.`,
      )
    )
      return;
    setBusyId(txn.id);
    const res = await unmatchBankTxn(txn.id);
    setBusyId(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between px-5 pt-5">
        <div>
          <h2 className="font-semibold text-slate-900">은행 입금 내역</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            수기로 입력한 입금 내역을 수금(Payment)과 매칭합니다. 매칭은 상단 수금 등록
            폼에서 "은행 거래 매칭" 드롭다운으로 수행합니다.
          </p>
        </div>
      </header>

      <div className="px-5 py-4 border-b border-slate-200">
        <div className="text-xs font-medium text-slate-700 mb-2">
          + 은행 거래 수기 입력
        </div>
        {msg && (
          <p
            className={`text-sm rounded px-3 py-2 border mb-2 ${
              msg.type === "ok"
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : "text-red-600 bg-red-50 border-red-200"
            }`}
          >
            {msg.text}
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <input
            placeholder="은행명"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="입금자"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="금액"
            value={amount}
            min={0}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
          <input
            type="date"
            value={txnDate}
            onChange={(e) => setTxnDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="참조번호 (선택)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-1"
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={pending}
            className="rounded-md bg-sky-600 text-white px-3 py-2 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {pending ? "등록 중…" : "등록"}
          </button>
        </div>
      </div>

      {/* 미매칭 */}
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="text-sm font-medium text-slate-700 mb-2">
          미매칭 ({unmatchedTxns.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">입금일</th>
                <th className="px-3 py-2 font-medium">은행</th>
                <th className="px-3 py-2 font-medium">입금자</th>
                <th className="px-3 py-2 font-medium text-right">금액</th>
                <th className="px-3 py-2 font-medium">참조</th>
                <th className="px-3 py-2 font-medium text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unmatchedTxns.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-slate-400 text-sm"
                  >
                    미매칭 거래가 없습니다.
                  </td>
                </tr>
              )}
              {unmatchedTxns.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 tabular-nums">
                    {new Date(t.txnDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-2">{t.bankName}</td>
                  <td className="px-3 py-2">{t.payer}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {t.amount.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {t.reference ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(t)}
                      disabled={busyId === t.id}
                      className="rounded-md border border-red-200 text-red-600 px-2.5 py-1 text-xs hover:bg-red-50 disabled:opacity-50"
                    >
                      {busyId === t.id ? "처리 중…" : "삭제"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 매칭 */}
      <div className="px-5 py-4">
        <div className="text-sm font-medium text-slate-700 mb-2">
          매칭 완료 ({matchedTxns.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">입금일</th>
                <th className="px-3 py-2 font-medium">은행</th>
                <th className="px-3 py-2 font-medium">입금자</th>
                <th className="px-3 py-2 font-medium text-right">금액</th>
                <th className="px-3 py-2 font-medium">매칭된 수금</th>
                <th className="px-3 py-2 font-medium text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matchedTxns.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-slate-400 text-sm"
                  >
                    매칭된 거래가 없습니다.
                  </td>
                </tr>
              )}
              {matchedTxns.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 tabular-nums">
                    {new Date(t.txnDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-2">{t.bankName}</td>
                  <td className="px-3 py-2">{t.payer}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {t.amount.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.payments.length === 0 ? (
                      <span className="text-slate-400">(연결 없음)</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {t.payments.map((p) => (
                          <li key={p.id}>
                            <span className="font-medium text-slate-700">
                              {p.clientName}
                            </span>{" "}
                            <span className="text-slate-400">
                              ({p.clientCode})
                            </span>{" "}
                            <span className="tabular-nums">
                              {p.amount.toLocaleString("ko-KR")}원
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onUnmatch(t)}
                      disabled={busyId === t.id}
                      className="rounded-md border border-amber-200 text-amber-700 px-2.5 py-1 text-xs hover:bg-amber-50 disabled:opacity-50"
                    >
                      {busyId === t.id ? "처리 중…" : "매칭 해제"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
