/**
 * 거래처 포털 — 발주 상세 (읽기 전용).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyOrder } from "@/lib/actions/client-portal";

export default async function ClientOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await getMyOrder(params.id);
  if (!order) notFound();

  const itemQty = order.items.reduce((s, it) => s + it.quantity, 0);
  const total = order.items.reduce(
    (s, it) => s + Number(it.lineTotal ?? 0),
    0,
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/client/orders" className="text-caption text-primary hover:underline">
          ← 발주 목록
        </Link>
      </div>

      <header className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-display m-0 font-mono">
              {order.orderNumber}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            주문일 {new Date(order.orderDate).toLocaleDateString("ko-KR")}
            {order.requestedDate && (
              <>
                {" "}
                · 희망 배송일{" "}
                {new Date(order.requestedDate).toLocaleDateString("ko-KR")}
              </>
            )}
          </p>
        </div>
      </header>

      {order.heldReason && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          ⏸ 보류 사유: {order.heldReason}
        </div>
      )}
      {order.rejectedReason && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          ❌ 반려 사유: {order.rejectedReason}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4">
        <InfoCard title="배송지">
          <dl className="space-y-1 text-sm">
            <Row
              k="배송지명"
              v={order.shipToLabel ?? "-"}
            />
            <Row
              k="수령인"
              v={order.shipToRecipient ?? "-"}
            />
            <Row k="연락처" v={order.shipToPhone ?? "-"} />
            <Row
              k="주소"
              v={
                order.shipToAddress
                  ? `${order.shipToAddress} ${order.shipToAddressDetail ?? ""}`.trim()
                  : "-"
              }
            />
            {order.shipToMemo && <Row k="배송 메모" v={order.shipToMemo} />}
          </dl>
        </InfoCard>
        <InfoCard title="배송 상태">
          {order.shipments.length === 0 ? (
            <p className="text-sm text-slate-500">
              아직 출고가 시작되지 않았습니다.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {order.shipments.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between border-b border-slate-100 pb-1.5"
                >
                  <span>
                    {s.currentStage?.label ?? s.currentStage?.key ?? "-"}
                    {s.holdReason && (
                      <span className="ml-2 text-rose-700 text-xs">
                        (보류: {s.holdReason})
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {s.completedAt
                      ? `완료 ${new Date(s.completedAt).toLocaleDateString("ko-KR")}`
                      : `진입 ${new Date(s.enteredStageAt).toLocaleDateString("ko-KR")}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InfoCard>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">
            품목 · {order.items.length}건 (총 {itemQty}개)
          </h2>
          <div className="text-sm text-slate-700">
            합계{" "}
            <span className="font-bold tabular-nums">
              {total.toLocaleString()} 원
            </span>
          </div>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">제품</th>
              <th className="px-4 py-2 text-left">사이즈</th>
              <th className="px-4 py-2 text-right">수량</th>
              <th className="px-4 py-2 text-right">단가</th>
              <th className="px-4 py-2 text-right">합계</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">
                    {it.product.name}
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    {it.product.code}
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">
                  {it.productSize.sizeCode}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {it.quantity}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {Number(it.unitPrice).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {Number(it.lineTotal).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {order.invoices.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 text-sm">거래명세서</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {order.invoices
              .filter((i) => i.status !== "DRAFT")
              .map((inv) => (
                <li
                  key={inv.id}
                  className="px-4 py-2 flex items-center justify-between"
                >
                  <div>
                    <Link
                      href={`/client/invoices/${inv.id}`}
                      className="font-mono text-sm text-sky-700 hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <span className="text-xs text-slate-500 ml-3">
                      발행{" "}
                      {new Date(inv.issueDate).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <div className="tabular-nums text-slate-700">
                    {Number(inv.totalAmount).toLocaleString()} 원
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex">
      <dt className="w-24 text-slate-500 text-xs">{k}</dt>
      <dd className="flex-1 text-slate-800">{v}</dd>
    </div>
  );
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
    >
      {ORDER_LABEL[status] ?? status}
    </span>
  );
}
