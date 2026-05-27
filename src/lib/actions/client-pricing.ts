/**
 * 거래처 가격 규칙 Server Actions (Phase 3D-1).
 *
 * - ClientDiscount: 거래처 × 카테고리 할인율
 * - ClientFixedPrice: 거래처 × 제품 고정가
 *
 * 도메인 규칙 (pricing.ts + pricing-specialist 리뷰):
 *   fixedPrice > discount[category] > basePrice
 *
 * 설계 결정:
 * - upsert 패턴 (@@unique([clientId, category]) / @@unique([clientId, productId]))
 * - discountRate ≥ 0.5 는 WARN 감사 로그 + ADMIN 이상 role 강제
 * - 삭제는 하드 삭제 (진행 주문은 확정 시점 스냅샷으로 보호됨)
 * - fixedPrice = 0 허용 (무상공급) — 감사로그에 명시
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  clientDiscountUpsertSchema,
  clientFixedPriceUpsertSchema,
  isSuspiciousDiscount,
  type ClientDiscountUpsertInput,
  type ClientFixedPriceUpsertInput,
} from "@/lib/validators/pricing";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

// ─── ClientDiscount ──────────────────────────────────────

/**
 * 거래처 할인율 upsert. category 는 @@unique([clientId, category]) 로 중복 방지.
 */
export async function upsertClientDiscount(
  clientId: string,
  input: ClientDiscountUpsertInput,
): Promise<ActionResult<{ id: string; rate: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = clientDiscountUpsertSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { category, discountRate, note } = parsed.data;

  const rateNum = Number(discountRate);
  // 50% 이상은 TENANT_OWNER 만 저장 가능 (ADMIN 차단) — 의심 할인 권한 분리
  if (isSuspiciousDiscount(rateNum) && user.role !== "TENANT_OWNER") {
    return fail(
      "50% 이상 할인율은 오너만 저장할 수 있습니다.",
      { fieldErrors: { discountRate: ["오너 권한 필요"] } },
    );
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return fail("존재하지 않는 거래처입니다.");

  try {
    const row = await prisma.clientDiscount.upsert({
      where: { clientId_category: { clientId, category } },
      create: {
        clientId,
        category,
        discountRate: new Prisma.Decimal(discountRate),
        createdBy: user.id,
      },
      update: {
        discountRate: new Prisma.Decimal(discountRate),
      },
      select: { id: true, discountRate: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CLIENT_DISCOUNT_UPSERT",
      resource: `ClientDiscount:${row.id}`,
      metadata: {
        clientId,
        clientCode: client.code,
        category,
        discountRate,
        suspicious: isSuspiciousDiscount(rateNum),
        note,
      },
    });

    revalidatePath(`/admin/clients/${clientId}`);
    return ok({ id: row.id, rate: row.discountRate.toString() });
  } catch (err) {
    throw err;
  }
}

export async function deleteClientDiscount(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const existing = await prisma.clientDiscount.findUnique({
    where: { id },
    include: { client: { select: { id: true, code: true } } },
  });
  if (!existing) return fail("존재하지 않는 할인율입니다.");

  await prisma.clientDiscount.delete({ where: { id } });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CLIENT_DISCOUNT_DELETE",
    resource: `ClientDiscount:${id}`,
    metadata: {
      clientId: existing.clientId,
      clientCode: existing.client.code,
      category: existing.category,
      discountRate: existing.discountRate.toString(),
    },
  });

  revalidatePath(`/admin/clients/${existing.clientId}`);
  return ok({ id });
}

// ─── ClientFixedPrice ─────────────────────────────────────

/**
 * 거래처 고정가 upsert. productId 로 중복 방지.
 */
export async function upsertClientFixedPrice(
  clientId: string,
  input: ClientFixedPriceUpsertInput,
): Promise<ActionResult<{ id: string; fixedPrice: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = clientFixedPriceUpsertSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { productId, fixedPrice, note } = parsed.data;

  const [client, product] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, name: true, basePrice: true },
    }),
  ]);
  if (!client) return fail("존재하지 않는 거래처입니다.");
  if (!product)
    return fail("존재하지 않는 제품입니다.", {
      fieldErrors: { productId: ["제품 없음"] },
    });

  const priceNum = Number(fixedPrice);
  const isFree = priceNum === 0;

  try {
    const row = await prisma.clientFixedPrice.upsert({
      where: { clientId_productId: { clientId, productId } },
      create: {
        clientId,
        productId,
        fixedPrice: new Prisma.Decimal(fixedPrice),
        createdBy: user.id,
      },
      update: {
        fixedPrice: new Prisma.Decimal(fixedPrice),
      },
      select: { id: true, fixedPrice: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CLIENT_FIXEDPRICE_UPSERT",
      resource: `ClientFixedPrice:${row.id}`,
      metadata: {
        clientId,
        clientCode: client.code,
        productId,
        productCode: product.code,
        productName: product.name,
        fixedPrice,
        basePrice: product.basePrice.toString(),
        isFree,
        note,
      },
    });

    revalidatePath(`/admin/clients/${clientId}`);
    return ok({ id: row.id, fixedPrice: row.fixedPrice.toString() });
  } catch (err) {
    throw err;
  }
}

export async function deleteClientFixedPrice(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const existing = await prisma.clientFixedPrice.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, code: true } },
      product: { select: { id: true, code: true, name: true } },
    },
  });
  if (!existing) return fail("존재하지 않는 고정가 규칙입니다.");

  await prisma.clientFixedPrice.delete({ where: { id } });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CLIENT_FIXEDPRICE_DELETE",
    resource: `ClientFixedPrice:${id}`,
    metadata: {
      clientId: existing.clientId,
      clientCode: existing.client.code,
      productId: existing.productId,
      productCode: existing.product.code,
      fixedPrice: existing.fixedPrice.toString(),
    },
  });

  revalidatePath(`/admin/clients/${existing.clientId}`);
  return ok({ id });
}

// ─── 조회 헬퍼 ─────────────────────────────────────────────

/**
 * 특정 거래처의 카테고리별 할인율 목록.
 */
export async function listClientDiscounts(clientId: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.clientDiscount.findMany({
    where: { clientId },
    orderBy: { category: "asc" },
  });
}

/**
 * 특정 거래처의 제품별 고정가 목록 (제품 코드/명 포함).
 */
export async function listClientFixedPrices(clientId: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.clientFixedPrice.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { id: true, code: true, name: true, basePrice: true } } },
  });
}

/**
 * 제품 카테고리 전체 목록 (할인율 입력용 datalist).
 */
export async function listProductCategoriesForDiscount(): Promise<string[]> {
  await requireRole("TENANT_OWNER", "ADMIN");
  const rows = await prisma.product.findMany({
    where: { active: true, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
  });
  return rows
    .map((r) => r.category)
    .filter((c): c is string => !!c)
    .sort();
}

/**
 * 제품 검색 (고정가 입력용 autocomplete).
 */
export async function searchProductsForFixedPrice(q: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const needle = q.trim();
  if (!needle) return [];
  return prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { code: { contains: needle, mode: "insensitive" } },
        { name: { contains: needle, mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true, name: true, basePrice: true, category: true },
    take: 20,
    orderBy: { name: "asc" },
  });
}
