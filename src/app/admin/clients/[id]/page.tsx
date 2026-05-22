/**
 * 거래처 상세 (Phase 3A).
 * 좌: 기본정보, 우: 배송지 CRUD (inline).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getClient } from "@/lib/actions/client";
import { listProductCategoriesForDiscount } from "@/lib/actions/client-pricing";
import { listContracts } from "@/lib/actions/sales-contract";
import { CONTRACT_STATUS_LABEL } from "@/lib/validators/sales-contract";
import { AddressPanel } from "@/components/admin/clients/AddressPanel";
import { DiscountPanel } from "@/components/admin/clients/DiscountPanel";
import { FixedPricePanel } from "@/components/admin/clients/FixedPricePanel";
import type { ClientType } from "@prisma/client";

const TYPE_LABEL: Record<ClientType, string> = {
  AGENCY: "대리점",
  HOSPITAL: "병원",
  PHARMACY: "약국",
  OTHER: "기타",
};

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const [client, categories, contracts] = await Promise.all([
    getClient(params.id),
    listProductCategoriesForDiscount(),
    listContracts({ clientId: params.id, limit: 50 }),
  ]);
  if (!client) notFound();

  // Decimal → 문자열 직렬화 (Client 컴포넌트 전달용)
  const discounts = client.discounts.map((d) => ({
    id: d.id,
    category: d.category,
    discountRate: d.discountRate.toString(),
  }));
  const fixedPrices = client.fixedPrices.map((f) => ({
    id: f.id,
    productId: f.productId,
    fixedPrice: f.fixedPrice.toString(),
    product: f.product,
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display m-0">{client.name}</h1>
            {!client.active && (
              <span className="rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 text-xs">
                비활성
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 font-mono">{client.code}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/clients"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            목록
          </Link>
          <Link
            href={`/admin/clients/${client.id}/edit`}
            className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700"
          >
            편집
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 기본정보 */}
        <section className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-900 mb-2">기본 정보</h2>
          <InfoRow label="유형" value={TYPE_LABEL[client.type]} />
          <InfoRow label="사업자번호" value={client.businessNumber} />
          <InfoRow label="대표자" value={client.representative} />
          <InfoRow label="연락처" value={client.phone} />
          <InfoRow label="이메일" value={client.email} />
          <InfoRow label="주소" value={client.address} />
          <InfoRow label="우편번호" value={client.postalCode} />
          <InfoRow label="결제조건" value={client.paymentTerms} />
          <InfoRow
            label="등록일"
            value={new Date(client.createdAt).toLocaleDateString("ko-KR")}
          />
        </section>

        {/* 배송지 관리 */}
        <section className="lg:col-span-3">
          <AddressPanel clientId={client.id} initialAddresses={client.addresses} />
        </section>
      </div>

      {/* 가격 규칙 (R02) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DiscountPanel
          clientId={client.id}
          initialDiscounts={discounts}
          knownCategories={categories}
        />
        <FixedPricePanel
          clientId={client.id}
          initialFixedPrices={fixedPrices}
        />
      </div>

      {/* 판매 계약서 (R20) */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">판매 계약서</h2>
          <Link
            href={`/admin/contracts/new?clientId=${client.id}`}
            className="text-xs rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700"
          >
            + 신규 계약
          </Link>
        </div>
        {contracts.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            등록된 계약서가 없습니다.
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">제목</th>
                <th className="px-3 py-2 text-left font-medium">시작일</th>
                <th className="px-3 py-2 text-left font-medium">종료일</th>
                <th className="px-3 py-2 text-left font-medium">상태</th>
                <th className="px-3 py-2 text-left font-medium">서명</th>
                <th className="px-3 py-2 text-right font-medium">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/contracts/${c.id}`}
                      className="text-slate-900 hover:underline font-medium"
                    >
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-slate-600">
                    {c.startDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-slate-600">
                    {c.endDate ? c.endDate.toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-slate-700">
                      {CONTRACT_STATUS_LABEL[c.status]}
                      {c.status === "ENDING_SOON" && c.daysLeft !== null
                        ? ` (${c.daysLeft}일)`
                        : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.signed ? "✓" : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/contracts/${c.id}`}
                      className="text-xs text-sky-700 hover:underline"
                    >
                      상세
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex">
      <span className="w-24 text-xs text-slate-500">{label}</span>
      <span className="flex-1 text-sm text-slate-800">{value ?? "-"}</span>
    </div>
  );
}
