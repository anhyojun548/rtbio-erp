"use client";

import { useState, useTransition } from "react";
import {
  upsertClientFixedPrice,
  deleteClientFixedPrice,
  searchProductsForFixedPrice,
} from "@/lib/actions/client-pricing";

type FixedPrice = {
  id: string;
  productId: string;
  fixedPrice: string | number;
  product: { id: string; code: string; name: string };
};

type ProductSearchHit = {
  id: string;
  code: string;
  name: string;
  basePrice: unknown; // Decimal
  category: string | null;
};

type FormState = {
  id?: string;
  productId: string;
  productLabel: string;
  fixedPrice: string;
};

const EMPTY: FormState = { productId: "", productLabel: "", fixedPrice: "" };

/**
 * 거래처 × 제품 고정가 관리 패널.
 * fixedPrice = 0 허용 (무상공급) — 감사로그에 isFree 플래그.
 */
export function FixedPricePanel({
  clientId,
  initialFixedPrices,
}: {
  clientId: string;
  initialFixedPrices: FixedPrice[];
}) {
  const [editing, setEditing] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // 제품 자동완성
  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<ProductSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const existingProductIds = new Set(
    initialFixedPrices.map((f) => f.productId),
  );

  function openNew() {
    setEditing({ ...EMPTY });
    setSearchQ("");
    setHits([]);
    setFieldErrors({});
    setError(null);
  }

  function openEdit(f: FixedPrice) {
    setEditing({
      id: f.id,
      productId: f.productId,
      productLabel: `${f.product.name} (${f.product.code})`,
      fixedPrice: String(f.fixedPrice),
    });
    setSearchQ("");
    setHits([]);
    setFieldErrors({});
    setError(null);
  }

  function close() {
    setEditing(null);
    setFieldErrors({});
    setError(null);
  }

  async function runSearch(q: string) {
    setSearchQ(q);
    if (q.trim().length < 1) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      const rows = await searchProductsForFixedPrice(q);
      setHits(rows);
    } finally {
      setSearching(false);
    }
  }

  function pickProduct(p: ProductSearchHit) {
    if (!editing) return;
    setEditing({
      ...editing,
      productId: p.id,
      productLabel: `${p.name} (${p.code})`,
    });
    setSearchQ("");
    setHits([]);
  }

  function submit() {
    if (!editing) return;
    if (!editing.productId) {
      setError("제품을 선택하세요.");
      return;
    }
    start(async () => {
      const res = await upsertClientFixedPrice(clientId, {
        productId: editing.productId,
        fixedPrice: editing.fixedPrice,
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      window.location.reload();
    });
  }

  function onDelete(f: FixedPrice) {
    if (!confirm(`"${f.product.name}" 고정가를 삭제하시겠습니까?`)) return;
    start(async () => {
      const res = await deleteClientFixedPrice(f.id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">제품 고정가</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            특정 제품에 대한 거래처 고정가. 할인율보다 우선 적용됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700"
        >
          + 고정가 추가
        </button>
      </div>

      {initialFixedPrices.length === 0 && !editing ? (
        <p className="text-center py-8 text-sm text-slate-400">
          등록된 고정가가 없습니다.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium">제품</th>
              <th className="px-3 py-2 text-left font-medium">코드</th>
              <th className="px-3 py-2 text-right font-medium">고정가</th>
              <th className="px-3 py-2 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {initialFixedPrices.map((f) => {
              const priceNum = Number(f.fixedPrice);
              const isFree = priceNum === 0;
              return (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-800">
                    {f.product.name}
                    {isFree && (
                      <span className="ml-2 inline-flex items-center rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-medium">
                        무상공급
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {f.product.code}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {priceNum.toLocaleString()}원
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openEdit(f)}
                        className="text-slate-600 hover:text-sky-700"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onDelete(f)}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-2 rounded-md border border-slate-200 bg-slate-50/50 p-4 space-y-3"
        >
          <h3 className="font-medium text-slate-800 text-sm">
            {editing.id ? "고정가 편집" : "새 고정가"}
          </h3>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* 제품 선택 — 편집 시엔 고정, 신규만 검색 */}
          {editing.id ? (
            <div>
              <label className="block text-xs text-slate-500 mb-1">제품</label>
              <input
                type="text"
                value={editing.productLabel}
                disabled
                className="w-full rounded-md border border-slate-300 bg-slate-100 text-slate-500 px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div className="relative">
              <label className="block text-xs text-slate-500 mb-1">
                제품 검색 *
              </label>
              {editing.productId ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editing.productLabel}
                    readOnly
                    className="flex-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ ...editing, productId: "", productLabel: "" })
                    }
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    변경
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => runSearch(e.target.value)}
                    placeholder="제품명 또는 코드로 검색"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
                  />
                  {(hits.length > 0 || searching) && (
                    <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
                      {searching && (
                        <li className="px-3 py-2 text-slate-400 text-xs">
                          검색 중…
                        </li>
                      )}
                      {hits.map((p) => {
                        const dup = existingProductIds.has(p.id);
                        return (
                          <li
                            key={p.id}
                            className={`px-3 py-2 hover:bg-sky-50 cursor-pointer flex justify-between ${
                              dup ? "opacity-50 pointer-events-none" : ""
                            }`}
                            onClick={() => !dup && pickProduct(p)}
                          >
                            <span>
                              <span className="font-medium">{p.name}</span>{" "}
                              <span className="font-mono text-xs text-slate-500">
                                ({p.code})
                              </span>
                              {dup && (
                                <span className="ml-2 text-xs text-amber-600">
                                  이미 등록됨
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-slate-500 tabular-nums">
                              기준 {Number(p.basePrice).toLocaleString()}원
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
              {fieldErrors.productId?.[0] && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.productId[0]}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 mb-1">
              고정가 (원) *{" "}
              <span className="text-slate-400 font-normal">
                (0 = 무상공급)
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editing.fixedPrice}
              onChange={(e) =>
                setEditing({ ...editing, fixedPrice: e.target.value })
              }
              placeholder="예: 120000"
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
                fieldErrors.fixedPrice?.[0]
                  ? "border-red-400 focus:border-red-500"
                  : "border-slate-300 focus:border-sky-500"
              }`}
            />
            {fieldErrors.fixedPrice?.[0] && (
              <p className="text-xs text-red-600 mt-1">
                {fieldErrors.fixedPrice[0]}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-sky-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {pending ? "저장중…" : "저장"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
