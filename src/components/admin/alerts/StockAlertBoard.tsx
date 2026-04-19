"use client";

/**
 * 재고 알럼 Board — Phase 3E-3 (R14).
 *
 * - OUT/LOW 필터 토글.
 * - 카테고리/제품코드 검색.
 * - 품목 클릭 → 제품 상세로 이동.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import type { StockLevel } from "@/lib/validators/stock-alert";
import { STOCK_LEVEL_LABEL } from "@/lib/validators/stock-alert";

type Row = {
  sizeId: string;
  productId: string;
  productCode: string;
  productName: string;
  sizeCode: string;
  category: string | null;
  brand: string | null;
  physicalStock: number;
  availableStock: number;
  reorderPoint: number;
  level: StockLevel;
  deficit: number;
  updatedAt: string;
};

export function StockAlertBoard({ rows }: { rows: Row[] }) {
  const [levelFilter, setLevelFilter] = useState<"ALL" | StockLevel>("ALL");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (levelFilter !== "ALL" && r.level !== levelFilter) return false;
      if (qLower) {
        const hay = `${r.productCode} ${r.productName} ${r.category ?? ""} ${r.brand ?? ""} ${r.sizeCode}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [rows, levelFilter, q]);

  const hasFilter = levelFilter !== "ALL" || q.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <span className="text-xs text-slate-500">레벨</span>
        {(["ALL", "OUT", "LOW"] as const).map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setLevelFilter(lv)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              levelFilter === lv
                ? lv === "OUT"
                  ? "bg-rose-600 text-white"
                  : lv === "LOW"
                    ? "bg-amber-500 text-white"
                    : "bg-slate-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {lv === "ALL" ? "전체" : STOCK_LEVEL_LABEL[lv]}
          </button>
        ))}
        <div className="flex-1" />
        <input
          type="text"
          placeholder="제품코드·이름·카테고리·브랜드 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setLevelFilter("ALL");
              setQ("");
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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center text-sm text-emerald-800">
          {rows.length === 0
            ? "✨ 모든 사이즈가 정상 재고입니다."
            : "필터 조건에 해당하는 알럼이 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">레벨</th>
                <th className="px-3 py-2 text-left">제품</th>
                <th className="px-3 py-2 text-left">카테고리</th>
                <th className="px-3 py-2 text-left">사이즈</th>
                <th className="px-3 py-2 text-right">실재고</th>
                <th className="px-3 py-2 text-right">가용</th>
                <th className="px-3 py-2 text-right">기준치</th>
                <th className="px-3 py-2 text-right">부족</th>
                <th className="px-3 py-2 text-left">최종 변동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.sizeId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <LevelBadge level={r.level} />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/products/${r.productId}`}
                      className="text-sky-700 hover:underline"
                    >
                      {r.productName}
                    </Link>
                    <div className="font-mono text-[10px] text-slate-400">
                      {r.productCode}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.category ?? "-"}
                    {r.brand && (
                      <span className="text-[10px] text-slate-400 ml-1">
                        · {r.brand}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-700">{r.sizeCode}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-semibold ${
                      r.level === "OUT"
                        ? "text-rose-700"
                        : r.level === "LOW"
                          ? "text-amber-700"
                          : "text-slate-700"
                    }`}
                  >
                    {r.physicalStock}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                    {r.availableStock}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {r.reorderPoint}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">
                    {r.deficit > 0 ? r.deficit : "-"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-500">
                    {new Date(r.updatedAt).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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

function LevelBadge({ level }: { level: StockLevel }) {
  if (level === "OUT")
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
        {STOCK_LEVEL_LABEL.OUT}
      </span>
    );
  if (level === "LOW")
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
        {STOCK_LEVEL_LABEL.LOW}
      </span>
    );
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
      {STOCK_LEVEL_LABEL.OK}
    </span>
  );
}
