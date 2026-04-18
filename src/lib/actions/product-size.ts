/**
 * 제품 사이즈 (ProductSize) Server Actions.
 *
 * Phase 3B 범위:
 * - 사이즈 생성/편집/삭제 (초기 재고는 폼에서 입력 허용, 이후 변동은 3C 에서 InventoryLog 경유)
 * - sizeCode 는 같은 제품 내 unique — DB 제약 + 앱 사전 체크
 * - 주문/재고 참조가 있는 사이즈는 삭제 금지 (데이터 정합 보호)
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  productSizeCreateSchema,
  productSizeUpdateSchema,
  type ProductSizeCreateInput,
  type ProductSizeUpdateInput,
} from "@/lib/validators/product";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

export async function createSize(
  productId: string,
  input: ProductSizeCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = productSizeCreateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return fail("존재하지 않는 제품입니다.");

  const dup = await prisma.productSize.findUnique({
    where: { productId_sizeCode: { productId, sizeCode: parsed.data.sizeCode } },
  });
  if (dup) return fail("이미 등록된 사이즈 코드입니다.", { fieldErrors: { sizeCode: ["중복"] } });

  try {
    const created = await prisma.productSize.create({
      data: {
        productId,
        sizeCode: parsed.data.sizeCode,
        physicalStock: parsed.data.physicalStock,
        availableStock: parsed.data.availableStock,
        reorderPoint: parsed.data.reorderPoint,
        createdBy: user.id,
      },
      select: { id: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "PRODUCT_SIZE_CREATE",
      resource: `ProductSize:${created.id}`,
      metadata: {
        productId,
        sizeCode: parsed.data.sizeCode,
        initialPhysical: parsed.data.physicalStock,
        initialAvailable: parsed.data.availableStock,
      },
    });

    revalidatePath(`/admin/products/${productId}`);
    return ok(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("중복된 사이즈 코드입니다.", { fieldErrors: { sizeCode: ["중복"] } });
    }
    throw err;
  }
}

export async function updateSize(
  id: string,
  input: ProductSizeUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = productSizeUpdateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.productSize.findUnique({ where: { id } });
  if (!existing) return fail("존재하지 않는 사이즈입니다.");

  if (parsed.data.sizeCode && parsed.data.sizeCode !== existing.sizeCode) {
    const dup = await prisma.productSize.findUnique({
      where: {
        productId_sizeCode: {
          productId: existing.productId,
          sizeCode: parsed.data.sizeCode,
        },
      },
    });
    if (dup)
      return fail("이미 등록된 사이즈 코드입니다.", { fieldErrors: { sizeCode: ["중복"] } });
  }

  try {
    await prisma.productSize.update({
      where: { id },
      data: { ...parsed.data },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "PRODUCT_SIZE_UPDATE",
      resource: `ProductSize:${id}`,
      metadata: {
        productId: existing.productId,
        before: {
          sizeCode: existing.sizeCode,
          physicalStock: existing.physicalStock,
          availableStock: existing.availableStock,
          reorderPoint: existing.reorderPoint,
        },
        patch: parsed.data,
      },
    });

    revalidatePath(`/admin/products/${existing.productId}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("중복된 사이즈 코드입니다.", { fieldErrors: { sizeCode: ["중복"] } });
    }
    throw err;
  }
}

/**
 * 사이즈 삭제.
 * 주문/재고 참조가 있으면 하드 삭제 불가 → 안내 메시지 반환.
 * (Phase 3C 에서 '비활성 사이즈' 플래그 도입 검토)
 */
export async function deleteSize(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const existing = await prisma.productSize.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          orderItems: true,
          inventoryLogs: true,
          adjustments: true,
          expiryLots: true,
        },
      },
    },
  });
  if (!existing) return fail("존재하지 않는 사이즈입니다.");

  const refs =
    existing._count.orderItems +
    existing._count.inventoryLogs +
    existing._count.adjustments +
    existing._count.expiryLots;

  if (refs > 0) {
    return fail(
      `주문·재고 기록이 있는 사이즈는 삭제할 수 없습니다. (참조 ${refs}건)`,
    );
  }

  await prisma.productSize.delete({ where: { id } });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "PRODUCT_SIZE_DELETE",
    resource: `ProductSize:${id}`,
    metadata: { productId: existing.productId, sizeCode: existing.sizeCode },
  });

  revalidatePath(`/admin/products/${existing.productId}`);
  return ok({ id });
}
