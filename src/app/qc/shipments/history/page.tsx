/**
 * QC 출고 내역 — /admin/shipments/history 와 동일. QC 레이아웃.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listShipmentHistory } from "@/lib/actions/shipment";
import { listClients } from "@/lib/actions/client";
import { ShipmentHistoryBoard } from "@/components/admin/shipments/ShipmentHistoryBoard";

type SearchParams = {
  clientId?: string;
  from?: string;
  to?: string;
  q?: string;
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

export default async function QcShipmentHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const from = parseDate(searchParams.from);
  const to = parseDate(searchParams.to, true);
  const clientId = searchParams.clientId || undefined;
  const q = searchParams.q?.trim() || undefined;

  const [shipments, clients] = await Promise.all([
    listShipmentHistory({ clientId, from, to, q, limit: 500 }),
    listClients({ active: "ACTIVE" }),
  ]);

  const rows = shipments.map((s) => {
    const itemCount = s.order.items.reduce((sum, it) => sum + it.quantity, 0);
    const total = s.order.items.reduce(
      (sum, it) => sum + Number(it.lineTotal ?? 0),
      0,
    );
    const firstItem = s.order.items[0];
    const firstLabel = firstItem
      ? `${firstItem.product.name}${firstItem.productSize?.sizeCode ? `/${firstItem.productSize.sizeCode}` : ""}`
      : "";
    const summary =
      s.order.items.length > 1
        ? `${firstLabel} 외 ${s.order.items.length - 1}건`
        : firstLabel;
    return {
      id: s.id,
      completedAt: s.completedAt?.toISOString() ?? null,
      orderId: s.order.id,
      orderNumber: s.order.orderNumber,
      orderDate: s.order.orderDate.toISOString(),
      clientCode: s.order.client.code,
      clientName: s.order.client.name,
      shipToRecipient: s.order.shipToRecipient,
      shipToAddress: s.order.shipToAddress,
      itemCount,
      itemSummary: summary,
      totalAmount: total,
    };
  });

  const totalSum = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalQty = rows.reduce((s, r) => s + r.itemCount, 0);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  const csvQs = new URLSearchParams();
  if (clientId) csvQs.set("clientId", clientId);
  if (searchParams.from) csvQs.set("from", searchParams.from);
  if (searchParams.to) csvQs.set("to", searchParams.to);
  if (q) csvQs.set("q", q);
  const csvHref = `/admin/shipments/history/csv${csvQs.toString() ? `?${csvQs.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display m-0"> 출고내역</h1>
          <p className="text-caption text-ink-secondary mt-1"> 완료된 출고(실재고 차감 이후) 목록입니다 (R17).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/qc/shipments"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          > ← 칸반 보드
          </Link>
          <a
            href={csvHref}
            className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700"
          > CSV
          </a>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="건수" value={`${rows.length.toLocaleString()} 건`} />
        <StatCard label="총 수량" value={`${totalQty.toLocaleString()} 개`} />
        <StatCard
          label="총 금액"
          value={`${totalSum.toLocaleString()} 원`}
          highlight
        />
      </section>

      <ShipmentHistoryBoard
        rows={rows}
        clients={clientOptions}
        selected={{
          clientId: clientId ?? "",
          from: searchParams.from ?? "",
          to: searchParams.to ?? "",
          q: q ?? "",
        }}
      />
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
