/**
 * 거래처 포털 — 거래명세서 목록 (ISSUED/SENT/CANCELLED, DRAFT 제외).
 */
import Link from "next/link";
import { listMyInvoices } from "@/lib/actions/client-portal";
import { InvoiceStatus } from "@prisma/client";

type SearchParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function parseDate(s: string | undefined, endOfDay = false): Date | undefined {
  if (!s || !DATE_RE.test(s)) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "전체" },
  { value: "ISSUED", label: "발행" },
  { value: "SENT", label: "전송" },
  { value: "CANCELLED", label: "취소" },
];

export default async function ClientInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = searchParams.q?.trim() || undefined;
  const from = parseDate(searchParams.from);
  const to = parseDate(searchParams.to, true);
  const statusRaw = searchParams.status || "";

  let statusFilter: unknown = undefined;
  if (
    statusRaw &&
    (Object.values(InvoiceStatus) as string[]).includes(statusRaw)
  ) {
    statusFilter = statusRaw as InvoiceStatus;
  }

  const rows = await listMyInvoices({
    q,
    status: statusFilter as never,
    from,
    to,
    limit: 500,
  });

  const totalSupply = rows.reduce((s, r) => s + Number(r.supplyAmount), 0);
  const totalVat = rows.reduce((s, r) => s + Number(r.vatAmount), 0);
  const totalAll = rows.reduce((s, r) => s + Number(r.totalAmount), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0"> 거래명세서</h1>
        <p className="text-sm text-slate-500 mt-1"> 우리 거래처 이름으로 발행된 거래명세서 목록입니다.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-3">
        <StatCard label="건수" value={`${rows.length.toLocaleString()} 건`} />
        <StatCard label="공급가액" value={`${totalSupply.toLocaleString()} 원`} />
        <StatCard label="부가세" value={`${totalVat.toLocaleString()} 원`} />
        <StatCard
          label="총 금액"
          value={`${totalAll.toLocaleString()} 원`}
          highlight
        />
      </section>

      <form
        action="/client/invoices"
        method="GET"
        className="rounded-lg border border-slate-200 bg-white p-3 flex flex-wrap gap-2 items-end"
      >
        <div>
          <label className="text-[11px] text-slate-500">검색</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="명세서번호·주문번호"
            className="block w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500">상태</label>
          <select
            name="status"
            defaultValue={statusRaw}
            className="block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          > {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}> {o.label}
              </option> ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-500">발행일 시작</label>
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ""}
            className="block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500">발행일 종료</label>
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to ?? ""}
            className="block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-sky-600 text-white text-sm px-4 py-1.5 hover:bg-sky-700"
        > 조회
        </button>
        <Link
          href="/client/invoices"
          className="rounded-md border border-slate-300 bg-white text-sm px-4 py-1.5 text-slate-700 hover:bg-slate-50"
        > 초기화
        </Link>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden"> {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500"> 조건에 맞는 거래명세서가 없습니다.
          </div> ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">명세서번호</th>
                <th className="px-4 py-2 text-left">발행일</th>
                <th className="px-4 py-2 text-left">주문</th>
                <th className="px-4 py-2 text-right">공급가액</th>
                <th className="px-4 py-2 text-right">부가세</th>
                <th className="px-4 py-2 text-right">합계</th>
                <th className="px-4 py-2 text-left">상태</th>
                <th className="px-4 py-2 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100"> {rows.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link
                      href={`/client/invoices/${inv.id}`}
                      className="text-sky-700 hover:underline"
                    > {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600 tabular-nums"> {new Date(inv.issueDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-slate-600"> {inv.order?.orderNumber ? (
                      <Link
                        href={`/client/orders/${inv.order.id}`}
                        className="text-sky-700 hover:underline"
                      > {inv.order.orderNumber}
                      </Link> ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums"> {Number(inv.supplyAmount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-slate-600"> {Number(inv.vatAmount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold"> {Number(inv.totalAmount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/client/invoices/${inv.id}/pdf`}
                      className="text-xs text-sky-700 hover:underline"
                      target="_blank"
                    > PDF
                    </Link>
                  </td>
                </tr> ))}
            </tbody>
          </table> )}
      </section>
    </div> );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`text-xl font-bold mt-1 tabular-nums ${
          highlight ? "text-emerald-700" : "text-slate-900"
        }`}
      > {value}
      </p>
    </div> );
}

const INVOICE_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-sky-100 text-sky-800",
  SENT: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};
const INVOICE_LABEL: Record<string, string> = {
  DRAFT: "임시",
  ISSUED: "발행",
  SENT: "전송",
  CANCELLED: "취소",
};

function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
        INVOICE_TONE[status] ?? "bg-slate-100 text-slate-700"
      }`}
    > {INVOICE_LABEL[status] ?? status}
    </span> );
}
