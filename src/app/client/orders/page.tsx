/**
 * 거래처 포털 — 내 발주 목록 (읽기 전용).
 *
 * 필터: 검색어(주문번호/수령인/배송지), 상태, 기간.
 */
import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { listMyOrders } from "@/lib/actions/client-portal";

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
  { value: "OPEN", label: "진행 중" },
  { value: "DRAFT", label: "임시저장" },
  { value: "SUBMITTED", label: "제출" },
  { value: "CONFIRMED", label: "확정" },
  { value: "SHIPPING", label: "출고중" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

export default async function ClientOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = searchParams.q?.trim() || undefined;
  const from = parseDate(searchParams.from);
  const to = parseDate(searchParams.to, true);
  const statusRaw = searchParams.status || "";

  let statusFilter: unknown = undefined;
  if (statusRaw === "OPEN") {
    statusFilter = {
      in: [
        OrderStatus.DRAFT,
        OrderStatus.SUBMITTED,
        OrderStatus.CONFIRMED,
        OrderStatus.SHIPPING,
      ],
    };
  } else if (
    statusRaw &&
    (Object.values(OrderStatus) as string[]).includes(statusRaw)
  ) {
    statusFilter = statusRaw as OrderStatus;
  }

  const rows = await listMyOrders({
    q,
    status: statusFilter as never,
    from,
    to,
    limit: 500,
  });

  const totalQty = rows.reduce((s, r) => s + r.itemCount, 0);
  const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0"> 발주 현황</h1>
        <p className="text-sm text-slate-500 mt-1"> 우리 거래처 이름으로 등록된 모든 발주를 조회합니다.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="건수" value={`${rows.length.toLocaleString()} 건`} />
        <StatCard label="총 수량" value={`${totalQty.toLocaleString()} 개`} />
        <StatCard
          label="총 금액"
          value={`${totalAmount.toLocaleString()} 원`}
          highlight
        />
      </section>

      <form
        action="/client/orders"
        method="GET"
        className="rounded-lg border border-slate-200 bg-white p-3 flex flex-wrap gap-2 items-end"
      >
        <div>
          <label className="text-[11px] text-slate-500">검색</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="주문번호·수령인·배송지"
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
          <label className="text-[11px] text-slate-500">시작일</label>
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ""}
            className="block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500">종료일</label>
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
          href="/client/orders"
          className="rounded-md border border-slate-300 bg-white text-sm px-4 py-1.5 text-slate-700 hover:bg-slate-50"
        > 초기화
        </Link>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden"> {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500"> 조건에 맞는 발주가 없습니다.
          </div> ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">주문번호</th>
                <th className="px-4 py-2 text-left">주문일</th>
                <th className="px-4 py-2 text-left">배송지</th>
                <th className="px-4 py-2 text-left">수령인</th>
                <th className="px-4 py-2 text-right">수량</th>
                <th className="px-4 py-2 text-right">합계</th>
                <th className="px-4 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100"> {rows.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link
                      href={`/client/orders/${o.id}`}
                      className="text-sky-700 hover:underline"
                    > {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600 tabular-nums"> {new Date(o.orderDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600"> {o.shipToLabel ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600"> {o.shipToRecipient ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs"> {o.itemCount}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums"> {o.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={o.status} />
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

const ORDER_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-sky-100 text-sky-800",
  CONFIRMED: "bg-amber-100 text-amber-800",
  SHIPPING: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
  HELD: "bg-rose-100 text-rose-800",
  REJECTED: "bg-rose-100 text-rose-800",
};
const ORDER_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  SUBMITTED: "제출",
  CONFIRMED: "확정",
  SHIPPING: "출고중",
  COMPLETED: "완료",
  CANCELLED: "취소",
  HELD: "보류",
  REJECTED: "반려",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
        ORDER_TONE[status] ?? "bg-slate-100 text-slate-700"
      }`}
    > {ORDER_LABEL[status] ?? status}
    </span> );
}
