"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const ACTIVES = [
  { v: "ALL", label: "전체" },
  { v: "ACTIVE", label: "활성" },
  { v: "INACTIVE", label: "비활성" },
];

export function ProductListFilter({
  defaultValues,
  categories,
}: {
  defaultValues: { q: string; category: string; active: string };
  categories: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(defaultValues.q);
  const [category, setCategory] = useState(defaultValues.category);
  const [active, setActive] = useState(defaultValues.active);
  const [isPending, start] = useTransition();

  function apply(overrides: Partial<{ q: string; category: string; active: string }> = {}) {
    const next = new URLSearchParams(params.toString());
    const nq = overrides.q ?? q;
    const nc = overrides.category ?? category;
    const na = overrides.active ?? active;
    if (nq.trim()) next.set("q", nq.trim());
    else next.delete("q");
    if (nc && nc !== "ALL") next.set("category", nc);
    else next.delete("category");
    if (na && na !== "ALL") next.set("active", na);
    else next.delete("active");
    start(() => router.push(`/admin/products?${next.toString()}`));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs text-slate-500 mb-1">검색</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="코드·제품명·브랜드·부위"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">카테고리</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            apply({ category: e.target.value });
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="ALL">전체</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
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
