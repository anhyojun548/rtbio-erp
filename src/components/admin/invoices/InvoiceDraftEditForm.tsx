"use client";

/**
 * DRAFT 거래명세서 편집 폼 — issueDate / dueDate / note.
 * 라인/금액은 주문 스냅샷이므로 수정 불가.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateInvoiceDraft } from "@/lib/actions/invoice";

export function InvoiceDraftEditForm({
  invoiceId,
  initial,
}: {
  invoiceId: string;
  initial: { issueDate: string; dueDate: string; note: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [note, setNote] = useState(initial.note);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  function save() {
    start(async () => {
      const res = await updateInvoiceDraft(invoiceId, {
        issueDate: issueDate ? new Date(issueDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : null,
        note: note.trim() ? note : undefined,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "저장되었습니다." });
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">DRAFT 편집</h2>
        <span className="text-xs text-slate-500">
          라인/금액은 주문 스냅샷 — 수정 불가
        </span>
      </header>

      {msg && (
        <p
          className={`text-sm rounded px-3 py-2 border ${
            msg.type === "ok"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-red-600 bg-red-50 border-red-200"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">발행일</label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">지급기한</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">비고</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="내부 메모 (1000자 이내)"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
