/**
 * 제품 상세 (Phase 3B).
 * 좌: 기본정보, 우: 사이즈 CRUD (inline SizesPanel).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getProduct } from "@/lib/actions/product";
import { listExpiryLots } from "@/lib/actions/expiry";
import { SizesPanel } from "@/components/admin/products/SizesPanel";
import { LotsPanel } from "@/components/admin/products/LotsPanel";

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const product = await getProduct(params.id);
  if (!product) notFound();

  const lots = await listExpiryLots({
    productId: product.id,
    includeEmpty: true,
    limit: 500,
  });

  const sizesPlain = product.sizes.map((s) => ({
    id: s.id,
    sizeCode: s.sizeCode,
    physicalStock: s.physicalStock,
    availableStock: s.availableStock,
    reorderPoint: s.reorderPoint,
  }));

  const sizesForLots = product.sizes.map((s) => ({
    id: s.id,
    sizeCode: s.sizeCode,
  }));

  const lotsPlain = lots.map((l) => ({
    id: l.id,
    productSizeId: l.productSizeId,
    lotNumber: l.lotNumber,
    expiryDate: l.expiryDate.toISOString(),
    quantity: l.quantity,
    remainingQty: l.remainingQty,
    note: l.note,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
            {!product.active && (
              <span className="rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 text-xs">
                비활성
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 font-mono">{product.code}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/products"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            목록
          </Link>
          <Link
            href={`/admin/products/${product.id}/edit`}
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
          <InfoRow label="브랜드" value={product.brand} />
          <InfoRow label="카테고리" value={product.category} />
          <InfoRow label="부위" value={product.part} />
          <InfoRow
            label="기준단가"
            value={`${Number(product.basePrice).toLocaleString()}원`}
          />
          <InfoRow
            label="유통기한"
            value={product.expiryMonths ? `${product.expiryMonths}개월` : null}
          />
          <InfoRow
            label="등록일"
            value={new Date(product.createdAt).toLocaleDateString("ko-KR")}
          />
        </section>

        {/* 사이즈 관리 */}
        <section className="lg:col-span-3">
          <SizesPanel productId={product.id} initialSizes={sizesPlain} />
        </section>
      </div>

      {/* 유통기한 로트 (R19) */}
      <LotsPanel sizes={sizesForLots} initialLots={lotsPlain} />
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
