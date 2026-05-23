/**
 * 발주/출고 목록 (Phase 3D-2a → 2026-05-22 UI 재작성)
 * ?q=ORD&status=DRAFT&from=2026-04-01&to=2026-04-30
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listOrders } from "@/lib/actions/order";
import type { OrderStatus } from "@prisma/client";
import { OrderListFilter } from "@/components/admin/orders/ListFilter";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/shared/Button";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";

type SearchParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
};

const ALL_STATUSES: OrderStatus[] = [
  "DRAFT", "SUBMITTED", "CONFIRMED", "HOLD", "REJECTED",
  "SHIPPING", "COMPLETED", "CANCELLED",
];

type OrderRow = Awaited<ReturnType<typeof listOrders>>[number];

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

  // 우리 StatusBadge 가 인식하는 키로 매핑 (HOLD → HELD)
  const mapStatusForBadge = (s: OrderStatus): string => s === "HOLD" ? "HELD" : s;

  const columns: ColumnDef<OrderRow>[] = [
    {
      key: "orderNumber",
      label: "주문번호",
      width: "180px",
      render: (o) => (
        <Link href={`/admin/orders/${o.id}`} className="font-mono text-tiny text-primary hover:underline font-semibold"> {o.orderNumber}
        </Link> ),
    },
    {
      key: "orderDate",
      label: "주문일",
      width: "110px",
      cellClassName: "tabular-nums text-ink-secondary",
      render: (o) => new Date(o.orderDate).toLocaleDateString("ko-KR"),
    },
    {
      key: "client",
      label: "거래처",
      render: (o) => (
        <>
          <div className="font-semibold text-ink">{o.client.name}</div>
          <div className="font-mono text-tiny text-ink-muted">{o.client.code}</div>
        </> ),
    },
    {
      key: "shipTo",
      label: "배송지",
      hideOnMobile: true,
      render: (o) => (
        <div className="text-tiny text-ink-secondary"> {o.shipToLabel ?? "—"}
          {o.shipToRecipient ? <span className="text-ink-muted"> / {o.shipToRecipient}</span> : null}
        </div> ),
    },
    {
      key: "items",
      label: "라인",
      align: "right",
      width: "60px",
      cellClassName: "tabular-nums",
      render: (o) => o._count.items,
    },
    {
      key: "status",
      label: "상태",
      align: "center",
      width: "90px",
      render: (o) => <StatusBadge status={mapStatusForBadge(o.status)} variant="order" small />,
    },
    {
      key: "actions",
      label: "액션",
      align: "right",
      width: "70px",
      render: (o) => (
        <Link href={`/admin/orders/${o.id}`} className="text-tiny text-primary hover:underline"> 상세
        </Link> ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="발주 / 출고"
        subtitle="주문서를 작성·관리합니다. DRAFT 상태에서만 자유 편집 가능."
        actions={
          <Button href="/admin/orders/new" variant="primary"> + 신규 주문
          </Button> }
      />

      <OrderListFilter
        defaultValues={{
          q: searchParams.q ?? "",
          status,
          from: searchParams.from ?? "",
          to: searchParams.to ?? "",
        }}
      />

      <DataTable
        columns={columns}
        rows={orders}
        keyField="id"
        emptyMessage="조건에 맞는 주문이 없습니다."
      />

      <p className="text-tiny text-ink-muted">총 {orders.length}건</p>
    </div> );
}
