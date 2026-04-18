"use client";

import { useState, useTransition } from "react";
import { createSize, updateSize, deleteSize } from "@/lib/actions/product-size";
import type { ProductSizeCreateInput } from "@/lib/validators/product";

type Size = {
  id: string;
  sizeCode: string;
  physicalStock: number;
  availableStock: number;
  reorderPoint: number | null;
};

type FormState = {
  id?: string;
  sizeCode: string;
  physicalStock: number;
  availableStock: number;
  reorderPoint: number | "";
};

const EMPTY: FormState = {
  sizeCode: "",
  physicalStock: 0,
  availableStock: 0,
  reorderPoint: "",
};

export function SizesPanel({
  productId,
  initialSizes,
}: {
  productId: string;
  initialSizes: Size[];
}) {
  const [sizes] = useState(initialSizes);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openNew() {
    setEditing({ ...EMPTY });
    setFieldErrors({});
    setError(null);
  }

  function openEdit(s: Size) {
    setEditing({
      id: s.id,
      sizeCode: s.sizeCode,
      physicalStock: s.physicalStock,
      availableStock: s.availableStock,
      reorderPoint: s.reorderPoint ?? "",
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
    const input: ProductSizeCreateInput = {
      sizeCode: editing.sizeCode,
      physicalStock: editing.physicalStock,
      availableStock: editing.availableStock,
      reorderPoint:
        editing.reorderPoint === "" ? undefined : Number(editing.reorderPoint),
    };
    start(async () => {
      const res = editing.id
        ? await updateSize(editing.id, input)
        : await createSize(productId, input);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      window.location.reload();
    });
  }

  function onDelete(s: Size) {
    if (!confirm(`사이즈 "${s.sizeCode}" 을(를) 삭제하시겠습니까?`)) return;
    start(async () => {
      const res = await deleteSize(s.id);
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
          <h2 className="font-semibold text-slate-900">사이즈별 재고</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            실재고 · 가용재고 · 재고 알람 기준을 관리합니다. 재고 변동은 입/출고 메뉴에서 기록하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700"
        >
          + 사이즈 추가
        </button>
      </div>

      {sizes.length === 0 && !editing ? (
        <p className="text-center py-8 text-sm text-slate-400">
          등록된 사이즈가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium">사이즈</th>
                <th className="px-3 py-2 text-right font-medium">실재고</th>
                <th className="px-3 py-2 text-right font-medium">가용재고</th>
                <th className="px-3 py-2 text-right font-medium">알람기준</th>
                <th className="px-3 py-2 text-right font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => {
                const low =
                  s.reorderPoint !== null && s.physicalStock <= s.reorderPoint;
                return (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-slate-800">
                      {s.sizeCode}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        low ? "text-red-600 font-semibold" : "text-slate-800"
                      }`}
                    >
                      {s.physicalStock.toLocaleString()}
                      {low && " ⚠"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {s.availableStock.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {s.reorderPoint ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="text-slate-600 hover:text-sky-700"
                        >
                          편집
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onDelete(s)}
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
        </div>
      )}

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-4 rounded-md border border-slate-200 bg-slate-50/50 p-4 space-y-3"
        >
          <h3 className="font-medium text-slate-800 text-sm">
            {editing.id ? "사이즈 편집" : "새 사이즈"}
          </h3>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="사이즈 코드 *"
              value={editing.sizeCode}
              onChange={(v) => setEditing({ ...editing, sizeCode: v })}
              error={fieldErrors.sizeCode?.[0]}
              placeholder="예: S, M, 12x8"
            />
            <Field
              label="알람 기준"
              type="number"
              value={String(editing.reorderPoint)}
              onChange={(v) =>
                setEditing({ ...editing, reorderPoint: v === "" ? "" : Number(v) })
              }
              error={fieldErrors.reorderPoint?.[0]}
              placeholder="예: 10"
            />
            <Field
              label="실재고 *"
              type="number"
              value={String(editing.physicalStock)}
              onChange={(v) =>
                setEditing({ ...editing, physicalStock: Number(v || 0) })
              }
              error={fieldErrors.physicalStock?.[0]}
            />
            <Field
              label="가용재고 *"
              type="number"
              value={String(editing.availableStock)}
              onChange={(v) =>
                setEditing({ ...editing, availableStock: Number(v || 0) })
              }
              error={fieldErrors.availableStock?.[0]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
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

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-slate-300 focus:border-sky-500"
        }`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
