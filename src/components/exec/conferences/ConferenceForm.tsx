"use client";

/**
 * 학회 등록/수정 폼 — /exec/conferences/new, /exec/conferences/[id] (편집 모드).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createConference,
  updateConference,
  deleteConference,
} from "@/lib/actions/conference";

type Initial = {
  id?: string;
  name?: string;
  location?: string | null;
  startDate?: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  note?: string | null;
};

export function ConferenceForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Initial;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  function submit() {
    setErr(null);
    start(async () => {
      if (mode === "create") {
        const r = await createConference({
          name,
          location,
          startDate: new Date(startDate),
          ...(endDate && { endDate: new Date(endDate) }),
          note,
        });
        if (!r.ok) {
          setErr(r.error);
          return;
        }
        router.push(`/exec/conferences/${r.data.id}`);
        router.refresh();
      } else {
        if (!initial?.id) return;
        const r = await updateConference({
          id: initial.id,
          name,
          location,
          ...(startDate && { startDate: new Date(startDate) }),
          endDate: endDate ? new Date(endDate) : null,
          note: note || null,
        });
        if (!r.ok) {
          setErr(r.error);
          return;
        }
        router.refresh();
      }
    });
  }

  function remove() {
    if (!initial?.id) return;
    if (!confirm("정말 이 학회를 삭제하시겠습니까? 방문자 명단도 함께 삭제됩니다."))
      return;
    start(async () => {
      const r = await deleteConference(initial.id!);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      router.push("/exec/conferences");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <Field label="학회명" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="예: 제12회 대한정형외과학회"
        />
      </Field>
      <Field label="장소">
        <input
          type="text"
          value={location ?? ""}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="예: 서울 코엑스"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="시작일" required>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="종료일">
          <input
            type="date"
            value={endDate ?? ""}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <Field label="메모">
        <textarea
          value={note ?? ""}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="학회 주제/주최/특이사항 등"
        />
      </Field>

      {err && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
          {err}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "저장 중…" : mode === "create" ? "등록" : "저장"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-md border border-rose-300 text-rose-700 px-4 py-2 text-sm hover:bg-rose-50 disabled:opacity-50"
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-600 mb-1">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </div>
      {children}
    </label>
  );
}
