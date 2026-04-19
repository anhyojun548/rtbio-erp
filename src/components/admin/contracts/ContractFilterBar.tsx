"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { ContractStatus } from "@/lib/validators/sales-contract";
import { CONTRACT_STATUS_LABEL } from "@/lib/validators/sales-contract";

type Defaults = {
  q: string;
  status: ContractStatus | "ALL";
  signed: string; // "" | "1" | "0"
};

const STATUSES: ContractStatus[] = [
  "ACTIVE",
  "ENDING_SOON",
  "EXPIRED",
  "FUTURE",
];

export function ContractFilterBar({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(defaults.q);
  const [status, setStatus] = useState<ContractStatus | "ALL">(defaults.status);
  const [signed, setSigned] = useState<string>(defaults.signed);

  function apply() {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    if (status !== "ALL") next.set("status", status);
    else next.delete("status");
    if (signed !== "") next.set("signed", signed);
    else next.delete("signed");
    start(() => router.push(`/admin/contracts?${next.toString()}`));
  }

  function reset() {
    setQ("");
    setStatus("ALL");
    setSigned("");
    start(() => router.push("/admin/contracts"));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">검색</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="제목 / 거래처명 / 거래처코드"
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">상태</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ContractStatus | "ALL")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">전체</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {CONTRACT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">서명</label>
        <select
          value={signed}
          onChange={(e) => setSigned(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">전체</option>
          <option value="1">서명완료</option>
          <option value="0">미서명</option>
        </select>
      </div>
      <button
        onClick={apply}
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
      >
        적용
      </button>
      <button
        onClick={reset}
        disabled={pending}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        초기화
      </button>
    </div>
  );
}
