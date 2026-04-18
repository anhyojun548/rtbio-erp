"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { InventoryLogType } from "@prisma/client";

const TYPES: Array<InventoryLogType | "ALL"> = [
  "ALL",
  "RECEIVE",
  "RESERVE",
  "RELEASE",
  "SHIP",
  "RETURN",
  "ADJUST_IN",
  "ADJUST_OUT",
];

const TYPE_LABEL: Record<InventoryLogType | "ALL", string> = {
  ALL: "전체",
  RECEIVE: "입고",
  RESERVE: "예약",
  RELEASE: "예약해제",
  SHIP: "출고",
  RETURN: "반품",
  ADJUST_IN: "조정(+)",
  ADJUST_OUT: "조정(-)",
};

export function LogFilterBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [type, setType] = useState<InventoryLogType | "ALL">(
    (sp.get("type") as InventoryLogType | "ALL") ?? "ALL",
  );
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function apply() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (type !== "ALL") params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/admin/inventory/logs?${params.toString()}`);
  }

  function reset() {
    setQ("");
    setType("ALL");
    setFrom("");
    setTo("");
    router.push("/admin/inventory/logs");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3"
    >
      <input
        type="text"
        placeholder="제품명 / 코드 / 사이즈"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="flex-1 min-w-[180px] rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as InventoryLogType | "ALL")}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500"
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500"
      />
      <span className="text-slate-400 text-xs">~</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500"
      />
      <button
        type="submit"
        className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700"
      >
        조회
      </button>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        초기화
      </button>
    </form>
  );
}
