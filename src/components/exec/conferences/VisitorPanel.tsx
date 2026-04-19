"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createVisitor,
  updateVisitor,
  deleteVisitor,
} from "@/lib/actions/conference";
import {
  VISITOR_CONTACT_STATUS,
  VISITOR_CONTACT_STATUS_LABEL,
  type VisitorContactStatus,
} from "@/lib/validators/conference";

type Rep = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type Visitor = {
  id: string;
  name: string;
  phone: string | null;
  affiliation: string | null;
  assignedRepId: string | null;
  contactStatus: string | null;
  note: string | null;
  createdAt: string;
};

type FormState = {
  id?: string;
  name: string;
  phone: string;
  affiliation: string;
  assignedRepId: string; // "" 가 미배정
  contactStatus: "" | VisitorContactStatus;
  note: string;
};

const EMPTY: FormState = {
  name: "",
  phone: "",
  affiliation: "",
  assignedRepId: "",
  contactStatus: "",
  note: "",
};

const STATUS_BADGE: Record<VisitorContactStatus, string> = {
  NEW: "bg-sky-50 text-sky-700 border-sky-200",
  CONTACTING: "bg-amber-50 text-amber-800 border-amber-200",
  DEAL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOST: "bg-slate-100 text-slate-500 border-slate-200",
};

function repLabel(r: Rep) {
  return r.name ? `${r.name} (${r.email})` : r.email;
}

function isContactStatus(v: string): v is VisitorContactStatus {
  return (VISITOR_CONTACT_STATUS as readonly string[]).includes(v);
}

export function VisitorPanel({
  conferenceId,
  initialVisitors,
  reps,
}: {
  conferenceId: string;
  initialVisitors: Visitor[];
  reps: Rep[];
}) {
  const router = useRouter();
  const [visitors] = useState(initialVisitors);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const repMap = new Map(reps.map((r) => [r.id, r]));

  function openNew() {
    setEditing({ ...EMPTY });
    setErr(null);
  }

  function openEdit(v: Visitor) {
    setEditing({
      id: v.id,
      name: v.name,
      phone: v.phone ?? "",
      affiliation: v.affiliation ?? "",
      assignedRepId: v.assignedRepId ?? "",
      contactStatus:
        v.contactStatus && isContactStatus(v.contactStatus)
          ? v.contactStatus
          : "",
      note: v.note ?? "",
    });
    setErr(null);
  }

  function close() {
    setEditing(null);
    setErr(null);
  }

  function submit() {
    if (!editing) return;
    setErr(null);

    const contactStatus = editing.contactStatus === "" ? undefined : editing.contactStatus;

    start(async () => {
      if (editing.id) {
        const r = await updateVisitor({
          id: editing.id,
          name: editing.name,
          phone: editing.phone || null,
          affiliation: editing.affiliation || null,
          assignedRepId: editing.assignedRepId || null,
          contactStatus,
          note: editing.note || null,
        });
        if (!r.ok) {
          setErr(r.error);
          return;
        }
      } else {
        const r = await createVisitor({
          conferenceId,
          name: editing.name,
          phone: editing.phone,
          affiliation: editing.affiliation,
          ...(editing.assignedRepId && { assignedRepId: editing.assignedRepId }),
          contactStatus,
          note: editing.note,
        });
        if (!r.ok) {
          setErr(r.error);
          return;
        }
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(v: Visitor) {
    if (!confirm(`방문자 "${v.name}"을(를) 삭제하시겠습니까?`)) return;
    start(async () => {
      const r = await deleteVisitor(v.id);
      if (!r.ok) {
        alert(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          방문자 정보·담당자 배정·접촉 상태를 관리합니다. (총 {visitors.length}명)
        </p>
        <button
          type="button"
          onClick={openNew}
          className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700"
        >
          + 방문자 추가
        </button>
      </div>

      {visitors.length === 0 && !editing ? (
        <p className="text-center py-8 text-sm text-slate-400">
          아직 방문자가 없습니다. <strong>+ 방문자 추가</strong>를 눌러
          입력하세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-slate-500 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">연락처</th>
                <th className="px-3 py-2 text-left">소속</th>
                <th className="px-3 py-2 text-left">담당자</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-left">비고</th>
                <th className="px-3 py-2 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visitors.map((v) => {
                const rep = v.assignedRepId ? repMap.get(v.assignedRepId) : null;
                const status =
                  v.contactStatus && isContactStatus(v.contactStatus)
                    ? v.contactStatus
                    : null;
                return (
                  <tr key={v.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {v.name}
                    </td>
                    <td className="px-3 py-2 text-slate-700 tabular-nums">
                      {v.phone ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {v.affiliation ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {rep ? rep.name ?? rep.email : (
                        <span className="text-slate-400">미배정</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {status ? (
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[status]}`}
                        >
                          {VISITOR_CONTACT_STATUS_LABEL[status]}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-[14rem] truncate">
                      {v.note ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(v)}
                        className="text-xs text-slate-600 hover:text-sky-700 mr-2"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => remove(v)}
                        className="text-xs text-rose-600 hover:text-rose-700 disabled:opacity-50"
                      >
                        삭제
                      </button>
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
            {editing.id ? "방문자 편집" : "새 방문자"}
          </h3>
          {err && (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              {err}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="이름 *"
              value={editing.name}
              onChange={(v) => setEditing({ ...editing, name: v })}
              placeholder="예: 김의사"
            />
            <Field
              label="연락처"
              value={editing.phone}
              onChange={(v) => setEditing({ ...editing, phone: v })}
              placeholder="010-0000-0000"
            />
            <Field
              label="소속"
              className="col-span-2"
              value={editing.affiliation}
              onChange={(v) => setEditing({ ...editing, affiliation: v })}
              placeholder="예: 서울대학교병원 정형외과"
            />
            <div>
              <label className="block text-xs text-slate-500 mb-1">담당자 배정</label>
              <select
                value={editing.assignedRepId}
                onChange={(e) =>
                  setEditing({ ...editing, assignedRepId: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="">미배정</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {repLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">접촉 상태</label>
              <select
                value={editing.contactStatus}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    contactStatus: isContactStatus(e.target.value)
                      ? e.target.value
                      : "",
                  })
                }
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="">(미분류)</option>
                {VISITOR_CONTACT_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {VISITOR_CONTACT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">비고</label>
              <textarea
                value={editing.note}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
                placeholder="관심 제품·팔로업 일정 등"
              />
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
      />
    </div>
  );
}
