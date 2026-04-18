"use client";

import { useState, useTransition } from "react";
import { receiveStock, createAdjustment } from "@/lib/actions/inventory";
import { ADJUST_REASONS, type AdjustReason } from "@/lib/validators/inventory";

type Mode = "RECEIVE" | "ADJUST";

export type InventoryDialogTarget = {
  productSizeId: string;
  productName: string;
  sizeCode: string;
  physicalStock: number;
  availableStock: number;
};

/**
 * 입고 / 조정 공통 다이얼로그.
 * - RECEIVE: qty > 0 만 허용, note 선택
 * - ADJUST: reason 에 따라 부호 제약 (validator 가 검증), approvedBy 선택
 */
export function InventoryDialog({
  mode,
  target,
  onClose,
}: {
  mode: Mode;
  target: InventoryDialogTarget;
  onClose: () => void;
}) {
  const [qty, setQty] = useState<string>("");
  const [reason, setReason] = useState<AdjustReason>("실사조정");
  const [note, setNote] = useState<string>("");
  const [approvedBy, setApprovedBy] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    setFieldErrors({});
    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum) || Number.isNaN(qtyNum)) {
      setError("수량을 입력하세요.");
      return;
    }
    start(async () => {
      const res =
        mode === "RECEIVE"
          ? await receiveStock({
              productSizeId: target.productSizeId,
              qty: qtyNum,
              note: note || undefined,
            })
          : await createAdjustment({
              productSizeId: target.productSizeId,
              qty: qtyNum,
              reason,
              note: note || undefined,
              approvedBy: approvedBy || undefined,
            });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      window.location.reload();
    });
  }

  const title = mode === "RECEIVE" ? "입고 등록" : "재고 조정";
  const qtyHint =
    mode === "RECEIVE"
      ? "양의 정수만 허용됩니다."
      : reason === "폐기"
        ? "폐기는 음수로 입력하세요. (예: -3)"
        : reason === "반품" || reason === "입고보정"
          ? "양수만 허용됩니다."
          : "양수(+) / 음수(-) 모두 가능.";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
        <header className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="p-5 space-y-4"
        >
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
            <div className="font-medium text-slate-800">
              {target.productName}{" "}
              <span className="font-mono text-xs text-slate-500">
                ({target.sizeCode})
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              실재고 {target.physicalStock.toLocaleString()} · 가용재고{" "}
              {target.availableStock.toLocaleString()}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          {mode === "ADJUST" && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">사유 *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as AdjustReason)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
              >
                {ADJUST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {fieldErrors.reason?.[0] && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.reason[0]}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 mb-1">
              수량 *{" "}
              <span className="text-slate-400 font-normal">({qtyHint})</span>
            </label>
            <input
              type="number"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={mode === "RECEIVE" ? "예: 50" : "예: 5 또는 -3"}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
                fieldErrors.qty?.[0]
                  ? "border-red-400 focus:border-red-500"
                  : "border-slate-300 focus:border-sky-500"
              }`}
              autoFocus
            />
            {fieldErrors.qty?.[0] && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.qty[0]}</p>
            )}
          </div>

          {mode === "ADJUST" && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                승인자
              </label>
              <input
                type="text"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="예: 김팀장"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 mb-1">비고</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="예: 샘플 추가 입고"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
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
      </div>
    </div>
  );
}
