"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const TYPES: { v: string; label: string }[] = [
  { v: "ALL", label: "전체" },
  { v: "AGENCY", label: "대리점" },
  { v: "HOSPITAL", label: "병원" },
  { v: "PHARMACY", label: "약국" },
  { v: "OTHER", label: "기타" },
];
const ACTIVES = [
  { v: "ALL", label: "전체" },
  { v: "ACTIVE", label: "활성" },
  { v: "INACTIVE", label: "비활성" },
];

export function ClientListFilter({
  defaultValues,
}: {
  defaultValues: { q: string; type: string; active: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(defaultValues.q);
  const [type, setType] = useState(defaultValues.type);
  const [active, setActive] = useState(defaultValues.active);
  const [isPending, start] = useTransition();

  function apply(overrides: Partial<{ q: string; type: string; active: string }> = {}) {
    const next = new URLSearchParams(params.toString());
    const nq = overrides.q ?? q;
    const nt = overrides.type ?? type;
    const na = overrides.active ?? active;
    if (nq.trim()) next.set("q", nq.trim());
    else next.delete("q");
    if (nt && nt !== "ALL") next.set("type", nt);
    else next.delete("type");
    if (na && na !== "ALL") next.set("active", na);
    else next.delete("active");
    start(() => router.push(`/admin/clients?${next.toString()}`));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs text-slate-500 mb-1">검색</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="코드·업체명·대표자·연락처"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">유형</label>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            apply({ type: e.target.value });
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          {TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">상태</label>
        <select
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            apply({ active: e.target.value });
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          {ACTIVES.map((a) => (
            <option key={a.v} value={a.v}>
              {a.label}
            </option>
          ))}
        </select>
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
