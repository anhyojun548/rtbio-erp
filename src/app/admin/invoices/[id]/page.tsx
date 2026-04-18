/**
 * 거래명세서 상세 — Phase 3D-3a.
 *
 * 상태별 액션:
 *   DRAFT     → "발행" (issueInvoice), "취소" (cancelInvoice), PDF 미리보기
 *   ISSUED    → "발송완료 표시" (markInvoiceSent), "취소", PDF
 *   SENT      → "취소", PDF
 *   CANCELLED → PDF 만 (감사 열람 목적)
 *
 * 라인/금액은 주문 스냅샷이므로 편집 불가.
 * DRAFT 한정 issueDate/dueDate/note 편집은 별도 폼 제공.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getInvoice } from "@/lib/actions/invoice";
import type { InvoiceStatus } from "@prisma/client";
import { InvoiceStatusActions } from "@/components/admin/invoices/InvoiceStatusActions";
import { InvoiceDraftEditForm } from "@/components/admin/invoices/InvoiceDraftEditForm";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "DRAFT",
  ISSUED: "발행",
  SENT: "발송완료",
  CANCELLED: "취소",
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-indigo-100 text-indigo-800",
  SENT: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const inv = await getInvoice(params.id);
  if (!inv) notFound();

  const isDraft = inv.status === "DRAFT";
  const displayNumber = isDraft ? "(DRAFT)" : inv.invoiceNumber;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">
              {displayNumber}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[inv.status]}`}
            >
              {STATUS_LABEL[inv.status]}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            발행일 {new Date(inv.issueDate).toLocaleDateString("ko-KR")}
            {inv.dueDate &&
              ` · 지급기한 ${new Date(inv.dueDate).toLocaleDateString("ko-KR")}`}
            {inv.sentAt &&
              ` · 발송 ${new Date(inv.sentAt).toLocaleString("ko-KR")}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/invoices"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            목록
          </Link>
          <a
            href={`/admin/invoices/${inv.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm font-medium hover:bg-slate-800"
          >
            📄 PDF 미리보기
          </a>
        </div>
      </header>

      {inv.status === "CANCELLED" && (
        <div className="rounded-md border border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-700">
            <strong>취소된 거래명세서입니다.</strong> 비고에 사유가 기록되어 있습니다.
            PDF 출력은 감사 목적으로 가능합니다.
          </p>
        </div>
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
                  href={`/admin/clients/${inv.client.id}`}
                  className="text-sky-700 hover:underline"
                >
                  {inv.client.name}
                </Link>{" "}
                <span className="font-mono text-xs text-slate-500">
                  ({inv.client.code})
                </span>
              </span>
            }
          />
          <InfoRow label="사업자" value={inv.client.businessNumber ?? "-"} />
          <InfoRow label="대표자" value={inv.client.representative ?? "-"} />
          <InfoRow label="연락처" value={inv.client.phone ?? "-"} />
          <InfoRow label="주소" value={inv.client.address ?? "-"} />

          <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
            <h3 className="font-semibold text-slate-900 text-sm">연결 주문</h3>
            {inv.order ? (
              <InfoRow
                label="주문번호"
                value={
                  <Link
                    href={`/admin/orders/${inv.order.id}`}
                    className="font-mono text-xs text-sky-700 hover:underline"
                  >
                    {inv.order.orderNumber}
                  </Link>
                }
              />
            ) : (
              <InfoRow label="주문번호" value="(삭제됨)" />
            )}
            {inv.order && (
              <InfoRow
                label="주문일"
                value={new Date(inv.order.orderDate).toLocaleDateString(
                  "ko-KR",
                )}
              />
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
            <h3 className="font-semibold text-slate-900 text-sm">요약</h3>
            <InfoRow label="라인 수" value={`${inv.items.length}건`} />
            <InfoRow
              label="공급가액"
              value={`${Number(inv.supplyAmount).toLocaleString("ko-KR")}원`}
            />
            <InfoRow
              label="부가세"
              value={`${Number(inv.vatAmount).toLocaleString("ko-KR")}원`}
            />
            <InfoRow
              label="합계"
              value={
                <strong>
                  {Number(inv.totalAmount).toLocaleString("ko-KR")}원
                </strong>
              }
            />
          </div>
        </section>

        {/* 우 — DRAFT 편집 또는 비고 표시 */}
        <section className="lg:col-span-3 space-y-4">
          {isDraft ? (
            <InvoiceDraftEditForm
              invoiceId={inv.id}
              initial={{
                issueDate: inv.issueDate.toISOString().slice(0, 10),
                dueDate: inv.dueDate
                  ? inv.dueDate.toISOString().slice(0, 10)
                  : "",
                note: inv.note ?? "",
              }}
            />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900 mb-3">비고</h2>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {inv.note ?? "(없음)"}
              </p>
            </div>
          )}

          <InvoiceStatusActions invoiceId={inv.id} status={inv.status} />
        </section>
      </div>

      {/* 라인 */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <header className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">라인 항목</h2>
          <span className="text-xs text-slate-500">
            주문 스냅샷 — 수정 불가
          </span>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2 text-left font-medium w-10">#</th>
              <th className="px-4 py-2 text-left font-medium">품목</th>
              <th className="px-4 py-2 text-right font-medium">수량</th>
              <th className="px-4 py-2 text-right font-medium">단가</th>
              <th className="px-4 py-2 text-right font-medium">금액</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, idx) => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                <td className="px-4 py-2 text-slate-800">{it.description}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {it.quantity.toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {Number(it.unitPrice).toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">
                  {Number(it.amount).toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-600">
                공급가액
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {Number(inv.supplyAmount).toLocaleString("ko-KR")}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-600">
                부가세 (10%)
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {Number(inv.vatAmount).toLocaleString("ko-KR")}
              </td>
            </tr>
            <tr className="bg-slate-900 text-white">
              <td colSpan={4} className="px-4 py-3 text-right font-semibold">
                합계 금액
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-bold">
                {Number(inv.totalAmount).toLocaleString("ko-KR")} 원
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
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
