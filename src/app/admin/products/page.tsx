/**
 * 제품 관리 목록 (Phase 3B → 2026-05-22 UI 재작성)
 * ?q=SF&category=관절&active=ACTIVE
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listProducts, listProductCategories } from "@/lib/actions/product";
import { ProductListFilter } from "@/components/admin/products/ListFilter";
import { ToggleActiveButton } from "@/components/admin/products/ToggleActiveButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/shared/Button";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";

type SearchParams = {
  q?: string;
  category?: string;
  active?: string;
};

type ProductRow = Awaited<ReturnType<typeof listProducts>>[number];

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

  const columns: ColumnDef<ProductRow>[] = [
    {
      key: "code",
      label: "코드",
      width: "110px",
      cellClassName: "font-mono text-tiny text-ink-secondary",
    },
    {
      key: "name",
      label: "제품명",
      render: (p) => (
        <Link href={`/admin/products/${p.id}`} className="font-semibold text-ink hover:text-primary hover:underline"> {p.name}
        </Link> ),
    },
    {
      key: "brand",
      label: "브랜드",
      hideOnMobile: true,
      render: (p) => p.brand ?? "—",
    },
    {
      key: "category",
      label: "카테고리",
      width: "100px",
      render: (p) => p.category ?? "—",
    },
    {
      key: "basePrice",
      label: "기준단가",
      align: "right",
      cellClassName: "tabular-nums font-semibold",
      render: (p) => `${Number(p.basePrice).toLocaleString()}원`,
    },
    {
      key: "sizes",
      label: "사이즈",
      align: "right",
      width: "70px",
      cellClassName: "tabular-nums",
      render: (p) => p._count.sizes,
    },
    {
      key: "physical",
      label: "실재고",
      align: "right",
      width: "90px",
      cellClassName: "tabular-nums",
      render: (p) => {
        const total = p.sizes.reduce((s, x) => s + x.physicalStock, 0);
        return total.toLocaleString();
      },
    },
    {
      key: "active",
      label: "상태",
      align: "center",
      width: "80px",
      render: (p) => p.active ? (
          <span className="inline-flex items-center rounded-full bg-success-light text-success px-2 py-0.5 text-tiny font-semibold"> 활성
          </span> ) : (
          <span className="inline-flex items-center rounded-full bg-canvas text-ink-muted px-2 py-0.5 text-tiny font-semibold"> 비활성
          </span> ),
    },
    {
      key: "actions",
      label: "액션",
      align: "right",
      width: "120px",
      render: (p) => (
        <div className="inline-flex gap-2 items-center">
          <Link href={`/admin/products/${p.id}/edit`} className="text-tiny text-ink-secondary hover:text-primary hover:underline"> 편집
          </Link>
          <ToggleActiveButton id={p.id} active={p.active} />
        </div> ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="제품 관리"
        subtitle="제품 정보, 사이즈별 재고, 유통기한을 관리합니다."
        actions={
          <Button href="/admin/products/new" variant="primary"> + 신규 제품
          </Button> }
      />

      <ProductListFilter
        defaultValues={{ q: searchParams.q ?? "", category, active }}
        categories={categories}
      />

      <DataTable
        columns={columns}
        rows={products}
        keyField="id"
        emptyMessage="조건에 맞는 제품이 없습니다."
      />

      <p className="text-tiny text-ink-muted">총 {products.length}건</p>
    </div> );
}
