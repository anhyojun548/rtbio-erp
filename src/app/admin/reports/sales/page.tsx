/**
 * 담당자별 매출 (Phase 3F-2, R15).
 *
 * - 월 선택기 (?month=YYYY-MM, default=현재)
 * - 담당자별 매출/입금/미수금/주문수 테이블
 * - 담당자 이름 클릭 → 상세 breakdown 페이지
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listSalesPerformanceByMonth } from "@/lib/actions/sales-performance";
import { MonthPicker } from "@/components/admin/reports/MonthPicker";

type SearchParams = { month?: string };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const ROLE_LABEL: Record<string, string> = {
  TENANT_OWNER: "대표",
  ADMIN: "경영지원",
  EXEC: "영업",
};

export default async function SalesPerformancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const month =
    searchParams.month && MONTH_RE.test(searchParams.month)
      ? searchParams.month
      : defaultMonth();

  const rows = await listSalesPerformanceByMonth(month);

  const totals = rows.reduce(
    (acc, r) => {
      acc.clients += r.clientCount;
      acc.orders += r.orderCount;
      acc.sales += r.salesTotal;
      acc.payment += r.paymentTotal;
      acc.outstanding += r.outstanding;
      return acc;
    },
    { clients: 0, orders: 0, sales: 0, payment: 0, outstanding: 0 },
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display m-0"> 담당자별 매출</h1>
          <p className="text-caption text-ink-secondary mt-1"> {month} 기준 · 담당 거래처의 매출(ISSUED+SENT) / 입금(PARTIAL+PAID)
            / 미수금(원장 balance) 집계.
          </p>
        </div>
        <MonthPicker month={month} basePath="/admin/reports/sales" />
      </header> {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"> 해당 월에 담당 거래처를 보유한 담당자가 없습니다.
        </div> ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">담당자</th>
                <th className="px-4 py-2 text-left">롤</th>
                <th className="px-4 py-2 text-right">거래처</th>
                <th className="px-4 py-2 text-right">주문</th>
                <th className="px-4 py-2 text-right">매출</th>
                <th className="px-4 py-2 text-right">입금</th>
                <th className="px-4 py-2 text-right">미수금</th>
                <th className="px-4 py-2 text-center">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100"> {rows.map((r, i) => (
                <tr key={r.salesRepId} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <span className="w-4 inline-block text-slate-400 tabular-nums text-xs mr-2"> {i + 1}.
                    </span>
                    <Link
                      href={`/admin/reports/sales/${r.salesRepId}?month=${month}`}
                      className="font-medium text-sky-700 hover:underline"
                    > {r.name}
                    </Link>
                    <div className="text-[10px] text-slate-400 ml-6"> {r.email}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-block rounded bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5"> {ROLE_LABEL[r.role] ?? r.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700"> {r.clientCount}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700"> {r.orderCount}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900"> {r.salesTotal > 0
                      ? `₩${r.salesTotal.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700"> {r.paymentTotal > 0
                      ? `₩${r.paymentTotal.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-rose-700"> {r.outstanding !== 0
                      ? `₩${r.outstanding.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Link
                      href={`/admin/reports/sales/${r.salesRepId}?month=${month}`}
                      className="text-xs text-sky-700 hover:underline"
                    > →
                    </Link>
                  </td>
                </tr> ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-900">
              <tr>
                <td className="px-4 py-2" colSpan={2}> 합계
                </td>
                <td className="px-4 py-2 text-right tabular-nums"> {totals.clients}
                </td>
                <td className="px-4 py-2 text-right tabular-nums"> {totals.orders}
                </td>
                <td className="px-4 py-2 text-right tabular-nums"> ₩{totals.sales.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-700"> ₩{totals.payment.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-rose-700"> ₩{totals.outstanding.toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div> )}
    </div> );
}
