"use client";

/**
 * 월 선택 툴바 — `?month=YYYY-MM` 쿼리를 업데이트.
 * MonthlyReportBoard 의 로컬 구현을 분리/재사용 가능하게 추출.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function MonthPicker({
  month,
  basePath,
}: {
  month: string;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(month);

  function apply(next: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next)) return;
    start(() => router.push(`${basePath}?month=${next}`));
  }

  function shift(delta: -1 | 1) {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    let ny = y;
    let nm = m + delta;
    if (nm > 12) {
      ny += 1;
      nm = 1;
    } else if (nm < 1) {
      ny -= 1;
      nm = 12;
    }
    const next = `${ny}-${String(nm).padStart(2, "0")}`;
    setForm(next);
    apply(next);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
      <button
        type="button"
        onClick={() => shift(-1)}
        disabled={pending}
        className="rounded-md border border-slate-300 bg-white text-slate-700 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        ← 전월
      </button>
      <input
        type="month"
        value={form}
        onChange={(e) => setForm(e.target.value)}
        onBlur={() => {
          if (form !== month) apply(form);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && form !== month) apply(form);
        }}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      />
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={pending}
        className="rounded-md border border-slate-300 bg-white text-slate-700 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        다음월 →
      </button>
    </div>
  );
}
