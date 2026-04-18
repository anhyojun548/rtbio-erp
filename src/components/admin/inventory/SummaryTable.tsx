"use client";

import { useMemo, useState } from "react";
import {
  InventoryDialog,
  type InventoryDialogTarget,
} from "./InventoryDialog";

export type SummaryRow = {
  id: string;
  sizeCode: string;
  physicalStock: number;
  availableStock: number;
  reorderPoint: number | null;
  low: boolean;
  product: {
    id: string;
    code: string;
    name: string;
    category: string | null;
  };
};

/**
 * 재고 현황 — 사이즈 단위 테이블.
 * - 검색: 제품명/코드/사이즈
 * - 필터: 카테고리, 저재고 only
 * - 입고/조정 버튼 → 다이얼로그
 */
export function InventorySummaryTable({ rows }: { rows: SummaryRow[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("ALL");
  const [lowOnly, setLowOnly] = useState(false);

  const [mode, setMode] = useState<"RECEIVE" | "ADJUST" | null>(null);
  const [target, setTarget] = useState<InventoryDialogTarget | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.product.category) set.add(r.product.category);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (cat !== "ALL" && (r.product.category ?? "") !== cat) return false;
      if (lowOnly && !r.low) return false;
      if (needle) {
        const hay = `${r.product.name} ${r.product.code} ${r.sizeCode}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, cat, lowOnly]);

  function openReceive(r: SummaryRow) {
    setTarget({
      productSizeId: r.id,
      productName: r.product.name,
      sizeCode: r.sizeCode,
      physicalStock: r.physicalStock,
      availableStock: r.availableStock,
    });
    setMode("RECEIVE");
  }

  function openAdjust(r: SummaryRow) {
    setTarget({
      productSizeId: r.id,
      productName: r.product.name,
      sizeCode: r.sizeCode,
      physicalStock: r.physicalStock,
      availableStock: r.availableStock,
    });
    setMode("ADJUST");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
        <input
          type="text"
          placeholder="제품명 / 코드 / 사이즈 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500"
        >
          <option value="ALL">전체 카테고리</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-700 select-none">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          저재고만
        </label>
        <span className="ml-auto text-xs text-slate-400">
          총 {filtered.length}건 / 전체 {rows.length}건
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium">제품</th>
              <th className="px-4 py-3 text-left font-medium">코드</th>
              <th className="px-4 py-3 text-left font-medium">사이즈</th>
              <th className="px-4 py-3 text-left font-medium">카테고리</th>
              <th className="px-4 py-3 text-right font-medium">실재고</th>
              <th className="px-4 py-3 text-right font-medium">가용재고</th>
              <th className="px-4 py-3 text-right font-medium">알람기준</th>
              <th className="px-4 py-3 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  조건에 맞는 재고가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-slate-100 hover:bg-slate-50/60 ${
                    r.low ? "bg-red-50/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.product.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {r.product.code}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-800">
                    {r.sizeCode}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.product.category ?? "-"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      r.low ? "text-red-600 font-semibold" : "text-slate-800"
                    }`}
                  >
                    {r.physicalStock.toLocaleString()}
                    {r.low && " ⚠"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.availableStock.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {r.reorderPoint ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openReceive(r)}
                        className="rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-1 font-medium"
                      >
                        + 입고
                      </button>
                      <button
                        type="button"
                        onClick={() => openAdjust(r)}
                        className="rounded bg-amber-50 text-amber-700 hover:bg-amber-100 px-2 py-1 font-medium"
                      >
                        ± 조정
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mode && target && (
        <InventoryDialog
          mode={mode}
          target={target}
          onClose={() => {
            setMode(null);
            setTarget(null);
          }}
        />
      )}
    </>
  );
}
