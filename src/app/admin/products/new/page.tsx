import { requireRole } from "@/lib/session";
import { listProductCategories } from "@/lib/actions/product";
import { ProductForm } from "@/components/admin/products/ProductForm";

export default async function NewProductPage() {
  await requireRole("TENANT_OWNER", "ADMIN");
  const categories = await listProductCategories();
  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-display m-0">신규 제품 등록</h1>
        <p className="text-caption text-ink-secondary mt-1">
          기본 정보 등록 후 상세 페이지에서 사이즈와 초기 재고를 추가합니다.
        </p>
      </header>
      <ProductForm mode="create" categories={categories} />
    </div>
  );
}
