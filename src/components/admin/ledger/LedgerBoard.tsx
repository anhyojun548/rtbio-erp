"use client";

/**
 * 월 마감 원장 보드 — 월 선택 · 거래처 필터 · 일괄 재계산 · 거래처별 재계산/마감/재개.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  recomputeLedger,
  recomputeLedgerMonth,
  closeMonth,
  reopenMonth,
} from "@/lib/actions/ledger";

type Client = { id: string; code: string; name: string };

type Row = {
  clientId: string;
  code: string;
  name: string;
  exists: boolean;
  carryOver: number;
  monthlySales: number;
  received: number;
  balance: number;
  closedAt: string | null;
  note: string | null;
};

function prevMonthStr(m: string): string {
  const y = Number(m.slice(0, 4));
  const mm = Number(m.slice(5, 7));
  const pm = mm === 1 ? 12 : mm - 1;
  const py = mm === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

function nextMonthStr(m: string): string {
  const y = Number(m.slice(0, 4));
  const mm = Number(m.slice(5, 7));
  const nm = mm === 12 ? 1 : mm + 1;
  const ny = mm === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function LedgerBoard({
  month,
  clients,
  selectedClientId,
  rows,
}: {
  month: string;
  clients: Client[];
  selectedClientId: string;
  rows: Row[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.push(`/admin/ledger?${next.toString()}`));
  }

  async function onRecomputeOne(clientId: string, name: string) {
    setBusyClientId(clientId);
    setMsg(null);
    const res = await recomputeLedger({ clientId, closingMonth: month });
    setBusyClientId(null);
    if (!res.ok) {
      setMsg({ type: "err", text: `${name}: ${res.error}` });
      return;
    }
    setMsg({ type: "ok", text: `${name} 재계산 완료.` });
    router.refresh();
  }

  async function onRecomputeAll() {
    if (!window.confirm(`${month} 의 활성 거래처 전체를 재계산할까요?`)) return;
    setMsg(null);
    start(async () => {
      const res = await recomputeLedgerMonth({ closingMonth: month });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setMsg({
        type: "ok",
        text: `일괄 재계산: 성공 ${res.data.updated}건 / 스킵 ${res.data.skipped}건.`,
      });
      router.refresh();
    });
  }

  async function onClose(row: Row) {
    if (!row.exists) {
      alert("원장이 없습니다. 먼저 재계산 하세요.");
      return;
    }
    const note = window.prompt(
      `${row.name} ${month} 월을 마감합니다.\n마감 메모 (선택):`,
      "",
    );
    if (note === null) return; // 취소
    setBusyClientId(row.clientId);
    setMsg(null);
    const res = await closeMonth({
      clientId: row.clientId,
      closingMonth: month,
      note: note.trim() ? note.trim() : undefined,
    });
    setBusyClientId(null);
    if (!res.ok) {
      setMsg({ type: "err", text: `${row.name}: ${res.error}` });
      return;
    }
    setMsg({ type: "ok", text: `${row.name} ${month} 마감 완료.` });
    router.refresh();
  }

  async function onReopen(row: Row) {
    const reason = window.prompt(
      `${row.name} ${month} 월 마감을 해제합니다.\n사유 (3자 이상):`,
    );
    if (!reason || reason.trim().length < 3) return;
    setBusyClientId(row.clientId);
    setMsg(null);
    const res = await reopenMonth({
      clientId: row.clientId,
      closingMonth: month,
      reason: reason.trim(),
    });
    setBusyClientId(null);
    if (!res.ok) {
      setMsg({ type: "err", text: `${row.name}: ${res.error}` });
      return;
    }
    setMsg({ type: "ok", text: `${row.name} ${month} 재개 완료.` });
    router.refresh();
  }

  const totals = rows
    .filter((r) => r.exists)
    .reduce(
      (a, r) => ({
        carryOver: a.carryOver + r.carryOver,
        monthlySales: a.monthlySales + r.monthlySales,
        received: a.received + r.received,
        balance: a.balance + r.balance,
      }),
      { carryOver: 0, monthlySales: 0, received: 0, balance: 0 },
    );

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setParam("month", prevMonthStr(month))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm hover:bg-slate-50"
          >
            ◀
          </button>
          <div>
            <label className="block text-xs text-slate-500 mb-1">마감월</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setParam("month", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setParam("month", nextMonthStr(month))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm hover:bg-slate-50"
          >
            ▶
          </button>
        </div>
        <div className="min-w-[220px]">
          <label className="block text-xs text-slate-500 mb-1">거래처 필터</label>
          <select
            value={selectedClientId}
            onChange={(e) => setParam("clientId", e.target.value)}
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
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRecomputeAll}
          disabled={pending}
          className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "재계산 중…" : "이달 일괄 재계산"}
        </button>
      </div>

      {msg && (
        <p
          className={`text-sm rounded px-3 py-2 border mx-5 mt-3 ${
            msg.type === "ok"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-red-600 bg-red-50 border-red-200"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">거래처</th>
              <th className="px-3 py-2 font-medium text-right">이월</th>
              <th className="px-3 py-2 font-medium text-right">당월매출</th>
              <th className="px-3 py-2 font-medium text-right">입금</th>
              <th className="px-3 py-2 font-medium text-right">잔액</th>
              <th className="px-3 py-2 font-medium">상태</th>
              <th className="px-3 py-2 font-medium text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-400 text-sm"
                >
                  활성 거래처가 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const closed = !!r.closedAt;
              const busy = busyClientId === r.clientId;
              return (
                <tr key={r.clientId}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.code}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.exists ? (
                      `${r.carryOver.toLocaleString("ko-KR")}원`
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.exists ? (
                      `${r.monthlySales.toLocaleString("ko-KR")}원`
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.exists ? (
                      `${r.received.toLocaleString("ko-KR")}원`
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {r.exists ? (
                      <span
                        className={
                          r.balance > 0
                            ? "text-red-600"
                            : r.balance < 0
                              ? "text-emerald-700"
                              : "text-slate-700"
                        }
                      >
                        {r.balance.toLocaleString("ko-KR")}원
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!r.exists && (
                      <span className="inline-block text-xs rounded px-2 py-0.5 border bg-slate-100 text-slate-500 border-slate-200">
                        원장 없음
                      </span>
                    )}
                    {r.exists && closed && (
                      <span className="inline-block text-xs rounded px-2 py-0.5 border bg-slate-900 text-white border-slate-900">
                        마감 ·{" "}
                        {new Date(r.closedAt!).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                    {r.exists && !closed && (
                      <span className="inline-block text-xs rounded px-2 py-0.5 border bg-amber-50 text-amber-700 border-amber-200">
                        집계중
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <button
                      type="button"
                      onClick={() => onRecomputeOne(r.clientId, r.name)}
                      disabled={busy || closed}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                      title={closed ? "마감 해제 후 재계산 가능" : "재계산"}
                    >
                      {busy ? "…" : "재계산"}
                    </button>
                    {r.exists && !closed && (
                      <button
                        type="button"
                        onClick={() => onClose(r)}
                        disabled={busy}
                        className="rounded-md bg-slate-900 text-white px-2.5 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                      >
                        마감
                      </button>
                    )}
                    {r.exists && closed && (
                      <button
                        type="button"
                        onClick={() => onReopen(r)}
                        disabled={busy}
                        className="rounded-md border border-amber-300 text-amber-700 bg-white px-2.5 py-1 text-xs hover:bg-amber-50 disabled:opacity-50"
                      >
                        재개
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.some((r) => r.exists) && (
            <tfoot className="bg-slate-50 text-slate-700 font-medium">
              <tr>
                <td className="px-3 py-2">합계 (원장 있는 거래처만)</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totals.carryOver.toLocaleString("ko-KR")}원
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totals.monthlySales.toLocaleString("ko-KR")}원
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totals.received.toLocaleString("ko-KR")}원
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totals.balance.toLocaleString("ko-KR")}원
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
