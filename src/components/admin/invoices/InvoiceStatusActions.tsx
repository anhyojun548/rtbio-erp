"use client";

/**
 * 거래명세서 상태 전이 버튼 패널 — Phase 3D-3a.
 *
 * 전이:
 *   DRAFT    → issueInvoice (ISSUED)  / cancelInvoice
 *   ISSUED   → markInvoiceSent (SENT) / cancelInvoice
 *   SENT     → cancelInvoice
 *   CANCELLED → (no actions)
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { InvoiceStatus } from "@prisma/client";
import {
  issueInvoice,
  markInvoiceSent,
  cancelInvoice,
} from "@/lib/actions/invoice";

export function InvoiceStatusActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [simpleConfirm, setSimpleConfirm] = useState<"issue" | "sent" | null>(
    null,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  function close() {
    setSimpleConfirm(null);
    setCancelOpen(false);
    setReason("");
    setError(null);
  }

  function runIssue() {
    start(async () => {
      const res = await issueInvoice(invoiceId, {});
      if (!res.ok) return setError(res.error);
      close();
      router.refresh();
    });
  }
  function runMarkSent() {
    start(async () => {
      const res = await markInvoiceSent(invoiceId, {});
      if (!res.ok) return setError(res.error);
      close();
      router.refresh();
    });
  }
  function runCancel() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("사유는 3자 이상 입력해주세요.");
      return;
    }
    start(async () => {
      const res = await cancelInvoice(invoiceId, { reason: trimmed });
      if (!res.ok) return setError(res.error);
      close();
      router.refresh();
    });
  }

  const canIssue = status === "DRAFT";
  const canSent = status === "ISSUED";
  const canCancel = status !== "CANCELLED";

  if (!canIssue && !canSent && !canCancel) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">
          현재 상태:{" "}
          <span className="font-semibold text-slate-800">{status}</span> — 이
          거래명세서는 종결 상태입니다.
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {status === "DRAFT" &&
            "DRAFT 입니다. 발행하면 공식 번호(INV-YYYYMMDD-NNN)가 부여됩니다."}
          {status === "ISSUED" &&
            "ISSUED 입니다. 외부 발송(이메일/우편)을 완료하면 '발송완료 표시'."}
          {status === "SENT" && "SENT — 발송 완료된 거래명세서입니다."}
        </div>

        <div className="flex flex-wrap gap-2">
          {canIssue && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setSimpleConfirm("issue")}
              className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              발행 →
            </button>
          )}
          {canSent && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setSimpleConfirm("sent")}
              className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              발송완료 표시
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setCancelOpen(true)}
              className="rounded-md border border-slate-300 bg-white text-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
          )}
        </div>
      </div>

      {simpleConfirm && (
        <div
          className={`rounded-md border p-3 space-y-2 ${
            simpleConfirm === "issue"
              ? "border-indigo-300 bg-indigo-50"
              : "border-emerald-300 bg-emerald-50"
          }`}
        >
          <p
            className={`text-sm ${
              simpleConfirm === "issue" ? "text-indigo-900" : "text-emerald-900"
            }`}
          >
            {simpleConfirm === "issue" && (
              <>
                <strong>발행하시겠습니까?</strong> 오늘 날짜로 공식 번호가 채번되고
                상태가 ISSUED 로 전환됩니다.
              </>
            )}
            {simpleConfirm === "sent" && (
              <>
                <strong>발송완료로 표시하시겠습니까?</strong> sentAt 에 현재 시각이
                기록됩니다.
              </>
            )}
          </p>
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
              onClick={simpleConfirm === "issue" ? runIssue : runMarkSent}
              className={`rounded-md text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                simpleConfirm === "issue"
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {pending ? "처리중…" : simpleConfirm === "issue" ? "발행" : "표시"}
            </button>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div className="rounded-md border border-slate-300 bg-slate-50 p-3 space-y-2">
          <label className="block text-sm font-medium text-slate-800">
            취소 사유 *
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
              onClick={runCancel}
              className="rounded-md bg-slate-700 text-white px-3 py-1.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "처리중…" : "취소 확정"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
