import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getProduct, listProductCategories } from "@/lib/actions/product";
import { ProductForm } from "@/components/admin/products/ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const [product, categories] = await Promise.all([
    getProduct(params.id),
    listProductCategories(),
  ]);
  if (!product) notFound();

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">제품 편집</h1>
        <p className="text-sm text-slate-500 mt-1 font-mono">{product.code}</p>
      </header>
      <ProductForm
        mode="edit"
        categories={categories}
        initial={{
          id: product.id,
          code: product.code,
          name: product.name,
          brand: product.brand ?? undefined,
          category: product.category ?? undefined,
          part: product.part ?? undefined,
          basePrice: product.basePrice.toString(),
          expiryMonths: product.expiryMonths ?? undefined,
          active: product.active,
        }}
      />
    </div>
  );
}
