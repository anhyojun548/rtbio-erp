/**
 * 유통기한 로트(ExpiryLot) Server Actions — Phase 3D-4a (R19).
 *
 * 주요 액션:
 *   - listExpiryLots(filter)        : 상태별·사이즈별 조회
 *   - listExpiringSoon(days)        : N일 이내 만료 + EXPIRED 포함
 *   - getLotsForSize(sizeId)        : 특정 사이즈 로트 목록
 *   - createExpiryLot(input)        : 로트 추가 (quantity == remainingQty 초기화)
 *   - updateExpiryLot(id, patch)    : 로트 수정 (수량 조정 가능)
 *   - deleteExpiryLot(id)           : 로트 삭제 (감사 로그 기록)
 *
 * RBAC: TENANT_OWNER / ADMIN.
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  createExpiryLotSchema,
  updateExpiryLotSchema,
  classifyExpiry,
  type CreateExpiryLotInput,
  type UpdateExpiryLotInput,
  type ExpiryStage,
} from "@/lib/validators/expiry";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

class ExpiryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpiryError";
  }
}

// ─── 조회 ─────────────────────────────────────────────────

export type ExpiryLotFilter = {
  productSizeId?: string;
  productId?: string;
  stage?: ExpiryStage | "ALL";
  includeEmpty?: boolean; // remainingQty=0 포함 여부 (기본 false)
  limit?: number;
};

export async function listExpiryLots(filter: ExpiryLotFilter = {}) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const where: Prisma.ExpiryLotWhereInput = {};
  if (filter.productSizeId) where.productSizeId = filter.productSizeId;
  if (filter.productId) {
    where.productSize = { productId: filter.productId };
  }
  if (!filter.includeEmpty) where.remainingQty = { gt: 0 };

  const rows = await prisma.expiryLot.findMany({
    where,
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
    take: filter.limit ?? 500,
    include: {
      productSize: {
        select: {
          id: true,
          sizeCode: true,
          physicalStock: true,
          availableStock: true,
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              brand: true,
              category: true,
            },
          },
        },
      },
    },
  });

  // stage 필터는 런타임 계산
  if (filter.stage && filter.stage !== "ALL") {
    return rows.filter(
      (r) => classifyExpiry(r.expiryDate).stage === filter.stage,
    );
  }
  return rows;
}

/**
 * N일 이내 만료 예정 + 이미 만료된 로트.
 * 대시보드 알림 용.
 */
export async function listExpiringSoon(days: number = 90) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);

  return prisma.expiryLot.findMany({
    where: {
      remainingQty: { gt: 0 },
      expiryDate: { lte: threshold },
    },
    orderBy: [{ expiryDate: "asc" }],
    include: {
      productSize: {
        select: {
          id: true,
          sizeCode: true,
          product: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  });
}

export async function getLotsForSize(productSizeId: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  return prisma.expiryLot.findMany({
    where: { productSizeId },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
  });
}

// ─── 생성 ────────────────────────────────────────────────

export async function createExpiryLot(
  input: CreateExpiryLotInput,
): Promise<ActionResult<{ id: string; lotNumber: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = createExpiryLotSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const size = await tx.productSize.findUnique({
        where: { id: data.productSizeId },
        include: {
          product: { select: { id: true, code: true, name: true } },
        },
      });
      if (!size) throw new ExpiryError("존재하지 않는 사이즈입니다.");

      // 같은 사이즈 내에서 lotNumber 중복 체크
      const dup = await tx.expiryLot.findFirst({
        where: {
          productSizeId: data.productSizeId,
          lotNumber: data.lotNumber,
        },
        select: { id: true },
      });
      if (dup)
        throw new ExpiryError(
          `이미 등록된 로트 번호입니다: ${data.lotNumber}`,
        );

      const lot = await tx.expiryLot.create({
        data: {
          productSizeId: data.productSizeId,
          lotNumber: data.lotNumber,
          expiryDate: data.expiryDate,
          quantity: data.quantity,
          remainingQty: data.quantity, // 초기값 = quantity
          note: data.note ?? null,
        },
        select: { id: true, lotNumber: true },
      });

      return {
        id: lot.id,
        lotNumber: lot.lotNumber,
        productName: size.product.name,
        productCode: size.product.code,
        sizeCode: size.sizeCode,
        productId: size.product.id,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "EXPIRY_LOT_CREATE",
      resource: `ExpiryLot:${result.id}`,
      metadata: {
        productId: result.productId,
        productCode: result.productCode,
        productName: result.productName,
        sizeCode: result.sizeCode,
        lotNumber: result.lotNumber,
        quantity: data.quantity,
        expiryDate: data.expiryDate,
      },
    });

    revalidatePath("/admin/expiry");
    revalidatePath(`/admin/products/${result.productId}`);
    return ok({ id: result.id, lotNumber: result.lotNumber });
  } catch (err) {
    if (err instanceof ExpiryError) return fail(err.message);
    throw err;
  }
}

// ─── 수정 ────────────────────────────────────────────────

export async function updateExpiryLot(
  id: string,
  input: UpdateExpiryLotInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = updateExpiryLotSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const cur = await prisma.expiryLot.findUnique({
      where: { id },
      include: {
        productSize: {
          select: {
            product: { select: { id: true } },
          },
        },
      },
    });
    if (!cur) throw new ExpiryError("존재하지 않는 로트입니다.");

    // 같은 사이즈 내 lotNumber 변경 시 중복 체크
    if (data.lotNumber && data.lotNumber !== cur.lotNumber) {
      const dup = await prisma.expiryLot.findFirst({
        where: {
          productSizeId: cur.productSizeId,
          lotNumber: data.lotNumber,
          id: { not: id },
        },
        select: { id: true },
      });
      if (dup)
        throw new ExpiryError(
          `이미 사용 중인 로트 번호입니다: ${data.lotNumber}`,
        );
    }

    // remainingQty 는 quantity 초과 불가 (원본 < 수정값 방지)
    if (
      data.remainingQty !== undefined &&
      data.remainingQty > cur.quantity
    ) {
      throw new ExpiryError(
        `잔여수량은 원본 수량(${cur.quantity})을 초과할 수 없습니다.`,
      );
    }

    const patch: Prisma.ExpiryLotUpdateInput = {};
    if (data.lotNumber !== undefined) patch.lotNumber = data.lotNumber;
    if (data.expiryDate !== undefined) patch.expiryDate = data.expiryDate;
    if (data.remainingQty !== undefined) patch.remainingQty = data.remainingQty;
    if (data.note !== undefined) patch.note = data.note;

    await prisma.expiryLot.update({ where: { id }, data: patch });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "EXPIRY_LOT_UPDATE",
      resource: `ExpiryLot:${id}`,
      metadata: {
        patch: data,
        before: {
          lotNumber: cur.lotNumber,
          remainingQty: cur.remainingQty,
          expiryDate: cur.expiryDate,
        },
      },
    });

    revalidatePath("/admin/expiry");
    revalidatePath(`/admin/products/${cur.productSize.product.id}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof ExpiryError) return fail(err.message);
    throw err;
  }
}

// ─── 삭제 ────────────────────────────────────────────────

export async function deleteExpiryLot(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  try {
    const cur = await prisma.expiryLot.findUnique({
      where: { id },
      include: {
        productSize: {
          select: {
            sizeCode: true,
            product: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!cur) throw new ExpiryError("존재하지 않는 로트입니다.");

    await prisma.expiryLot.delete({ where: { id } });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "EXPIRY_LOT_DELETE",
      resource: `ExpiryLot:${id}`,
      metadata: {
        productCode: cur.productSize.product.code,
        productName: cur.productSize.product.name,
        sizeCode: cur.productSize.sizeCode,
        lotNumber: cur.lotNumber,
        quantity: cur.quantity,
        remainingQty: cur.remainingQty,
        expiryDate: cur.expiryDate,
      },
    });

    revalidatePath("/admin/expiry");
    revalidatePath(`/admin/products/${cur.productSize.product.id}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof ExpiryError) return fail(err.message);
    throw err;
  }
}
