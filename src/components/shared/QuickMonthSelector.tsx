"use client";

/**
 * QuickMonthSelector — 1~12월 pill 버튼으로 시작/종료일을 자동 채우는 위젯
 *
 * 사용:
 *   const [from, setFrom] = useState("2026-05-01");
 *   const [to,   setTo]   = useState("2026-05-31");
 *   <QuickMonthSelector
 *     from={from} to={to}
 *     onChange={(f, t) => { setFrom(f); setTo(t); }}
 *   />
 *
 * prototype/js/shared-ui.js 의 buildMonthQuickPicker / applyMonthQuick 를 React 로 변환.
 */

import { useState, useEffect } from "react";

interface Props {
  /** 현재 시작일 (YYYY-MM-DD) */
  from?: string;
  /** 현재 종료일 (YYYY-MM-DD) */
  to?: string;
  /** 변경 콜백 */
  onChange: (from: string, to: string) => void;
  /** 연도 (생략 시 올해) */
  defaultYear?: number;
  /** 이전 N년까지 선택 가능 (기본 2) */
  yearOffset?: number;
  /** "이번달" 버튼 표시 (기본 true) */
  showThisMonth?: boolean;
  /** "올해" (YTD) 버튼 표시 (기본 true) */
  showYTD?: boolean;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function QuickMonthSelector({
  from,
  to,
  onChange,
  defaultYear,
  yearOffset = 2,
  showThisMonth = true,
  showYTD = true,
}: Props) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(defaultYear ?? thisYear);

  // from 으로부터 현재 선택된 월 유추 (highlight 용)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  useEffect(() => {
    if (!from) { setSelectedMonth(null); return; }
    const d = new Date(from);
    if (d.getFullYear() === year) {
      setSelectedMonth(d.getMonth() + 1);
    } else {
      setSelectedMonth(null);
    }
  }, [from, year]);

  function applyMonth(y: number, m: number) {
    const first = new Date(y, m - 1, 1);
    const last  = new Date(y, m, 0);
    onChange(fmt(first), fmt(last));
    setSelectedMonth(m);
  }

  function applyYTD() {
    const today = new Date();
    const first = new Date(year, 0, 1);
    const end = (year === today.getFullYear()) ? today : new Date(year, 11, 31);
    onChange(fmt(first), fmt(end));
    setSelectedMonth(null);
  }

  function applyYearChange(newYear: number) {
    setYear(newYear);
    // 동일 월 유지하면서 연도만 변경
    if (selectedMonth) {
      applyMonth(newYear, selectedMonth);
    }
  }

  const years = Array.from({ length: yearOffset + 1 }, (_, i) => thisYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const thisMonth = new Date().getMonth() + 1;

  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      <span className="text-tiny text-ink-secondary font-semibold pr-1">빠른선택:</span>

      {/* 연도 select */}
      <select
        className="rounded-xs border border-border bg-surface px-2 py-1 text-tiny"
        value={year}
        onChange={(e) => applyYearChange(parseInt(e.target.value, 10))}
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}년</option>
        ))}
      </select>

      {/* 월 pill */}
      {months.map((m) => {
        const isActive = selectedMonth === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => applyMonth(year, m)}
            className={`
              px-2 py-1 rounded-xs text-tiny font-semibold transition
              ${isActive
                ? "bg-primary text-white"
                : "bg-canvas border border-border text-ink-secondary hover:bg-primary-lighter hover:text-primary"
              }
            `}
          >
            {m}월
          </button>
        );
      })}

      {showThisMonth && (
        <button
          type="button"
          onClick={() => applyMonth(thisYear, thisMonth)}
          className="px-2 py-1 rounded-xs text-tiny font-semibold bg-accent-light text-accent-dark hover:bg-accent hover:text-white transition"
        >
          이번달
        </button>
      )}
      {showYTD && (
        <button
          type="button"
          onClick={applyYTD}
          className="px-2 py-1 rounded-xs text-tiny font-semibold bg-canvas border border-border text-ink-secondary hover:bg-primary-lighter hover:text-primary transition"
        >
          올해
        </button>
      )}
    </div>
  );
}
