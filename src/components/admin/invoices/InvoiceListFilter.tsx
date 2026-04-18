"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const STATUSES: { v: string; label: string }[] = [
  { v: "ALL", label: "전체" },
  { v: "DRAFT", label: "DRAFT" },
  { v: "ISSUED", label: "발행" },
  { v: "SENT", label: "발송완료" },
  { v: "CANCELLED", label: "취소" },
];

export function InvoiceListFilter({
  defaultValues,
}: {
  defaultValues: { q: string; status: string; from: string; to: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(defaultValues.q);
  const [status, setStatus] = useState(defaultValues.status);
  const [from, setFrom] = useState(defaultValues.from);
  const [to, setTo] = useState(defaultValues.to);
  const [isPending, start] = useTransition();

  function apply(
    overrides: Partial<{
      q: string;
      status: string;
      from: string;
      to: string;
    }> = {},
  ) {
    const next = new URLSearchParams(params.toString());
    const nq = overrides.q ?? q;
    const ns = overrides.status ?? status;
    const nf = overrides.from ?? from;
    const nt = overrides.to ?? to;
    if (nq.trim()) next.set("q", nq.trim());
    else next.delete("q");
    if (ns && ns !== "ALL") next.set("status", ns);
    else next.delete("status");
    if (nf) next.set("from", nf);
    else next.delete("from");
    if (nt) next.set("to", nt);
    else next.delete("to");
    start(() => router.push(`/admin/invoices?${next.toString()}`));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs text-slate-500 mb-1">검색</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="명세서번호·거래처명·코드"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
        />
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
        <label className="block text-xs text-slate-500 mb-1">발행일 From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
        />
      </div>
      <button
        type="button"
        onClick={() => apply()}
        disabled={isPending}
        className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition"
      >
        {isPending ? "검색 중…" : "검색"}
      </button>
    </div>
  );
}
