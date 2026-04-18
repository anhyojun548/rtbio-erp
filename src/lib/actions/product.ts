/**
 * 제품 (Product) Server Actions.
 *
 * 주의:
 * - basePrice 는 Prisma Decimal — Number(string) 으로 변환 후 new Prisma.Decimal 로 저장
 * - 가용재고 음수는 validator 에서 차단 (DB 제약은 없음)
 * - 실제 재고 변동(입/출고)은 Phase 3C 에서 InventoryLog 기반 별도 액션으로 처리
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateInput,
  type ProductUpdateInput,
} from "@/lib/validators/product";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

type ListOpts = {
  q?: string;
  category?: string | "ALL";
  active?: "ALL" | "ACTIVE" | "INACTIVE";
};

export async function listProducts(opts: ListOpts = {}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const where: Prisma.ProductWhereInput = {};
  if (opts.category && opts.category !== "ALL") where.category = opts.category;
  if (opts.active === "ACTIVE") where.active = true;
  else if (opts.active === "INACTIVE") where.active = false;

  if (opts.q && opts.q.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { part: { contains: q, mode: "insensitive" } },
    ];
  }

  return prisma.product.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { sizes: true } },
      sizes: { select: { physicalStock: true, availableStock: true } },
    },
  });
}

export async function listProductCategories() {
  await requireRole("TENANT_OWNER", "ADMIN");
  const rows = await prisma.product.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category!).filter(Boolean);
}

export async function getProduct(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.product.findUnique({
    where: { id },
    include: {
      sizes: { orderBy: { sizeCode: "asc" } },
    },
  });
}

export async function createProduct(
  input: ProductCreateInput,
): Promise<ActionResult<{ id: string; code: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = productCreateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const data = parsed.data;
  const dup = await prisma.product.findUnique({ where: { code: data.code } });
  if (dup) return fail("이미 사용 중인 제품 코드입니다.", { fieldErrors: { code: ["중복"] } });

  try {
    const created = await prisma.product.create({
      data: {
        code: data.code,
        name: data.name,
        brand: data.brand,
        category: data.category,
        part: data.part,
        basePrice: new Prisma.Decimal(data.basePrice),
        expiryMonths: data.expiryMonths,
        createdBy: user.id,
      },
      select: { id: true, code: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "PRODUCT_CREATE",
      resource: `Product:${created.id}`,
      metadata: { code: created.code, name: data.name, basePrice: data.basePrice },
    });

    revalidatePath("/admin/products");
    return ok(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("중복된 제품 코드입니다.", { fieldErrors: { code: ["중복"] } });
    }
    throw err;
  }
}

export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = productUpdateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return fail("존재하지 않는 제품입니다.");

  if (parsed.data.code && parsed.data.code !== existing.code) {
    const dup = await prisma.product.findUnique({ where: { code: parsed.data.code } });
    if (dup) return fail("이미 사용 중인 제품 코드입니다.", { fieldErrors: { code: ["중복"] } });
  }

  // Decimal 필드는 별도 변환
  const { basePrice, ...rest } = parsed.data;
  const data: Prisma.ProductUpdateInput = { ...rest };
  if (basePrice !== undefined) data.basePrice = new Prisma.Decimal(basePrice);

  try {
    await prisma.product.update({ where: { id }, data });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "PRODUCT_UPDATE",
      resource: `Product:${id}`,
      metadata: {
        before: { code: existing.code, name: existing.name, basePrice: existing.basePrice.toString() },
        patch: parsed.data,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("중복된 제품 코드입니다.", { fieldErrors: { code: ["중복"] } });
    }
    throw err;
  }
}

/** 소프트 삭제(active 토글). 과거 주문 참조 보호. */
export async function toggleProductActive(id: string): Promise<ActionResult<{ active: boolean }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return fail("존재하지 않는 제품입니다.");

  const next = !existing.active;
  await prisma.product.update({ where: { id }, data: { active: next } });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: next ? "PRODUCT_REACTIVATE" : "PRODUCT_DEACTIVATE",
    resource: `Product:${id}`,
    metadata: { code: existing.code, name: existing.name },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  return ok({ active: next });
}
