"use client";

/**
 * 주문 상태 전이 버튼 패널 (Phase 3D-2b).
 *
 * 3D-2b-1 ✅ SUBMIT
 * 3D-2b-2 (이번): REJECT · HOLD · RESUME · CANCEL (재고 미영향)
 * 3D-2b-3 (다음): CONFIRM (RESERVE) + CANCEL 확장 (CONFIRMED → RELEASE)
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OrderStatus } from "@prisma/client";
import {
  submitOrder,
  rejectOrder,
  holdOrder,
  resumeOrder,
  cancelOrder,
} from "@/lib/actions/order";

type ReasonTransition = "reject" | "hold" | "cancel";

export function StatusActions({
  orderId,
  status,
  itemCount,
}: {
  orderId: string;
  status: OrderStatus;
  itemCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 단순 확인(사유 없음) — SUBMIT, RESUME
  const [simpleConfirm, setSimpleConfirm] = useState<"submit" | "resume" | null>(
    null,
  );

  // 사유 필요 — REJECT, HOLD, CANCEL
  const [reasonModal, setReasonModal] = useState<ReasonTransition | null>(null);
  const [reason, setReason] = useState("");

  function close() {
    setSimpleConfirm(null);
    setReasonModal(null);
    setReason("");
    setError(null);
  }

  function runSubmit() {
    start(async () => {
      const res = await submitOrder(orderId, {});
      if (!res.ok) return setError(res.error);
      close();
      router.refresh();
    });
  }
  function runResume() {
    start(async () => {
      const res = await resumeOrder(orderId, {});
      if (!res.ok) return setError(res.error);
      close();
      router.refresh();
    });
  }
  function runReasonAction() {
    if (!reasonModal) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("사유는 3자 이상 입력해주세요.");
      return;
    }
    start(async () => {
      const call =
        reasonModal === "reject"
          ? rejectOrder(orderId, { reason: trimmed })
          : reasonModal === "hold"
            ? holdOrder(orderId, { reason: trimmed })
            : cancelOrder(orderId, { reason: trimmed });
      const res = await call;
      if (!res.ok) return setError(res.error);
      close();
      router.refresh();
    });
  }

  const canSubmit = status === "DRAFT" && itemCount > 0;
  const canReject = status === "SUBMITTED" || status === "HOLD";
  const canHold = status === "SUBMITTED";
  const canResume = status === "HOLD";
  const canCancel = status === "SUBMITTED" || status === "HOLD";

  const anyAction =
    canSubmit || canReject || canHold || canResume || canCancel;

  if (!anyAction) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">
          현재 상태:{" "}
          <span className="font-semibold text-slate-800">{status}</span>.
          추가 전이는 다음 Phase 에서 제공됩니다 (CONFIRM / SHIP 등).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* ── 주 액션 행 ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {canSubmit &&
            "DRAFT 입니다. 제출하면 공식 번호가 부여되고 라인 가격이 잠깁니다."}
          {canHold &&
            "SUBMITTED 입니다. 재고/거래처 확인이 필요하면 보류로 전환할 수 있습니다."}
          {canResume && "HOLD 입니다. 재개하면 다시 SUBMITTED 로 돌아갑니다."}
          {!canSubmit && !canHold && !canResume && (
            <span>
              현재 상태:{" "}
              <span className="font-semibold text-slate-800">{status}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setSimpleConfirm("submit")}
              className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              발주 제출 →
            </button>
          )}
          {canHold && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setReasonModal("hold")}
              className="rounded-md bg-amber-500 text-white px-3 py-2 text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
            >
              보류
            </button>
          )}
          {canResume && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setSimpleConfirm("resume")}
              className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              재개
            </button>
          )}
          {canReject && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setReasonModal("reject")}
              className="rounded-md bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              반려
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setReasonModal("cancel")}
              className="rounded-md border border-slate-300 bg-white text-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
          )}
        </div>
      </div>

      {/* ── SUBMIT/RESUME 확인 모달 ────────────────────── */}
      {simpleConfirm && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-sm text-amber-900">
            {simpleConfirm === "submit" ? (
              <>
                <strong>제출하시겠습니까?</strong> 제출 후엔 라인/헤더를 자유
                편집할 수 없고, 가격도 변경되지 않습니다.
              </>
            ) : (
              <>
                <strong>보류를 해제하고 재개하시겠습니까?</strong> SUBMITTED 로
                돌아갑니다.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={
                simpleConfirm === "submit" ? runSubmit : runResume
              }
              className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {pending
                ? "처리중…"
                : simpleConfirm === "submit"
                  ? "제출"
                  : "재개"}
            </button>
          </div>
        </div>
      )}

      {/* ── 사유 입력 모달 (REJECT / HOLD / CANCEL) ────── */}
      {reasonModal && (
        <div className="rounded-md border border-slate-300 bg-slate-50 p-3 space-y-2">
          <label className="block text-sm font-medium text-slate-800">
            {reasonModal === "reject"
              ? "반려 사유 *"
              : reasonModal === "hold"
                ? "보류 사유 *"
                : "취소 사유 *"}
          </label>
          <textarea
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="3~500자"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              닫기
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={runReasonAction}
              className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                reasonModal === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : reasonModal === "hold"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-slate-700 hover:bg-slate-800"
              }`}
            >
              {pending
                ? "처리중…"
                : reasonModal === "reject"
                  ? "반려 확정"
                  : reasonModal === "hold"
                    ? "보류"
                    : "취소 확정"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
