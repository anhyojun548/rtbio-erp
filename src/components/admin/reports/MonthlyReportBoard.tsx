"use client";

/**
 * 월간 보고서 Board (R16).
 *
 * - 월 선택기 (input type=month) + 전/다음달 버튼
 * - stat 4장: 매출/수금/출고/미수금 + 전월 대비 델타
 * - Invoice/Payment 상태 분포 (테이블)
 * - 거래처별 매출 Top 10
 * - 원장 요약 푸터
 */
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { MonthlyReport } from "@/lib/actions/report";

export function MonthlyReportBoard({
  month,
  current,
  previous,
}: {
  month: string;
  current: MonthlyReport;
  previous: MonthlyReport;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(month);

  function apply(next: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next)) return;
    start(() => router.push(`${pathname}?month=${next}`));
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

  const stats = [
    {
      label: "매출 (확정·발송)",
      value: current.invoices.totalAmount,
      prev: previous.invoices.totalAmount,
      unit: "원",
      tone: "emerald" as const,
      detail: `${current.invoices.total}건`,
    },
    {
      label: "수금",
      value: current.payments.totalAmount,
      prev: previous.payments.totalAmount,
      unit: "원",
      tone: "sky" as const,
      detail: `${current.payments.total}건`,
    },
    {
      label: "출고 완료",
      value: current.shipments.totalAmount,
      prev: previous.shipments.totalAmount,
      unit: "원",
      tone: "violet" as const,
      detail: `${current.shipments.completed}건 · ${current.shipments.totalQty.toLocaleString()}개`,
    },
    {
      label: "미수금 잔액",
      value: current.ledgerSummary.balance,
      prev: previous.ledgerSummary.balance,
      unit: "원",
      tone: "amber" as const,
      detail: `${current.ledgerSummary.clients}개 원장 · ${current.ledgerSummary.closed}개 마감`,
      invertDelta: true, // 감소가 좋음
    },
  ];

  return (
    <div className="space-y-5">
      {/* 월 선택 툴바 */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 flex flex-wrap gap-2 items-center">
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
        <span className="text-xs text-slate-500 ml-2">
          {month} · 전월({previous.closingMonth}) 대비
        </span>
        <div className="ml-auto flex gap-2">
          <Link
            href={`/admin/ledger?month=${month}`}
            className="text-xs text-sky-700 hover:underline"
          >
            원장 상세 →
          </Link>
          <Link
            href={`/admin/invoices`}
            className="text-xs text-sky-700 hover:underline"
          >
            거래명세서 →
          </Link>
        </div>
      </div>

      {/* stat 4장 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* 상태별 분포 (Invoice / Payment) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusTable
          title="거래명세서 (Invoice) 상태별 분포"
          rows={[
            { label: "임시저장(DRAFT)", ...current.invoices.byStatus.DRAFT },
            { label: "발행(ISSUED)", ...current.invoices.byStatus.ISSUED },
            { label: "발송(SENT)", ...current.invoices.byStatus.SENT },
            {
              label: "취소(CANCELLED)",
              ...current.invoices.byStatus.CANCELLED,
              muted: true,
            },
          ]}
        />
        <StatusTable
          title="수금(Payment) 상태별 분포"
          rows={[
            {
              label: "대기(PENDING)",
              ...current.payments.byStatus.PENDING,
              muted: true,
            },
            { label: "일부(PARTIAL)", ...current.payments.byStatus.PARTIAL },
            { label: "완납(PAID)", ...current.payments.byStatus.PAID },
            {
              label: "연체(OVERDUE)",
              ...current.payments.byStatus.OVERDUE,
              alert: true,
            },
          ]}
        />
      </div>

      {/* 거래처별 매출 Top 10 */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <header className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            거래처별 매출 Top 10
          </h2>
          <span className="text-xs text-slate-500">
            ISSUED/SENT Invoice 기준
          </span>
        </header>
        <table className="w-full text-sm">
          <thead className="text-slate-500 bg-slate-50/60">
            <tr className="text-left">
              <th className="px-4 py-1.5 font-medium w-10">#</th>
              <th className="px-4 py-1.5 font-medium">거래처</th>
              <th className="px-4 py-1.5 font-medium text-right">건수</th>
              <th className="px-4 py-1.5 font-medium text-right">매출액</th>
              <th className="px-4 py-1.5 font-medium text-right">비중</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {current.topClients.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-slate-400 text-sm"
                >
                  발행된 거래명세서가 없습니다.
                </td>
              </tr>
            )}
            {current.topClients.map((c, i) => {
              const share = current.invoices.totalAmount
                ? (c.totalAmount / current.invoices.totalAmount) * 100
                : 0;
              return (
                <tr key={c.clientId} className="hover:bg-slate-50">
                  <td className="px-4 py-1.5 text-slate-400 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-4 py-1.5">
                    <div className="font-medium text-slate-800">
                      {c.clientName}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {c.clientCode}
                    </div>
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums">
                    {c.invoiceCount}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums font-semibold text-slate-900">
                    {c.totalAmount.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-500">
                    {share.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 원장 요약 푸터 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-800 mb-2">
          원장 요약 ({current.ledgerSummary.clients}개 원장 ·{" "}
          {current.ledgerSummary.closed}개 마감)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <LedgerFigure
            label="전월 이월"
            value={current.ledgerSummary.carryOver}
          />
          <LedgerFigure
            label="당월 매출"
            value={current.ledgerSummary.monthlySales}
          />
          <LedgerFigure
            label="당월 수금"
            value={current.ledgerSummary.received}
          />
          <LedgerFigure
            label="미수금 잔액"
            value={current.ledgerSummary.balance}
            highlight
          />
        </div>
        <p className="text-xs text-slate-500 mt-3">
          공식: <code className="font-mono">carryOver + monthlySales - received = balance</code>
        </p>
      </section>
    </div>
  );
}

type Tone = "emerald" | "sky" | "violet" | "amber";

const TONE_CLASS: Record<
  Tone,
  { bg: string; border: string; text: string }
> = {
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  sky: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
  },
  violet: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
};

function StatCard({
  label,
  value,
  prev,
  unit,
  tone,
  detail,
  invertDelta,
}: {
  label: string;
  value: number;
  prev: number;
  unit: string;
  tone: Tone;
  detail: string;
  invertDelta?: boolean;
}) {
  const delta = value - prev;
  const deltaPct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : null;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const positive = invertDelta ? isDown : isUp;
  const negative = invertDelta ? isUp : isDown;
  const cls = TONE_CLASS[tone];

  return (
    <div className={`rounded-lg border p-4 ${cls.border} ${cls.bg}`}>
      <p className="text-xs text-slate-600">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${cls.text}`}>
        {value.toLocaleString("ko-KR")}
        <span className="text-sm font-medium ml-1 text-slate-500">{unit}</span>
      </p>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-slate-500">{detail}</span>
        <span
          className={`tabular-nums font-medium ${
            positive
              ? "text-emerald-600"
              : negative
                ? "text-rose-600"
                : "text-slate-400"
          }`}
        >
          {delta === 0
            ? "변화 없음"
            : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toLocaleString("ko-KR")}${
                deltaPct !== null
                  ? ` (${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%)`
                  : ""
              }`}
        </span>
      </div>
    </div>
  );
}

function StatusTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    label: string;
    count: number;
    amount: number;
    muted?: boolean;
    alert?: boolean;
  }>;
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <header className="px-4 py-2 border-b border-slate-200 bg-slate-50">
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </header>
      <table className="w-full text-sm">
        <thead className="text-slate-500 bg-slate-50/60">
          <tr className="text-left">
            <th className="px-4 py-1.5 font-medium">상태</th>
            <th className="px-4 py-1.5 font-medium text-right">건수</th>
            <th className="px-4 py-1.5 font-medium text-right">금액</th>
            <th className="px-4 py-1.5 font-medium text-right">비중</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const share = total > 0 ? (r.amount / total) * 100 : 0;
            return (
              <tr
                key={r.label}
                className={r.muted ? "text-slate-400" : ""}
              >
                <td className="px-4 py-1.5">
                  {r.alert && <span className="mr-1">⚠</span>}
                  {r.label}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {r.count}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums font-semibold">
                  {r.amount.toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">
                  {share.toFixed(1)}%
                </td>
              </tr>
            );
          })}
          <tr className="bg-slate-50 font-semibold">
            <td className="px-4 py-1.5">합계</td>
            <td className="px-4 py-1.5 text-right tabular-nums">
              {rows.reduce((s, r) => s + r.count, 0)}
            </td>
            <td className="px-4 py-1.5 text-right tabular-nums">
              {total.toLocaleString("ko-KR")}
            </td>
            <td className="px-4 py-1.5" />
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function LedgerFigure({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  const color =
    highlight && value > 0
      ? "text-rose-700"
      : highlight && value < 0
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <div className="rounded-md border border-slate-100 p-3 bg-slate-50/50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-1 ${color}`}>
        {value.toLocaleString("ko-KR")}원
      </p>
    </div>
  );
}
