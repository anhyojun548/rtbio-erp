/**
 * 담당자 상세 breakdown (Phase 3F-2, R15).
 *
 * - 거래처별 매출/입금/미수금
 * - 제품·사이즈별 매출 (드릴다운)
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getSalesRepClientBreakdown,
  getSalesRepProductBreakdown,
} from "@/lib/actions/sales-performance";
import { MonthPicker } from "@/components/admin/reports/MonthPicker";

type SearchParams = { month?: string };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CLIENT_TYPE_LABEL: Record<string, string> = {
  HOSPITAL: "병원",
  PHARMACY: "약국",
  DEALER: "대리점",
  RETAIL: "소매",
  ETC: "기타",
};

export default async function SalesRepDetailPage({
  params,
  searchParams,
}: {
  params: { salesRepId: string };
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const rep = await prisma.user.findUnique({
    where: { id: params.salesRepId },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!rep) notFound();

  const month =
    searchParams.month && MONTH_RE.test(searchParams.month)
      ? searchParams.month
      : defaultMonth();

  const [clients, products] = await Promise.all([
    getSalesRepClientBreakdown({ salesRepId: rep.id, month }),
    getSalesRepProductBreakdown({ salesRepId: rep.id, month }),
  ]);

  const totalSales = clients.reduce((s, c) => s + c.salesTotal, 0);
  const totalPayment = clients.reduce((s, c) => s + c.paymentTotal, 0);
  const totalOutstanding = clients.reduce((s, c) => s + c.outstanding, 0);
  const totalQty = products.reduce((s, p) => s + p.qty, 0);
  const totalProductAmount = products.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link
              href={`/admin/reports/sales?month=${month}`}
              className="text-primary hover:underline"
            >
              ← 담당자 목록
            </Link>
          </div>
          <h1 className="text-display m-0 mt-1">
            {rep.name}
            {!rep.active && (
              <span className="ml-2 text-xs font-normal text-rose-600">
                (비활성)
              </span>
            )}
          </h1>
          <p className="text-caption text-ink-secondary mt-1">
            {rep.email} · {rep.role} · {month}
          </p>
        </div>
        <MonthPicker
          month={month}
          basePath={`/admin/reports/sales/${rep.id}`}
        />
      </header>

      {/* 요약 */}
      <section className="grid grid-cols-4 gap-4">
        <Stat label="담당 거래처" value={`${clients.length}개`} tone="sky" />
        <Stat
          label="매출"
          value={`₩${totalSales.toLocaleString()}`}
          tone="emerald"
        />
        <Stat
          label="입금"
          value={`₩${totalPayment.toLocaleString()}`}
          tone="violet"
        />
        <Stat
          label="미수금"
          value={`₩${totalOutstanding.toLocaleString()}`}
          tone="rose"
        />
      </section>

      {/* 거래처 breakdown */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">거래처별 breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ISSUED+SENT 매출 desc · 미수금은 원장(closingMonth) balance.
          </p>
        </div>
        {clients.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            담당 거래처가 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">거래처</th>
                <th className="px-4 py-2 text-left">유형</th>
                <th className="px-4 py-2 text-right">명세서</th>
                <th className="px-4 py-2 text-right">매출</th>
                <th className="px-4 py-2 text-right">입금</th>
                <th className="px-4 py-2 text-right">미수금</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.clientId} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/clients/${c.clientId}`}
                      className="text-sky-700 hover:underline font-medium"
                    >
                      {c.clientName}
                    </Link>
                    <div className="font-mono text-[10px] text-slate-400">
                      {c.clientCode}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {CLIENT_TYPE_LABEL[c.type] ?? c.type}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                    {c.invoiceCount}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">
                    {c.salesTotal > 0
                      ? `₩${c.salesTotal.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                    {c.paymentTotal > 0
                      ? `₩${c.paymentTotal.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-rose-700">
                    {c.outstanding !== 0
                      ? `₩${c.outstanding.toLocaleString()}`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 제품/사이즈 breakdown */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">
            제품·사이즈별 breakdown
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            COMPLETED 주문의 라인 기준. 수량·금액 desc.
          </p>
        </div>
        {products.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            해당 월에 완료된 출고가 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">제품</th>
                <th className="px-4 py-2 text-left">카테고리</th>
                <th className="px-4 py-2 text-left">사이즈</th>
                <th className="px-4 py-2 text-right">수량</th>
                <th className="px-4 py-2 text-right">금액</th>
                <th className="px-4 py-2 text-right">비중</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr
                  key={`${p.productId}-${p.sizeId}`}
                  className="hover:bg-slate-50"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/products/${p.productId}`}
                      className="text-sky-700 hover:underline font-medium"
                    >
                      {p.productName}
                    </Link>
                    <div className="font-mono text-[10px] text-slate-400">
                      {p.productCode}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {p.category ?? "-"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">
                    {p.sizeCode}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                    {p.qty.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">
                    ₩{p.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                    {totalProductAmount > 0
                      ? `${((p.amount / totalProductAmount) * 100).toFixed(1)}%`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-900">
              <tr>
                <td className="px-4 py-2" colSpan={3}>
                  합계
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {totalQty.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  ₩{totalProductAmount.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "emerald" | "violet" | "rose";
}) {
  const textTone =
    tone === "sky"
      ? "text-sky-700"
      : tone === "emerald"
        ? "text-emerald-700"
        : tone === "violet"
          ? "text-violet-700"
          : "text-rose-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${textTone}`}>{value}</div>
    </div>
  );
}
