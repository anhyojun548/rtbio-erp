"use client";

/**
 * 내 거래처 테이블 — 검색/정렬/타입 필터.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

type Row = {
  id: string;
  code: string;
  name: string;
  type: string;
  phone: string | null;
  representative: string | null;
  addressCount: number;
  orderCount: number;
  lastOrder: {
    id: string;
    orderNumber: string | null;
    orderDate: string;
    status: string;
  } | null;
  thisMonthSales: number;
};

type SortKey = "name" | "orderCount" | "thisMonthSales" | "lastOrder";

export function MyClientsTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("thisMonthSales");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.type);
    return ["ALL", ...[...set].sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    const res = rows.filter((r) => {
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      if (qLower) {
        const hay = `${r.code} ${r.name} ${r.representative ?? ""} ${r.phone ?? ""}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
    res.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name, "ko");
        case "orderCount":
          return dir * (a.orderCount - b.orderCount);
        case "thisMonthSales":
          return dir * (a.thisMonthSales - b.thisMonthSales);
        case "lastOrder": {
          const la = a.lastOrder?.orderDate ?? "";
          const lb = b.lastOrder?.orderDate ?? "";
          return dir * la.localeCompare(lb);
        }
      }
    });
    return res;
  }, [rows, q, typeFilter, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  }

  const hasFilter = q.length > 0 || typeFilter !== "ALL";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input
          type="text"
          placeholder="거래처명·코드·대표자·전화 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t === "ALL" ? "전체 유형" : t}
            </option>
          ))}
        </select>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTypeFilter("ALL");
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            초기화
          </button>
        )}
        <span className="text-xs text-slate-500 tabular-nums ml-2">
          {filtered.length} / {rows.length}건
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {rows.length === 0
            ? "배정된 거래처가 없습니다."
            : "필터 조건에 해당하는 거래처가 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-600 uppercase tracking-wide">
              <tr>
                <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                  거래처
                </Th>
                <th className="px-3 py-2 text-left">유형</th>
                <th className="px-3 py-2 text-left">연락처</th>
                <Th
                  onClick={() => toggleSort("orderCount")}
                  active={sortKey === "orderCount"}
                  dir={sortDir}
                  align="right"
                >
                  누적 주문
                </Th>
                <Th
                  onClick={() => toggleSort("thisMonthSales")}
                  active={sortKey === "thisMonthSales"}
                  dir={sortDir}
                  align="right"
                >
                  이달 매출
                </Th>
                <Th
                  onClick={() => toggleSort("lastOrder")}
                  active={sortKey === "lastOrder"}
                  dir={sortDir}
                >
                  최근 주문
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="text-sky-700 hover:underline font-medium"
                    >
                      {c.name}
                    </Link>
                    <div className="font-mono text-[10px] text-slate-400">
                      {c.code}
                      {c.representative && ` · ${c.representative}`}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{c.type}</td>
                  <td className="px-3 py-2 text-slate-600 tabular-nums">
                    {c.phone ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {c.orderCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                    {c.thisMonthSales > 0
                      ? `₩${c.thisMonthSales.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.lastOrder ? (
                      <Link
                        href={`/admin/orders/${c.lastOrder.id}`}
                        className="text-sky-700 hover:underline"
                      >
                        <span className="font-mono">
                          {c.lastOrder.orderNumber ?? "(DRAFT)"}
                        </span>
                        <span className="text-slate-500 ml-1">
                          {new Date(c.lastOrder.orderDate).toLocaleDateString(
                            "ko-KR",
                            { month: "2-digit", day: "2-digit" },
                          )}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-slate-400">주문 없음</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  align,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${
        onClick ? "cursor-pointer select-none hover:text-slate-900" : ""
      } ${active ? "text-slate-900" : ""}`}
      onClick={onClick}
    >
      {children}
      {active && <span className="ml-1 text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}
