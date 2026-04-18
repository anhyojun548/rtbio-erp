"use client";

import { useState, useTransition } from "react";
import {
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
  searchProductSizesForOrder,
} from "@/lib/actions/order";

type Line = {
  id: string;
  quantity: number;
  unitPrice: string;
  basePriceAtOrder: string;
  discountRateAtOrder: string | null;
  fixedPriceAppliedAtOrder: boolean;
  lineTotal: string;
  product: { id: string; code: string; name: string; category: string | null };
  productSize: { id: string; sizeCode: string };
};

type ProductHit = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  basePrice: string;
  unitPricePreview: string;
  fixedPriceApplied: boolean;
  discountRate: string | null;
  sizes: Array<{
    id: string;
    sizeCode: string;
    availableStock: number;
    physicalStock: number;
  }>;
};

export function ItemsPanel({
  orderId,
  clientId,
  editable,
  initialLines,
}: {
  orderId: string;
  clientId: string;
  editable: boolean;
  initialLines: Line[];
}) {
  const [productQ, setProductQ] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editingQty, setEditingQty] = useState<{
    id: string;
    quantity: number;
  } | null>(null);

  async function runSearch(q: string) {
    setProductQ(q);
    if (!q.trim()) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await searchProductSizesForOrder(clientId, q);
      setHits(rows);
    } finally {
      setSearching(false);
    }
  }

  function onAdd(productSizeId: string) {
    start(async () => {
      const res = await addOrderItem(orderId, { productSizeId, quantity: 1 });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setHits([]);
      setProductQ("");
      window.location.reload();
    });
  }

  function onSaveQty() {
    if (!editingQty) return;
    start(async () => {
      const res = await updateOrderItem(editingQty.id, {
        quantity: editingQty.quantity,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditingQty(null);
      setError(null);
      window.location.reload();
    });
  }

  function onDelete(id: string) {
    if (!confirm("이 라인을 삭제하시겠습니까?")) return;
    start(async () => {
      const res = await deleteOrderItem(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.reload();
    });
  }

  const total = initialLines.reduce((s, l) => s + Number(l.lineTotal), 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">주문 라인</h2>
        {!editable && (
          <span className="text-xs rounded bg-slate-100 text-slate-500 px-2 py-0.5">
            DRAFT 가 아닙니다 — 편집 불가
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {editable && (
        <div className="relative">
          <input
            value={productQ}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="+ 라인 추가 — 제품명/코드 검색"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
          />
          {(hits.length > 0 || searching) && (
            <ul className="absolute z-10 mt-1 w-full max-h-80 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
              {searching && (
                <li className="px-3 py-2 text-xs text-slate-400">검색 중…</li>
              )}
              {hits.map((p) => (
                <li
                  key={p.id}
                  className="border-b last:border-b-0 border-slate-100 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{p.name}</span>{" "}
                      <span className="font-mono text-xs text-slate-500">
                        ({p.code})
                      </span>
                    </div>
                    <div className="text-xs tabular-nums text-slate-600">
                      {Number(p.unitPricePreview).toLocaleString()}원
                      {p.fixedPriceApplied && (
                        <span className="ml-1 rounded bg-emerald-50 text-emerald-700 px-1 text-[10px]">
                          고정가
                        </span>
                      )}
                      {p.discountRate && !p.fixedPriceApplied && (
                        <span className="ml-1 rounded bg-sky-50 text-sky-700 px-1 text-[10px]">
                          {Math.round(Number(p.discountRate) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {p.sizes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {p.sizes.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onAdd(s.id)}
                          disabled={pending}
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs hover:bg-sky-50 hover:border-sky-300 disabled:opacity-50"
                          title={`가용 ${s.availableStock} / 실재고 ${s.physicalStock}`}
                        >
                          {s.sizeCode}{" "}
                          <span className="text-slate-400">
                            ({s.availableStock})
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      등록된 사이즈 없음
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
          <tr>
            <th className="px-3 py-2 text-left font-medium">제품</th>
            <th className="px-3 py-2 text-left font-medium">사이즈</th>
            <th className="px-3 py-2 text-right font-medium">기준가</th>
            <th className="px-3 py-2 text-right font-medium">단가</th>
            <th className="px-3 py-2 text-right font-medium">수량</th>
            <th className="px-3 py-2 text-right font-medium">소계</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {initialLines.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="text-center py-8 text-sm text-slate-400"
              >
                라인이 없습니다.
              </td>
            </tr>
          ) : (
            initialLines.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-800">
                  {l.product.name}
                  <div className="font-mono text-xs text-slate-500">
                    {l.product.code}
                  </div>
                </td>
                <td className="px-3 py-2">{l.productSize.sizeCode}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                  {Number(l.basePriceAtOrder).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(l.unitPrice).toLocaleString()}
                  {l.fixedPriceAppliedAtOrder && (
                    <span className="ml-1 rounded bg-emerald-50 text-emerald-700 px-1 text-[10px]">
                      고정가
                    </span>
                  )}
                  {l.discountRateAtOrder && !l.fixedPriceAppliedAtOrder && (
                    <span className="ml-1 rounded bg-sky-50 text-sky-700 px-1 text-[10px]">
                      {Math.round(Number(l.discountRateAtOrder) * 100)}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {editable && editingQty?.id === l.id ? (
                    <input
                      type="number"
                      min={1}
                      value={editingQty.quantity}
                      onChange={(e) =>
                        setEditingQty({
                          id: l.id,
                          quantity: Math.max(1, Number(e.target.value) | 0),
                        })
                      }
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  ) : (
                    <span className="tabular-nums">{l.quantity}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {Number(l.lineTotal).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {editable ? (
                    editingQty?.id === l.id ? (
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={onSaveQty}
                          className="text-sky-700 hover:text-sky-800"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingQty(null)}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQty({ id: l.id, quantity: l.quantity })
                          }
                          className="text-slate-600 hover:text-sky-700"
                        >
                          수량
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onDelete(l.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    )
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot className="bg-slate-50">
          <tr>
            <td
              colSpan={5}
              className="px-3 py-2 text-right text-xs text-slate-600"
            >
              합계
            </td>
            <td className="px-3 py-2 text-right tabular-nums font-semibold">
              {total.toLocaleString()}원
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
