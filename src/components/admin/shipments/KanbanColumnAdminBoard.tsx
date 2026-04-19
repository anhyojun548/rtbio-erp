"use client";

/**
 * 칸반 단계 관리 Board — 단계 추가/수정/삭제/재정렬 (R05).
 *
 * - 표 형태: sortOrder 오름차순.
 * - 편집 버튼 → 인라인 폼.
 * - 재정렬은 ▲▼ 버튼 (드래그 드롭은 Phase 후속).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createKanbanColumn,
  updateKanbanColumn,
  deleteKanbanColumn,
  reorderKanbanColumns,
} from "@/lib/actions/kanban";

type Row = {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  isTerminal: boolean;
  color: string | null;
  shipmentCount: number;
};

type Msg = { type: "ok" | "err"; text: string } | null;

export function KanbanColumnAdminBoard({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Row>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<{
    key: string;
    label: string;
    sortOrder: string;
    isTerminal: boolean;
    color: string;
  }>({
    key: "",
    label: "",
    sortOrder: "",
    isTerminal: false,
    color: "",
  });
  const [msg, setMsg] = useState<Msg>(null);

  function startEdit(r: Row) {
    setEditingId(r.id);
    setEditForm({
      label: r.label,
      sortOrder: r.sortOrder,
      isTerminal: r.isTerminal,
      color: r.color,
    });
    setMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  function saveEdit(id: string) {
    start(async () => {
      const res = await updateKanbanColumn(id, {
        label: editForm.label,
        sortOrder:
          editForm.sortOrder !== undefined ? Number(editForm.sortOrder) : undefined,
        isTerminal: editForm.isTerminal,
        color: editForm.color ?? "",
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "단계를 수정했습니다." });
      setEditingId(null);
      setEditForm({});
      router.refresh();
    });
  }

  function removeRow(r: Row) {
    if (r.shipmentCount > 0) {
      alert(
        `이 단계에 ${r.shipmentCount}건의 출고가 연결되어 있어 삭제할 수 없습니다.`,
      );
      return;
    }
    if (!window.confirm(`단계 "${r.label}" 을(를) 삭제할까요?`)) return;
    start(async () => {
      const res = await deleteKanbanColumn(r.id);
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "단계를 삭제했습니다." });
      router.refresh();
    });
  }

  function shiftSort(r: Row, delta: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((x) => x.id === r.id);
    const other = sorted[idx + delta];
    if (!other) return;
    start(async () => {
      const res = await reorderKanbanColumns({
        items: [
          { id: r.id, sortOrder: other.sortOrder },
          { id: other.id, sortOrder: r.sortOrder },
        ],
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      router.refresh();
    });
  }

  function onAdd() {
    const sort = Number(addForm.sortOrder);
    if (!Number.isFinite(sort) || sort < 0) {
      setMsg({ type: "err", text: "sortOrder 는 0 이상의 정수여야 합니다." });
      return;
    }
    start(async () => {
      const res = await createKanbanColumn({
        key: addForm.key.trim().toUpperCase(),
        label: addForm.label.trim(),
        sortOrder: sort,
        isTerminal: addForm.isTerminal,
        color: addForm.color.trim(),
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "단계를 추가했습니다." });
      setAddForm({
        key: "",
        label: "",
        sortOrder: "",
        isTerminal: false,
        color: "",
      });
      setShowAdd(false);
      router.refresh();
    });
  }

  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {sorted.length}개 단계 · 사용 중인 단계는 삭제할 수 없습니다.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowAdd((v) => !v);
            setMsg(null);
          }}
          className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700"
        >
          {showAdd ? "닫기" : "+ 단계 추가"}
        </button>
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

      {showAdd && (
        <div className="rounded-md border border-sky-200 bg-sky-50/40 p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">
                key (대문자)
              </label>
              <input
                value={addForm.key}
                onChange={(e) =>
                  setAddForm({ ...addForm, key: e.target.value.toUpperCase() })
                }
                placeholder="PACKING"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">라벨</label>
              <input
                value={addForm.label}
                onChange={(e) =>
                  setAddForm({ ...addForm, label: e.target.value })
                }
                placeholder="포장"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">
                sortOrder
              </label>
              <input
                type="number"
                value={addForm.sortOrder}
                onChange={(e) =>
                  setAddForm({ ...addForm, sortOrder: e.target.value })
                }
                placeholder="10"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">
                color (선택)
              </label>
              <input
                value={addForm.color}
                onChange={(e) =>
                  setAddForm({ ...addForm, color: e.target.value })
                }
                placeholder="#60a5fa"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={addForm.isTerminal}
                  onChange={(e) =>
                    setAddForm({ ...addForm, isTerminal: e.target.checked })
                  }
                />
                terminal
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-md border border-slate-300 bg-white text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onAdd}
              disabled={pending}
              className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {pending ? "등록 중…" : "등록"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium w-16">#</th>
              <th className="px-3 py-2 font-medium">key</th>
              <th className="px-3 py-2 font-medium">라벨</th>
              <th className="px-3 py-2 font-medium w-16">terminal</th>
              <th className="px-3 py-2 font-medium w-20">color</th>
              <th className="px-3 py-2 font-medium text-right w-20">shipment</th>
              <th className="px-3 py-2 font-medium text-right w-56">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-slate-400 text-sm"
                >
                  등록된 단계가 없습니다.
                </td>
              </tr>
            )}
            {sorted.map((r, i) => {
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id}>
                  <td className="px-3 py-1.5 tabular-nums text-slate-500">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.sortOrder ?? r.sortOrder}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            sortOrder: Number(e.target.value),
                          })
                        }
                        className="w-16 rounded-md border border-slate-300 px-1.5 py-0.5 text-sm tabular-nums"
                      />
                    ) : (
                      r.sortOrder
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.key}</td>
                  <td className="px-3 py-1.5">
                    {isEditing ? (
                      <input
                        value={editForm.label ?? r.label}
                        onChange={(e) =>
                          setEditForm({ ...editForm, label: e.target.value })
                        }
                        className="rounded-md border border-slate-300 px-2 py-0.5 text-sm"
                      />
                    ) : (
                      r.label
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editForm.isTerminal ?? r.isTerminal}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            isTerminal: e.target.checked,
                          })
                        }
                      />
                    ) : r.isTerminal ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800 font-medium">
                        terminal
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {isEditing ? (
                      <input
                        value={editForm.color ?? r.color ?? ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, color: e.target.value })
                        }
                        placeholder="#RRGGBB"
                        className="w-24 rounded-md border border-slate-300 px-1.5 py-0.5 text-sm font-mono"
                      />
                    ) : r.color ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="inline-block w-4 h-4 rounded border border-slate-200"
                          style={{ background: r.color }}
                        />
                        <span className="font-mono text-xs text-slate-500">
                          {r.color}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.shipmentCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="inline-flex gap-1">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => saveEdit(r.id)}
                            className="rounded-md bg-emerald-600 text-white px-2 py-0.5 text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md border border-slate-300 bg-white text-slate-700 px-2 py-0.5 text-xs hover:bg-slate-50"
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={pending || i === 0}
                            onClick={() => shiftSort(r, -1)}
                            className="rounded-md border border-slate-300 bg-white text-slate-700 px-1.5 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-30"
                            title="위로"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={pending || i === sorted.length - 1}
                            onClick={() => shiftSort(r, 1)}
                            className="rounded-md border border-slate-300 bg-white text-slate-700 px-1.5 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-30"
                            title="아래로"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="rounded-md border border-sky-200 text-sky-700 px-2 py-0.5 text-xs hover:bg-sky-50"
                          >
                            편집
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(r)}
                            disabled={pending || r.shipmentCount > 0}
                            className="rounded-md border border-red-200 text-red-600 px-2 py-0.5 text-xs hover:bg-red-50 disabled:opacity-30"
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
