/**
 * 재고 변동 Server Actions (Phase 3C).
 *
 * 핵심 원칙 (CLAUDE.md + inventory-specialist 리뷰):
 * - 이중 재고: physicalStock = 창고 실재고, availableStock = 판매 가능 (예약분 제외)
 * - 모든 변동은 `$transaction` 내에서 `SELECT FOR UPDATE` 로 행 잠금
 * - 불변식: `physicalStock >= availableStock >= 0` 은 트랜잭션 커밋 전 반드시 검증
 * - `InventoryLog` 는 변동 후 스냅샷(physicalAfter, availableAfter)을 기록해 복기 가능
 * - `InventoryAdjustment` 는 비즈니스 원장 (reason, approvedBy) — Log 와 역할 분리
 *
 * Phase 3C 범위:
 * - receiveStock (입고)
 * - createAdjustment (반품/폐기/실사조정/입고보정)
 * - listInventoryLogs (이력 조회)
 * - getInventorySummary (사이즈별 현재 재고 + 저재고 경보)
 *
 * 주문 기반 flow (RESERVE/RELEASE/SHIP) 는 Phase 3D 에서 Order 액션 경유해서만 수행.
 */
"use server";
import { revalidatePath } from "next/cache";
import type { InventoryLogType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  receiveSchema,
  adjustmentSchema,
  type ReceiveInput,
  type AdjustmentInput,
  type AdjustReason,
} from "@/lib/validators/inventory";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";
import { InventoryError, assertInvariant } from "@/lib/inventory/invariant";

// 반품 만 특수 케이스(RETURN), 나머지 조정은 부호에 따라 ADJUST_IN/OUT.
function resolveLogType(reason: AdjustReason, qty: number): InventoryLogType {
  if (reason === "반품") return "RETURN";
  return qty > 0 ? "ADJUST_IN" : "ADJUST_OUT";
}

/**
 * 입고 (RECEIVE). physical·available 동시에 +qty.
 */
export async function receiveStock(
  input: ReceiveInput,
): Promise<ActionResult<{ physicalAfter: number; availableAfter: number }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = receiveSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { productSizeId, qty, note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) 행 잠금
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "tenant_altibio"."ProductSize"
        WHERE id = ${productSizeId}
        FOR UPDATE
      `;
      // 2) 현재 상태 읽기 (잠금 이후)
      const cur = await tx.productSize.findUnique({
        where: { id: productSizeId },
        select: { id: true, physicalStock: true, availableStock: true, productId: true },
      });
      if (!cur) throw new InventoryError("존재하지 않는 사이즈입니다.");

      const nextPhysical = cur.physicalStock + qty;
      const nextAvailable = cur.availableStock + qty;
      assertInvariant(nextPhysical, nextAvailable);

      // 3) 재고 업데이트
      await tx.productSize.update({
        where: { id: productSizeId },
        data: { physicalStock: nextPhysical, availableStock: nextAvailable },
      });

      // 4) 로그 기록
      await tx.inventoryLog.create({
        data: {
          productSizeId,
          type: "RECEIVE",
          qtyDelta: qty,
          physicalAfter: nextPhysical,
          availableAfter: nextAvailable,
          note,
          createdBy: user.id,
        },
      });

      return { productId: cur.productId, physicalAfter: nextPhysical, availableAfter: nextAvailable };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "INVENTORY_RECEIVE",
      resource: `ProductSize:${productSizeId}`,
      metadata: { qty, physicalAfter: result.physicalAfter, availableAfter: result.availableAfter, note },
    });

    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/products/${result.productId}`);
    return ok({ physicalAfter: result.physicalAfter, availableAfter: result.availableAfter });
  } catch (err) {
    if (err instanceof InventoryError) return fail(err.message);
    throw err;
  }
}

/**
 * 조정 (반품/폐기/실사조정/입고보정).
 * - 반품 → type=RETURN, physical·available 동시에 +qty
 * - 폐기 → type=ADJUST_OUT, 동시에 -|qty|
 * - 실사조정 → qty 부호에 따라 ADJUST_IN/OUT, 동시에 변경
 * - 입고보정 → type=ADJUST_IN, 동시에 +qty (실사 중 추가 발견 등)
 */
export async function createAdjustment(
  input: AdjustmentInput,
): Promise<
  ActionResult<{ adjustmentId: string; physicalAfter: number; availableAfter: number }>
> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { productSizeId, qty, reason, note, approvedBy } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "tenant_altibio"."ProductSize"
        WHERE id = ${productSizeId}
        FOR UPDATE
      `;
      const cur = await tx.productSize.findUnique({
        where: { id: productSizeId },
        select: { id: true, physicalStock: true, availableStock: true, productId: true },
      });
      if (!cur) throw new InventoryError("존재하지 않는 사이즈입니다.");

      const nextPhysical = cur.physicalStock + qty;
      const nextAvailable = cur.availableStock + qty;
      assertInvariant(nextPhysical, nextAvailable);

      await tx.productSize.update({
        where: { id: productSizeId },
        data: { physicalStock: nextPhysical, availableStock: nextAvailable },
      });

      // 비즈니스 원장
      const adj = await tx.inventoryAdjustment.create({
        data: {
          productSizeId,
          qty,
          reason,
          note,
          approvedBy,
          createdBy: user.id,
        },
        select: { id: true },
      });

      // 수치 감사
      await tx.inventoryLog.create({
        data: {
          productSizeId,
          type: resolveLogType(reason, qty),
          qtyDelta: qty,
          physicalAfter: nextPhysical,
          availableAfter: nextAvailable,
          note: note ?? reason,
          createdBy: user.id,
        },
      });

      return {
        productId: cur.productId,
        adjustmentId: adj.id,
        physicalAfter: nextPhysical,
        availableAfter: nextAvailable,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "INVENTORY_ADJUST",
      resource: `InventoryAdjustment:${result.adjustmentId}`,
      metadata: {
        productSizeId,
        qty,
        reason,
        physicalAfter: result.physicalAfter,
        availableAfter: result.availableAfter,
      },
    });

    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/products/${result.productId}`);
    return ok({
      adjustmentId: result.adjustmentId,
      physicalAfter: result.physicalAfter,
      availableAfter: result.availableAfter,
    });
  } catch (err) {
    if (err instanceof InventoryError) return fail(err.message);
    throw err;
  }
}

// ─── 조회 ──────────────────────────────────────────────

export type InventoryLogFilter = {
  productId?: string;
  sizeId?: string;
  type?: InventoryLogType | "ALL";
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function listInventoryLogs(filter: InventoryLogFilter = {}) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const where: Prisma.InventoryLogWhereInput = {};
  if (filter.sizeId) where.productSizeId = filter.sizeId;
  if (filter.productId) where.productSize = { productId: filter.productId };
  if (filter.type && filter.type !== "ALL") where.type = filter.type;
  if (filter.from || filter.to) {
    where.createdAt = {};
    if (filter.from) where.createdAt.gte = filter.from;
    if (filter.to) where.createdAt.lte = filter.to;
  }

  return prisma.inventoryLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 200,
    include: {
      productSize: {
        select: {
          sizeCode: true,
          product: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });
}

export async function getInventorySummary() {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const sizes = await prisma.productSize.findMany({
    where: { product: { active: true } },
    orderBy: [{ product: { name: "asc" } }, { sizeCode: "asc" }],
    include: {
      product: { select: { id: true, code: true, name: true, category: true } },
    },
  });

  return sizes.map((s) => ({
    id: s.id,
    sizeCode: s.sizeCode,
    physicalStock: s.physicalStock,
    availableStock: s.availableStock,
    reorderPoint: s.reorderPoint,
    low: s.reorderPoint !== null && s.physicalStock <= s.reorderPoint,
    product: s.product,
  }));
}

// InventoryError / assertInvariant 는 `@/lib/inventory/invariant` 로 분리됨
// (순수 도메인 로직 · 테스트 가능 · "use server" 제약 회피)
