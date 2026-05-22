/**
 * 내 주문 — Phase 3F-1.
 *
 * EXEC 롤: 본인 배정 거래처의 주문만.
 * ?q=ORD&status=CONFIRMED&from=2026-04-01&to=2026-04-30
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listMyOrders } from "@/lib/actions/exec";
import type { OrderStatus } from "@prisma/client";
import { MyOrdersTable } from "@/components/exec/MyOrdersTable";

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

type SearchParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
};

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");

  const statusParam = searchParams.status?.trim() ?? "";
  const status: OrderStatus | "ALL" = ALL_STATUSES.includes(
    statusParam as OrderStatus,
  )
    ? (statusParam as OrderStatus)
    : "ALL";
  const from = searchParams.from ? new Date(searchParams.from) : undefined;
  const to = searchParams.to ? new Date(searchParams.to) : undefined;

  const orders = await listMyOrders({
    q: searchParams.q,
    status,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  });

  const rows = orders.map((o) => ({
    ...o,
    orderDate: o.orderDate.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display m-0">📦 내 주문</h1>
          <p className="text-caption text-ink-secondary mt-1">
            {user.name}님에게 배정된 거래처의 주문{" "}
            <strong className="text-primary">{rows.length}건</strong>입니다.
          </p>
        </div>
        <Link
          href="/exec"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          ← 대시보드
        </Link>
      </header>

      <MyOrdersTable
        rows={rows}
        defaultValues={{
          q: searchParams.q ?? "",
          status,
          from: searchParams.from ?? "",
          to: searchParams.to ?? "",
        }}
      />
    </div>
  );
}
