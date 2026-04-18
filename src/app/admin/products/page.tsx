/**
 * 제품 관리 목록 (Phase 3B).
 * ?q=SF&category=관절&active=ACTIVE
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listProducts, listProductCategories } from "@/lib/actions/product";
import { ProductListFilter } from "@/components/admin/products/ListFilter";
import { ToggleActiveButton } from "@/components/admin/products/ToggleActiveButton";

type SearchParams = {
  q?: string;
  category?: string;
  active?: string;
};

export default async function ProductListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const active =
    searchParams.active === "ACTIVE" || searchParams.active === "INACTIVE"
      ? searchParams.active
      : ("ALL" as const);
  const category = searchParams.category?.trim() || "ALL";

  const [products, categories] = await Promise.all([
    listProducts({ q: searchParams.q, category, active }),
    listProductCategories(),
  ]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">제품 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            제품 정보, 사이즈별 재고, 유통기한을 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 transition"
        >
          + 신규 제품
        </Link>
      </header>

      <ProductListFilter
        defaultValues={{ q: searchParams.q ?? "", category, active }}
        categories={categories}
      />

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium">코드</th>
              <th className="px-4 py-3 text-left font-medium">제품명</th>
              <th className="px-4 py-3 text-left font-medium">브랜드</th>
              <th className="px-4 py-3 text-left font-medium">카테고리</th>
              <th className="px-4 py-3 text-right font-medium">기준단가</th>
              <th className="px-4 py-3 text-right font-medium">사이즈</th>
              <th className="px-4 py-3 text-right font-medium">실재고</th>
              <th className="px-4 py-3 text-center font-medium">상태</th>
              <th className="px-4 py-3 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-400">
                  조건에 맞는 제품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const totalPhysical = p.sizes.reduce(
                  (sum, s) => sum + s.physicalStock,
                  0,
                );
                return (
                  <tr
                    key={p.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {p.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="hover:text-sky-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.brand ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.category ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {Number(p.basePrice).toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {p._count.sizes}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {totalPhysical.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                          활성
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs font-medium">
                          비활성
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className="text-xs text-slate-600 hover:text-sky-700"
                        >
                          편집
                        </Link>
                        <ToggleActiveButton id={p.id} active={p.active} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">총 {products.length}건</p>
    </div>
  );
}
