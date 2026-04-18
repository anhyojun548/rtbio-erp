"use client";

import { useState, useTransition } from "react";
import {
  upsertClientDiscount,
  deleteClientDiscount,
} from "@/lib/actions/client-pricing";

type Discount = {
  id: string;
  category: string;
  discountRate: string | number;
};

type FormState = {
  id?: string;
  category: string;
  ratePct: string; // UI 는 % 단위 (저장 시 /100)
};

const EMPTY: FormState = { category: "", ratePct: "" };

/**
 * 거래처 × 카테고리 할인율 관리 패널.
 * UI: 사용자에겐 % 단위로 보여주고 서버엔 소수(0~1) 로 변환해서 저장.
 */
export function DiscountPanel({
  clientId,
  initialDiscounts,
  knownCategories,
}: {
  clientId: string;
  initialDiscounts: Discount[];
  knownCategories: string[];
}) {
  const [editing, setEditing] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openNew() {
    setEditing({ ...EMPTY });
    setFieldErrors({});
    setError(null);
  }

  function openEdit(d: Discount) {
    const rate = Number(d.discountRate);
    setEditing({
      id: d.id,
      category: d.category,
      ratePct: (rate * 100).toString(),
    });
    setFieldErrors({});
    setError(null);
  }

  function close() {
    setEditing(null);
    setFieldErrors({});
    setError(null);
  }

  function submit() {
    if (!editing) return;
    const pct = Number(editing.ratePct);
    if (!Number.isFinite(pct)) {
      setError("할인율(%)을 숫자로 입력하세요.");
      return;
    }
    const rate = pct / 100;
    start(async () => {
      const res = await upsertClientDiscount(clientId, {
        category: editing.category,
        discountRate: rate.toFixed(4),
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      window.location.reload();
    });
  }

  function onDelete(d: Discount) {
    if (!confirm(`"${d.category}" 할인율을 삭제하시겠습니까?`)) return;
    start(async () => {
      const res = await deleteClientDiscount(d.id);
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
          <h2 className="font-semibold text-slate-900">카테고리 할인율</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            제품 카테고리별 할인율. 주문 확정 시 자동 적용 (0% 초과 100% 미만).
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700"
        >
          + 할인율 추가
        </button>
      </div>

      {initialDiscounts.length === 0 && !editing ? (
        <p className="text-center py-8 text-sm text-slate-400">
          등록된 할인율이 없습니다.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium">카테고리</th>
              <th className="px-3 py-2 text-right font-medium">할인율</th>
              <th className="px-3 py-2 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {initialDiscounts.map((d) => {
              const rate = Number(d.discountRate);
              const orphan = !knownCategories.includes(d.category);
              const warn = rate >= 0.5;
              return (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-800">
                    {d.category}
                    {orphan && (
                      <span className="ml-2 inline-flex items-center rounded bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium">
                        매칭 제품 없음
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      warn ? "text-red-600 font-semibold" : "text-slate-800"
                    }`}
                  >
                    {(rate * 100).toFixed(2)}%
                    {warn && " ⚠"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => openEdit(d)}
                        className="text-slate-600 hover:text-sky-700"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onDelete(d)}
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
            {editing.id ? "할인율 편집" : "새 할인율"}
          </h3>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                카테고리 *
              </label>
              <input
                type="text"
                list={editing.id ? undefined : "known-categories"}
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
                disabled={!!editing.id}
                placeholder="예: 관절보조기"
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
                  fieldErrors.category?.[0]
                    ? "border-red-400 focus:border-red-500"
                    : "border-slate-300 focus:border-sky-500"
                } disabled:bg-slate-100 disabled:text-slate-500`}
              />
              {!editing.id && (
                <datalist id="known-categories">
                  {knownCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              )}
              {fieldErrors.category?.[0] && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.category[0]}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                할인율 (%) *{" "}
                <span className="text-slate-400 font-normal">
                  (0 초과 ~ 100 미만)
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                value={editing.ratePct}
                onChange={(e) =>
                  setEditing({ ...editing, ratePct: e.target.value })
                }
                placeholder="예: 10 (=10%)"
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
                  fieldErrors.discountRate?.[0]
                    ? "border-red-400 focus:border-red-500"
                    : "border-slate-300 focus:border-sky-500"
                }`}
              />
              {fieldErrors.discountRate?.[0] && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.discountRate[0]}
                </p>
              )}
            </div>
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
