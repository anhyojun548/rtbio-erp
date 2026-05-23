/**
 * 거래명세서 목록 — Phase 3D-3a → 2026-05-22 UI 재작성.
 * ?q=INV&status=ISSUED&from=2026-04-01&to=2026-04-30
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listInvoices } from "@/lib/actions/invoice";
import type { InvoiceStatus } from "@prisma/client";
import { InvoiceListFilter } from "@/components/admin/invoices/InvoiceListFilter";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";

type SearchParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
};

const ALL_STATUSES: InvoiceStatus[] = ["DRAFT", "ISSUED", "SENT", "CANCELLED"];

type InvoiceRow = Awaited<ReturnType<typeof listInvoices>>[number];

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

  const columns: ColumnDef<InvoiceRow>[] = [
    {
      key: "invoiceNumber",
      label: "명세서 번호",
      width: "170px",
      render: (inv) => (
        <Link href={`/admin/invoices/${inv.id}`} className="font-mono text-tiny text-primary hover:underline font-semibold"> {inv.status === "DRAFT" ? "(DRAFT)" : inv.invoiceNumber}
        </Link> ),
    },
    {
      key: "issueDate",
      label: "발행일",
      width: "110px",
      cellClassName: "tabular-nums text-ink-secondary",
      render: (inv) => new Date(inv.issueDate).toLocaleDateString("ko-KR"),
    },
    {
      key: "client",
      label: "거래처",
      render: (inv) => (
        <>
          <div className="font-semibold text-ink">{inv.client.name}</div>
          <div className="font-mono text-tiny text-ink-muted">{inv.client.code}</div>
        </> ),
    },
    {
      key: "order",
      label: "주문",
      width: "160px",
      hideOnMobile: true,
      render: (inv) => inv.order ? (
          <Link href={`/admin/orders/${inv.order.id}`} className="font-mono text-tiny text-primary hover:underline"> {inv.order.orderNumber}
          </Link> ) : "—",
    },
    {
      key: "items",
      label: "라인",
      align: "right",
      width: "60px",
      cellClassName: "tabular-nums",
      render: (inv) => inv._count.items,
    },
    {
      key: "totalAmount",
      label: "합계",
      align: "right",
      width: "130px",
      cellClassName: "tabular-nums font-semibold",
      render: (inv) => `${Number(inv.totalAmount).toLocaleString("ko-KR")}원`,
    },
    {
      key: "status",
      label: "상태",
      align: "center",
      width: "100px",
      render: (inv) => <StatusBadge status={inv.status} variant="invoice" small />,
    },
    {
      key: "actions",
      label: "액션",
      align: "right",
      width: "70px",
      render: (inv) => (
        <Link href={`/admin/invoices/${inv.id}`} className="text-tiny text-primary hover:underline"> 상세
        </Link> ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="거래명세서"
        subtitle="COMPLETED 주문을 기반으로 DRAFT 거래명세서를 생성한 뒤 발행(ISSUED)합니다. 발송 완료되면 SENT 로 표시할 수 있습니다."
      />

      <InvoiceListFilter
        defaultValues={{
          q: searchParams.q ?? "",
          status,
          from: searchParams.from ?? "",
          to: searchParams.to ?? "",
        }}
      />

      <DataTable
        columns={columns}
        rows={invoices}
        keyField="id"
        emptyMessage="조건에 맞는 거래명세서가 없습니다."
      />

      <p className="text-tiny text-ink-muted">총 {invoices.length}건</p>
    </div> );
}
