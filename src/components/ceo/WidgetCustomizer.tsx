"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addWidget,
  removeWidget,
  reorderWidgets,
  resetLayout,
  updateWidget,
} from "@/lib/actions/widget-dashboard";
import type {
  DateRangePreset,
  WidgetPreset,
} from "@/lib/validators/widget-dashboard";
import {
  DATE_RANGE_LABEL,
  DATE_RANGE_PRESETS,
} from "@/lib/validators/widget-dashboard";

type MyWidget = {
  id: string;
  preset: string;
  position: number;
  width: number;
  height: number;
  overrideDateRange: string | null;
  meta: WidgetPreset | null;
};

export function WidgetCustomizer({
  widgets,
  allPresets,
}: {
  widgets: MyWidget[];
  allPresets: WidgetPreset[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const usedKeys = new Set(widgets.map((w) => w.preset));
  const availableToAdd = allPresets.filter((p) => !usedKeys.has(p.key));

  function runAction(fn: () => Promise<void>) {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "작업 중 오류가 발생했습니다.");
      }
    });
  }

  function handleAdd(key: string) {
    runAction(() => addWidget({ preset: key }).then(() => undefined));
  }

  function handleRemove(id: string) {
    if (!confirm("위젯을 제거할까요?")) return;
    runAction(() => removeWidget(id));
  }

  function handleMove(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= widgets.length) return;
    const items = widgets.map((w, i) => ({
      id: w.id,
      position:
        i === idx
          ? widgets[target]!.position
          : i === target
            ? widgets[idx]!.position
            : w.position,
    }));
    // 안정적인 재정렬 — 모든 위젯을 0..n-1 로 재할당
    const newOrder = [...widgets];
    [newOrder[idx], newOrder[target]] = [newOrder[target]!, newOrder[idx]!];
    const normalized = newOrder.map((w, i) => ({ id: w.id, position: i }));
    void items;
    runAction(() => reorderWidgets({ items: normalized }));
  }

  function handleWidth(id: string, width: number) {
    runAction(() => updateWidget({ id, width }));
  }

  function handleDateRange(id: string, value: string) {
    runAction(() => updateWidget({ id, overrideDateRange: value === "" ? null : value }),
    );
  }

  function handleReset() {
    if (!confirm("현재 위젯을 모두 제거하고 기본 레이아웃(KPI 4종)으로 초기화할까요?"))
      return;
    runAction(() => resetLayout({}));
  }

  return (
    <div className="space-y-6"> {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700"> {error}
        </div> )}

      {/* ─── 현재 내 위젯 ──────────────────────────── */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">내 위젯</h2>
            <p className="text-xs text-slate-500 mt-0.5"> 총 {widgets.length}개 · 순서/크기/기간을 조정할 수 있습니다.
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={pending}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          > 기본 레이아웃으로 초기화
          </button>
        </div> {widgets.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500"> 아직 추가된 위젯이 없습니다. 아래에서 원하는 프리셋을 추가하세요.
          </div> ) : (
          <ul className="divide-y divide-slate-100"> {widgets.map((w, idx) => (
              <li key={w.id} className="p-4 flex items-start gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMove(idx, -1)}
                    disabled={pending || idx === 0}
                    className="rounded border border-slate-300 w-8 h-8 text-xs hover:bg-slate-50 disabled:opacity-30"
                    aria-label="위로"
                  > ▲
                  </button>
                  <button
                    onClick={() => handleMove(idx, 1)}
                    disabled={pending || idx === widgets.length - 1}
                    className="rounded border border-slate-300 w-8 h-8 text-xs hover:bg-slate-50 disabled:opacity-30"
                    aria-label="아래로"
                  > ▼
                  </button>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{w.meta?.icon ?? ""}</span>
                    <span className="text-sm font-semibold text-slate-900"> {w.meta?.label ?? w.preset}
                    </span>
                    <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px]"> {w.meta?.kind === "list" ? "표" : "KPI"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1"> {w.meta?.description ?? ""}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 uppercase"> 너비 (1-12)
                  </label>
                  <select
                    value={w.width}
                    onChange={(e) => handleWidth(w.id, Number.parseInt(e.target.value, 10))
                    }
                    disabled={pending}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  > {[3, 4, 6, 8, 12].map((n) => (
                      <option key={n} value={n}> {n}
                      </option> ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 uppercase"> 기간 override
                  </label>
                  <select
                    value={w.overrideDateRange ?? ""}
                    onChange={(e) => handleDateRange(w.id, e.target.value)}
                    disabled={pending}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm min-w-[120px]"
                  >
                    <option value="">(전역 기본값)</option> {DATE_RANGE_PRESETS.map((p) => (
                      <option key={p} value={p}> {DATE_RANGE_LABEL[p as DateRangePreset]}
                      </option> ))}
                  </select>
                </div>
                <button
                  onClick={() => handleRemove(w.id)}
                  disabled={pending}
                  className="rounded-md border border-rose-300 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                > 제거
                </button>
              </li> ))}
          </ul> )}
      </section> {/* ─── 추가 가능한 프리셋 ────────────────────── */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">추가 가능한 위젯</h2>
          <p className="text-xs text-slate-500 mt-0.5"> {availableToAdd.length}개 프리셋을 추가할 수 있습니다.
          </p>
        </div> {availableToAdd.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500"> 모든 프리셋을 이미 추가했습니다.
          </div> ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4"> {availableToAdd.map((p) => (
              <button
                key={p.key}
                onClick={() => handleAdd(p.key)}
                disabled={pending}
                className="flex items-start gap-3 text-left rounded-md border border-slate-200 p-3 hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50"
              >
                <span className="text-xl mt-0.5">{p.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900"> {p.label}
                    </span>
                    <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px]"> {p.kind === "list" ? "표" : "KPI"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5"> {p.description}
                  </div>
                </div>
                <span className="text-xs text-sky-600 mt-0.5">+ 추가</span>
              </button> ))}
          </div> )}
      </section>
    </div> );
}
