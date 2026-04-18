/**
 * 거래명세서 목록 — Phase 3D-3a.
 * ?q=INV&status=ISSUED&from=2026-04-01&to=2026-04-30
 *
 * DRAFT/ISSUED/SENT/CANCELLED 4가지 상태 뱃지 + 합계 / 주문번호 링크.
 * DRAFT 는 invoiceNumber 가 `DRAFT-INV-...` 형식이므로 별도 표기.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listInvoices } from "@/lib/actions/invoice";
import type { InvoiceStatus } from "@prisma/client";
import { InvoiceListFilter } from "@/components/admin/invoices/InvoiceListFilter";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "DRAFT",
  ISSUED: "발행",
  SENT: "발송완료",
  CANCELLED: "취소",
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ISSUED: "bg-indigo-50 text-indigo-700",
  SENT: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500 line-through",
};

type SearchParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
};

const ALL_STATUSES: InvoiceStatus[] = ["DRAFT", "ISSUED", "SENT", "CANCELLED"];

export default async function InvoiceListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const statusParam = searchParams.status?.trim() ?? "";
  const status: InvoiceStatus | "ALL" = ALL_STATUSES.includes(
    statusParam as InvoiceStatus,
  )
    ? (statusParam as InvoiceStatus)
    : "ALL";
  const from = searchParams.from ? new Date(searchParams.from) : undefined;
  const to = searchParams.to ? new Date(searchParams.to) : undefined;

  const invoices = await listInvoices({
    q: searchParams.q,
    status,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">거래명세서</h1>
        <p className="text-sm text-slate-500 mt-1">
          COMPLETED 주문을 기반으로 DRAFT 거래명세서를 생성한 뒤 발행(ISSUED)합니다.
          발송 완료되면 SENT 로 표시할 수 있습니다.
        </p>
      </header>

      <InvoiceListFilter
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
              <th className="px-4 py-3 text-left font-medium">명세서 번호</th>
              <th className="px-4 py-3 text-left font-medium">발행일</th>
              <th className="px-4 py-3 text-left font-medium">거래처</th>
              <th className="px-4 py-3 text-left font-medium">주문</th>
              <th className="px-4 py-3 text-right font-medium">라인</th>
              <th className="px-4 py-3 text-right font-medium">합계</th>
              <th className="px-4 py-3 text-center font-medium">상태</th>
              <th className="px-4 py-3 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  조건에 맞는 거래명세서가 없습니다.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const isDraft = inv.status === "DRAFT";
                return (
                  <tr
                    key={inv.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="hover:text-sky-700 hover:underline"
                      >
                        {isDraft ? "(DRAFT)" : inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 tabular-nums">
                      {new Date(inv.issueDate).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      <div className="font-medium">{inv.client.name}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {inv.client.code}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {inv.order ? (
                        <Link
                          href={`/admin/orders/${inv.order.id}`}
                          className="hover:text-sky-700 hover:underline"
                        >
                          {inv.order.orderNumber}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {inv._count.items}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {Number(inv.totalAmount).toLocaleString("ko-KR")}원
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[inv.status]}`}
                      >
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="text-xs text-slate-600 hover:text-sky-700"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">총 {invoices.length}건</p>
    </div>
  );
}
