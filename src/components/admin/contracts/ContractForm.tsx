"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createContract,
  updateContract,
  deleteContract,
} from "@/lib/actions/sales-contract";

type ClientOption = {
  id: string;
  code: string;
  name: string;
};

type Initial = {
  id: string;
  clientId: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD or null
  pdfUrl: string | null;
  signed: boolean;
  note: string | null;
};

export function ContractForm({
  mode,
  clients,
  initial,
  defaultClientId,
}: {
  mode: "create" | "edit";
  clients: ClientOption[];
  initial?: Initial;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [clientId, setClientId] = useState(
    initial?.clientId ?? defaultClientId ?? "",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [pdfUrl, setPdfUrl] = useState(initial?.pdfUrl ?? "");
  const [signed, setSigned] = useState(initial?.signed ?? false);
  const [note, setNote] = useState(initial?.note ?? "");

  function submit() {
    setErr(null);
    if (!clientId) {
      setErr("거래처를 선택해주세요.");
      return;
    }
    if (!title.trim()) {
      setErr("계약서 제목을 입력해주세요.");
      return;
    }
    if (!startDate) {
      setErr("시작일을 입력해주세요.");
      return;
    }

    start(async () => {
      if (mode === "create") {
        const res = await createContract({
          clientId,
          title: title.trim(),
          startDate: new Date(startDate),
          ...(endDate && { endDate: new Date(endDate) }),
          pdfUrl: pdfUrl.trim() || undefined,
          signed,
          note: note.trim() || undefined,
        });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        router.push(`/admin/contracts/${res.data.id}`);
      } else if (initial) {
        const res = await updateContract({
          id: initial.id,
          title: title.trim(),
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          pdfUrl: pdfUrl.trim() || null,
          signed,
          note: note.trim() || null,
        });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        router.refresh();
      }
    });
  }

  function remove() {
    if (!initial) return;
    if (!confirm("이 계약서를 삭제할까요? 복구할 수 없습니다.")) return;
    start(async () => {
      const res = await deleteContract(initial.id);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.push("/admin/contracts");
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
      {err && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {err}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            거래처 <span className="text-red-600">*</span>
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={mode === "edit"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-600"
          >
            <option value="">선택하세요</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          {mode === "edit" && (
            <p className="text-xs text-slate-400 mt-1">
              거래처는 변경할 수 없습니다. 잘못 선택했다면 삭제 후 재등록하세요.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            제목 <span className="text-red-600">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2026년 연간 공급 계약"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            시작일 <span className="text-red-600">*</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            종료일
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">
            비워두면 "무기한" 계약으로 간주됩니다.
          </p>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            PDF URL
          </label>
          <input
            value={pdfUrl}
            onChange={(e) => setPdfUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={signed}
              onChange={(e) => setSigned(e.target.checked)}
              className="h-4 w-4"
            />
            서명 완료
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            메모
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div>
          {mode === "edit" && (
            <button
              onClick={remove}
              disabled={pending}
              className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            disabled={pending}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {mode === "create" ? "등록" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
