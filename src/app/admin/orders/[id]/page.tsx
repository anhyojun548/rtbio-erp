/**
 * 주문 상세 (Phase 3D-2a — DRAFT 단계).
 * - DRAFT: 라인/헤더/배송지 자유 편집
 * - DRAFT 외: 읽기 전용 (상태 전환은 3D-2b 에서 추가)
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getOrder } from "@/lib/actions/order";
import { getClient } from "@/lib/actions/client";
import { getInvoiceByOrderId } from "@/lib/actions/invoice";
import type { OrderStatus, ClientType } from "@prisma/client";
import { ItemsPanel } from "@/components/admin/orders/ItemsPanel";
import { HeaderEditForm } from "@/components/admin/orders/HeaderEditForm";
import { DeleteOrderButton } from "@/components/admin/orders/DeleteOrderButton";
import { StatusActions } from "@/components/admin/orders/StatusActions";
import { IssueInvoiceButton } from "@/components/admin/orders/IssueInvoiceButton";

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
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-sky-100 text-sky-800",
  CONFIRMED: "bg-indigo-100 text-indigo-800",
  HOLD: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  SHIPPING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  AGENCY: "대리점",
  HOSPITAL: "병원",
  PHARMACY: "약국",
  OTHER: "기타",
};

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  const order = await getOrder(params.id);
  if (!order) notFound();

  // 거래처의 활성 배송지 목록 (편집 시 선택용)
  const clientDetail = await getClient(order.clientId);
  const addresses =
    clientDetail?.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      recipientName: a.recipientName,
      phone: a.phone,
      postalCode: a.postalCode,
      address: a.address,
      addressDetail: a.addressDetail,
      memo: a.memo,
      isDefault: a.isDefault,
    })) ?? [];

  const linesPlain = order.items.map((l) => ({
    id: l.id,
    quantity: l.quantity,
    unitPrice: l.unitPrice.toString(),
    basePriceAtOrder: l.basePriceAtOrder.toString(),
    discountRateAtOrder: l.discountRateAtOrder
      ? l.discountRateAtOrder.toString()
      : null,
    fixedPriceAppliedAtOrder: l.fixedPriceAppliedAtOrder,
    lineTotal: l.lineTotal.toString(),
    product: {
      id: l.product.id,
      code: l.product.code,
      name: l.product.name,
      category: l.product.category,
    },
    productSize: { id: l.productSize.id, sizeCode: l.productSize.sizeCode },
  }));

  const editable = order.status === "DRAFT";
  const grandTotal = order.items.reduce(
    (s, l) => s + Number(l.lineTotal),
    0,
  );

  // COMPLETED 주문만 거래명세서 발급 대상.
  const existingInvoice =
    order.status === "COMPLETED" ? await getInvoiceByOrderId(order.id) : null;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display m-0 font-mono">
              {order.orderNumber}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[order.status]}`}
            >
              {STATUS_LABEL[order.status]}
            </span>
          </div>
          <p className="text-caption text-ink-secondary mt-1">
            주문일 {new Date(order.orderDate).toLocaleDateString("ko-KR")}
            {order.requestedDate &&
              ` · 희망배송일 ${new Date(order.requestedDate).toLocaleDateString("ko-KR")}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/orders"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            목록
          </Link>
          {editable && (
            <DeleteOrderButton
              orderId={order.id}
              orderNumber={order.orderNumber}
            />
          )}
        </div>
      </header>

      {/* REJECT / HOLD 사유 뱃지 */}
      {order.status === "REJECTED" && order.rejectedReason && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold text-red-800 mb-1">
            반려 사유
            {order.rejectedAt &&
              ` · ${new Date(order.rejectedAt).toLocaleString("ko-KR")}`}
          </p>
          <p className="text-sm text-red-900 whitespace-pre-wrap">
            {order.rejectedReason}
          </p>
        </div>
      )}
      {order.status === "HOLD" && order.heldReason && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-1">
            보류 사유
            {order.heldAt &&
              ` · ${new Date(order.heldAt).toLocaleString("ko-KR")}`}
          </p>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">
            {order.heldReason}
          </p>
        </div>
      )}
      {order.status === "SHIPPING" && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-blue-900">
            <strong>출고 진행중.</strong> 칸반 보드에서 단계를 이동하세요. 마지막
            단계 도달 시 실재고가 차감됩니다.
          </div>
          <Link
            href="/admin/shipments"
            className="rounded-md bg-blue-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-700"
          >
            칸반 보드 →
          </Link>
        </div>
      )}
      {order.status === "COMPLETED" && order.completedAt && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-900">
            <strong>출고 완료.</strong>{" "}
            {new Date(order.completedAt).toLocaleString("ko-KR")} 에 terminal
            단계에 도달해 실재고가 차감되었습니다.
          </p>
        </div>
      )}

      {order.status === "COMPLETED" && (
        <IssueInvoiceButton
          orderId={order.id}
          existingInvoice={
            existingInvoice
              ? {
                  id: existingInvoice.id,
                  invoiceNumber: existingInvoice.invoiceNumber,
                  status: existingInvoice.status,
                }
              : null
          }
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 좌 — 거래처 / 요약 */}
        <section className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-900 mb-2">거래처</h2>
          <InfoRow
            label="업체"
            value={
              <span>
                <Link
                  href={`/admin/clients/${order.client.id}`}
                  className="text-sky-700 hover:underline"
                >
                  {order.client.name}
                </Link>{" "}
                <span className="font-mono text-xs text-slate-500">
                  ({order.client.code})
                </span>
              </span>
            }
          />
          <InfoRow label="유형" value={CLIENT_TYPE_LABEL[order.client.type]} />
          <InfoRow label="대표자" value={order.client.representative} />
          <InfoRow label="연락처" value={order.client.phone} />

          <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
            <h3 className="font-semibold text-slate-900 text-sm">요약</h3>
            <InfoRow
              label="라인 수"
              value={`${order.items.length}건`}
            />
            <InfoRow
              label="합계"
              value={`${grandTotal.toLocaleString()}원`}
            />
            <InfoRow
              label="등록일"
              value={new Date(order.createdAt).toLocaleString("ko-KR")}
            />
            {order.updatedAt && (
              <InfoRow
                label="수정일"
                value={new Date(order.updatedAt).toLocaleString("ko-KR")}
              />
            )}
          </div>
        </section>

        {/* 우 — 헤더/배송지 편집 */}
        <section className="lg:col-span-3">
          <HeaderEditForm
            orderId={order.id}
            editable={editable}
            addresses={addresses}
            initial={{
              orderDate: order.orderDate.toString(),
              requestedDate: order.requestedDate
                ? order.requestedDate.toString()
                : null,
              note: order.note,
              shipToAddressId: order.shipToAddressId,
              shipToLabel: order.shipToLabel,
              shipToRecipient: order.shipToRecipient,
              shipToPhone: order.shipToPhone,
              shipToPostalCode: order.shipToPostalCode,
              shipToAddress: order.shipToAddress,
              shipToAddressDetail: order.shipToAddressDetail,
              shipToMemo: order.shipToMemo,
              shipMethod: order.shipMethod,
            }}
          />
        </section>
      </div>

      {/* 라인 */}
      <ItemsPanel
        orderId={order.id}
        clientId={order.clientId}
        editable={editable}
        initialLines={linesPlain}
      />

      {/* 상태 전이 */}
      <StatusActions
        orderId={order.id}
        status={order.status}
        itemCount={order.items.length}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex">
      <span className="w-20 text-xs text-slate-500">{label}</span>
      <span className="flex-1 text-sm text-slate-800">{value ?? "-"}</span>
    </div>
  );
}
