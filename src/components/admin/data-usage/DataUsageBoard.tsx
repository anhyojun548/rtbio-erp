"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonthPicker } from "@/components/admin/reports/MonthPicker";
import {
  upsertDataUsage,
  updateDataUsage,
  deleteDataUsage,
} from "@/lib/actions/data-usage";
import {
  DATA_USAGE_CATEGORY_PRESETS,
  DATA_USAGE_UNIT_PRESETS,
  computeMoMDelta,
} from "@/lib/validators/data-usage";

type Row = {
  id: string;
  month: string;
  category: string;
  unit: string;
  amount: number;
  note: string | null;
  createdAt: Date;
};

type Summary = {
  month: string;
  rows: Row[];
  byCategory: { category: string; amount: number; unit: string; count: number }[];
  totalRows: number;
};

type Comparison = {
  month: string;
  prevMonth: string;
  comparison: {
    category: string;
    current: number | null;
    previous: number | null;
    unit: string;
  }[];
};

type FormState = {
  category: string;
  unit: string;
  amount: string; // 입력은 문자열, 서버로 보낼 때 coerce
  note: string;
};

const EMPTY: FormState = {
  category: "",
  unit: "GB",
  amount: "",
  note: "",
};

function fmt(n: number): string {
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fmtDelta(delta: number): string {
  if (delta === 0) return "±0";
  const sign = delta > 0 ? "▲" : "▼";
  return `${sign} ${fmt(Math.abs(delta))}`;
}

export function DataUsageBoard({
  month,
  summary,
  comparison,
  availableMonths,
}: {
  month: string;
  summary: Summary;
  comparison: Comparison;
  availableMonths: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY);

  function resetAdd() {
    setAddForm(EMPTY);
    setErr(null);
  }

  function submitAdd() {
    setErr(null);
    const category = addForm.category.trim();
    const unit = addForm.unit.trim();
    if (!category || !unit) {
      setErr("카테고리와 단위를 입력해주세요.");
      return;
    }
    const amt = Number(addForm.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      setErr("수량은 0 이상의 숫자여야 합니다.");
      return;
    }
    start(async () => {
      const r = await upsertDataUsage({
        month,
        category,
        unit,
        amount: amt,
        note: addForm.note,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      resetAdd();
      router.refresh();
    });
  }

  function beginEdit(row: Row) {
    setEditingId(row.id);
    setEditForm({
      category: row.category,
      unit: row.unit,
      amount: String(row.amount),
      note: row.note ?? "",
    });
    setErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setErr(null);
  }

  function submitEdit(id: string) {
    setErr(null);
    const amt = Number(editForm.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      setErr("수량은 0 이상의 숫자여야 합니다.");
      return;
    }
    start(async () => {
      const r = await updateDataUsage({
        id,
        category: editForm.category,
        unit: editForm.unit,
        amount: amt,
        note: editForm.note || null,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(row: Row) {
    if (!confirm(`${row.category} (${month}) 항목을 삭제하시겠습니까?`)) return;
    start(async () => {
      const r = await deleteDataUsage(row.id);
      if (!r.ok) {
        alert(r.error);
        return;
      }
      router.refresh();
    });
  }

  const totalRows = summary.totalRows;
  const totalCategories = summary.byCategory.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <MonthPicker month={month} basePath="/admin/data-usage" />
        {availableMonths.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>최근 기록:</span>
            {availableMonths.slice(0, 5).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() =>
                  start(() => router.push(`/admin/data-usage?month=${m}`))
                }
                className={`rounded px-2 py-0.5 ${
                  m === month
                    ? "bg-sky-100 text-sky-800 font-medium"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="등록 항목 수"
          value={`${totalRows}건`}
          hint={`${totalCategories}개 카테고리`}
        />
        <StatCard
          label="전월 기록"
          value={`${comparison.prevMonth}`}
          hint={`${comparison.comparison.filter((c) => c.previous !== null).length}건 존재`}
        />
        <StatCard
          label="이번달"
          value={`${summary.month}`}
          hint={`입력 중`}
        />
      </div>

      {/* 비교 테이블 */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <header className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              {month} 사용량 · 전월({comparison.prevMonth}) 대비
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              당월/전월 양쪽에 있는 카테고리는 증감 % 표시. 당월에만 있으면
              "신규", 전월에만 있으면 "누락".
            </p>
          </div>
        </header>
        {comparison.comparison.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            이번달·전월 모두 기록이 없습니다. 아래 폼으로 추가하세요.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">카테고리</th>
                  <th className="px-3 py-2 text-right">당월</th>
                  <th className="px-3 py-2 text-right">전월</th>
                  <th className="px-3 py-2 text-right">증감</th>
                  <th className="px-3 py-2 text-left">단위</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparison.comparison.map((c) => {
                  const delta =
                    c.current !== null
                      ? computeMoMDelta(c.current, c.previous)
                      : null;
                  return (
                    <tr key={c.category} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {c.category}
                        {c.current === null && (
                          <span className="ml-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            전월만 존재
                          </span>
                        )}
                        {c.previous === null && c.current !== null && (
                          <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                            신규
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {c.current !== null ? fmt(c.current) : "-"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                        {c.previous !== null ? fmt(c.previous) : "-"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {delta && c.previous !== null ? (
                          <span
                            className={
                              delta.delta > 0
                                ? "text-rose-600"
                                : delta.delta < 0
                                  ? "text-emerald-700"
                                  : "text-slate-500"
                            }
                          >
                            {fmtDelta(delta.delta)}
                            {delta.percent !== null && (
                              <span className="text-xs ml-1">
                                ({delta.percent > 0 ? "+" : ""}
                                {delta.percent.toFixed(1)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{c.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 당월 상세 (편집/삭제 가능) */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <header className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">
            {month} 상세 목록 · 편집 가능
          </h2>
          <span className="text-xs text-slate-500">{totalRows}건</span>
        </header>
        {err && (
          <div className="px-5 py-2 bg-rose-50 border-b border-rose-200 text-sm text-rose-700">
            {err}
          </div>
        )}
        {summary.rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            이번달 기록이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">카테고리</th>
                  <th className="px-3 py-2 text-right">수량</th>
                  <th className="px-3 py-2 text-left">단위</th>
                  <th className="px-3 py-2 text-left">비고</th>
                  <th className="px-3 py-2 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.rows.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id}>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                category: e.target.value,
                              })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="font-medium text-slate-900">
                            {r.category}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editForm.amount}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                amount: e.target.value,
                              })
                            }
                            className="w-32 text-right rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          fmt(r.amount)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            list="unit-presets"
                            value={editForm.unit}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                unit: e.target.value,
                              })
                            }
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="text-slate-600">{r.unit}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 max-w-[20rem]">
                        {isEditing ? (
                          <input
                            value={editForm.note}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                note: e.target.value,
                              })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          r.note ?? "-"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => submitEdit(r.id)}
                              className="text-xs text-sky-700 hover:text-sky-800 mr-2 disabled:opacity-50"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => beginEdit(r)}
                              className="text-xs text-slate-600 hover:text-sky-700 mr-2"
                            >
                              편집
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => remove(r)}
                              className="text-xs text-rose-600 hover:text-rose-700 disabled:opacity-50"
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 추가 폼 — 항상 보임 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitAdd();
          }}
          className="border-t border-slate-200 bg-slate-50/50 p-5 space-y-3"
        >
          <h3 className="font-medium text-slate-800 text-sm">
            {month} 신규 항목 추가
          </h3>
          <p className="text-xs text-slate-500">
            동일 카테고리가 이미 있다면 자동으로 덮어씁니다 (upsert).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                카테고리 *
              </label>
              <input
                list="category-presets"
                value={addForm.category}
                onChange={(e) =>
                  setAddForm({ ...addForm, category: e.target.value })
                }
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
                placeholder="예: 서버"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                수량 *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={addForm.amount}
                onChange={(e) =>
                  setAddForm({ ...addForm, amount: e.target.value })
                }
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
                placeholder="128.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                단위 *
              </label>
              <input
                list="unit-presets"
                value={addForm.unit}
                onChange={(e) =>
                  setAddForm({ ...addForm, unit: e.target.value })
                }
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
                placeholder="GB"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">비고</label>
              <input
                value={addForm.note}
                onChange={(e) =>
                  setAddForm({ ...addForm, note: e.target.value })
                }
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
                placeholder="피크 시점·기간 등"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-sky-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {pending ? "저장중…" : "추가 / 덮어쓰기"}
            </button>
            {(addForm.category || addForm.amount || addForm.note) && (
              <button
                type="button"
                onClick={resetAdd}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                초기화
              </button>
            )}
          </div>
        </form>
      </section>

      {/* datalist 프리셋 */}
      <datalist id="category-presets">
        {DATA_USAGE_CATEGORY_PRESETS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="unit-presets">
        {DATA_USAGE_UNIT_PRESETS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
