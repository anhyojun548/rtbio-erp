/**
 * 거래처 포털 — 거래명세서 상세 (읽기 전용).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyInvoice } from "@/lib/actions/client-portal";

export default async function ClientInvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const inv = await getMyInvoice(params.id);
  if (!inv) notFound();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/client/invoices" className="text-caption text-primary hover:underline"> ← 거래명세서 목록
        </Link>
        <Link
          href={`/client/invoices/${inv.id}/pdf`}
          target="_blank"
          className="h-9 px-4 inline-flex items-center bg-success text-white text-caption font-semibold rounded-xs hover:bg-success/90 transition"
        > PDF 다운로드
        </Link>
      </div>

      <header>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-display m-0 font-mono"> {inv.invoiceNumber}
          </h1>
          <InvoiceStatusBadge status={inv.status} />
        </div>
        <p className="text-sm text-slate-500 mt-1"> 발행일 {new Date(inv.issueDate).toLocaleDateString("ko-KR")}
          {inv.dueDate && (
            <> {" "}
              · 만기일 {new Date(inv.dueDate).toLocaleDateString("ko-KR")}
            </> )}
          {inv.sentAt && (
            <> {" "}
              · 전송일 {new Date(inv.sentAt).toLocaleDateString("ko-KR")}
            </> )}
        </p>
      </header> {inv.order && (
        <section className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm flex items-center justify-between">
          <span className="text-slate-600">연결된 발주</span>
          <Link
            href={`/client/orders/${inv.order.id}`}
            className="font-mono text-sky-700 hover:underline"
          > {inv.order.orderNumber}
          </Link>
        </section> )}

      <section className="grid grid-cols-2 gap-4">
        <InfoCard title="공급자">
          <dl className="space-y-1 text-sm">
            <Row k="상호" v="알티바이오" />
            <Row k="대표자" v="김대표" />
            <Row k="사업자번호" v="000-00-00000" />
            <Row k="주소" v="서울특별시 강남구 테헤란로 123" />
          </dl>
        </InfoCard>
        <InfoCard title="공급받는 자">
          <dl className="space-y-1 text-sm">
            <Row k="거래처" v={inv.client.name} />
            <Row k="대표자" v={inv.client.representative ?? "-"} />
            <Row
              k="사업자번호"
              v={inv.client.businessNumber ?? "-"}
            />
            <Row k="주소" v={inv.client.address ?? "-"} />
          </dl>
        </InfoCard>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-sm"> 품목 · {inv.items.length}건
          </h2>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">품명</th>
              <th className="px-4 py-2 text-right">수량</th>
              <th className="px-4 py-2 text-right">단가</th>
              <th className="px-4 py-2 text-right">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100"> {inv.items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-2">{it.description}</td>
                <td className="px-4 py-2 text-right tabular-nums"> {it.quantity}
                </td>
                <td className="px-4 py-2 text-right tabular-nums"> {Number(it.unitPrice).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold"> {Number(it.amount).toLocaleString()}
                </td>
              </tr> ))}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">공급가액</span>
            <span className="tabular-nums"> {Number(inv.supplyAmount).toLocaleString()} 원
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">부가세 (VAT)</span>
            <span className="tabular-nums"> {Number(inv.vatAmount).toLocaleString()} 원
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
            <span>합계</span>
            <span className="tabular-nums text-emerald-700"> {Number(inv.totalAmount).toLocaleString()} 원
            </span>
          </div>
        </div>
      </section> {inv.note && (
        <section className="rounded-md border border-slate-200 bg-white p-4 text-sm">
          <p className="text-xs text-slate-500 mb-1">비고</p>
          <p className="whitespace-pre-wrap text-slate-700">{inv.note}</p>
        </section> )}
    </div> );
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
      <h2 className="text-sm font-semibold text-slate-900 mb-3">{title}</h2> {children}
    </div> );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex">
      <dt className="w-24 text-slate-500 text-xs">{k}</dt>
      <dd className="flex-1 text-slate-800">{v}</dd>
    </div> );
}

const INVOICE_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-sky-100 text-sky-800",
  SENT: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};
const INVOICE_LABEL: Record<string, string> = {
  DRAFT: "임시",
  ISSUED: "발행",
  SENT: "전송",
  CANCELLED: "취소",
};

function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
        INVOICE_TONE[status] ?? "bg-slate-100 text-slate-700"
      }`}
    > {INVOICE_LABEL[status] ?? status}
    </span> );
}
