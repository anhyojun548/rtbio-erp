/**
 * 발주/출고 목록 (Phase 3D-2a — DRAFT 단계).
 * ?q=ORD&status=DRAFT&from=2026-04-01&to=2026-04-30
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listOrders } from "@/lib/actions/order";
import type { OrderStatus } from "@prisma/client";
import { OrderListFilter } from "@/components/admin/orders/ListFilter";

const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "DRAFT",
  SUBMITTED: "제출",
  CONFIRMED: "확정",
  HOLD: "보류",
  REJECTED: "반려",
  SHIPPING: "출고중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-sky-50 text-sky-700",
  CONFIRMED: "bg-indigo-50 text-indigo-700",
  HOLD: "bg-amber-50 text-amber-700",
  REJECTED: "bg-red-50 text-red-700",
  SHIPPING: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500 line-through",
};

type SearchParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
};

const ALL_STATUSES: OrderStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "HOLD",
  "REJECTED",
  "SHIPPING",
  "COMPLETED",
  "CANCELLED",
];

export default async function OrderListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const statusParam = searchParams.status?.trim() ?? "";
  const status: OrderStatus | "ALL" =
    ALL_STATUSES.includes(statusParam as OrderStatus)
      ? (statusParam as OrderStatus)
      : "ALL";
  const from = searchParams.from ? new Date(searchParams.from) : undefined;
  const to = searchParams.to ? new Date(searchParams.to) : undefined;

  const orders = await listOrders({
    q: searchParams.q,
    status,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">발주/출고</h1>
          <p className="text-sm text-slate-500 mt-1">
            주문서를 작성·관리합니다. DRAFT 상태에서만 자유 편집 가능.
          </p>
        </div>
        <Link
          href="/admin/orders/new"
          className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 transition"
        >
          + 신규 주문
        </Link>
      </header>

      <OrderListFilter
        defaultValues={{
          q: searchParams.q ?? "",
          status,
          from: searchParams.from ?? "",
          to: searchParams.to ?? "",
        }}
      />

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium">주문번호</th>
              <th className="px-4 py-3 text-left font-medium">주문일</th>
              <th className="px-4 py-3 text-left font-medium">거래처</th>
              <th className="px-4 py-3 text-left font-medium">배송지</th>
              <th className="px-4 py-3 text-right font-medium">라인</th>
              <th className="px-4 py-3 text-center font-medium">상태</th>
              <th className="px-4 py-3 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  조건에 맞는 주문이 없습니다.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="hover:text-sky-700 hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 tabular-nums">
                    {new Date(o.orderDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    <div className="font-medium">{o.client.name}</div>
                    <div className="font-mono text-xs text-slate-500">
                      {o.client.code}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {o.shipToLabel ?? "-"}
                    {o.shipToRecipient ? ` / ${o.shipToRecipient}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {o._count.items}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-xs text-slate-600 hover:text-sky-700"
                    >
                      상세
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">총 {orders.length}건</p>
    </div>
  );
}
