import { requireRole } from "@/lib/session";
import { listProductCategories } from "@/lib/actions/product";
import { ProductForm } from "@/components/admin/products/ProductForm";

export default async function NewProductPage() {
  await requireRole("TENANT_OWNER", "ADMIN");
  const categories = await listProductCategories();
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">신규 제품 등록</h1>
        <p className="text-sm text-slate-500 mt-1">
          기본 정보 등록 후 상세 페이지에서 사이즈와 초기 재고를 추가합니다.
        </p>
      </header>
      <ProductForm mode="create" categories={categories} />
    </div>
  );
}
