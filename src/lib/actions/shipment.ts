/**
 * 출고 (Shipment) Server Actions — Phase 3D-2c.
 *
 * 수명주기 (재고 관점):
 *   CONFIRM 단계에서 이미 availableStock 차감(RESERVE)됨.
 *   startShipment : Order.CONFIRMED → SHIPPING + Shipment 생성 (첫 번째 KanbanColumn 진입). 재고 미변동.
 *   moveShipmentStage : Shipment.currentStageId 갱신 + ShipmentStageLog 기록.
 *     - 도착 단계가 isTerminal=true 인 경우 자동 완료 처리:
 *       • 각 라인 physicalStock -= quantity (InventoryLog.SHIP, qtyDelta=-qty)
 *       • availableStock 은 예약된 상태이므로 **추가 변동 없음** (이미 CONFIRM 에서 차감됨)
 *       • invariant: physical-qty >= available 이어야 함 (CONFIRM 시 이미 available 차감됐으므로 수학적으로 만족)
 *       • Order.status=COMPLETED, completedAt=now()
 *       • Shipment.completedAt=now()
 *   holdShipment / resumeShipment : Shipment.holdReason 만 조정. 주문/재고 불변.
 *
 * 핵심 불변식 (도메인 규칙):
 *   SHIP 이후: physicalAfter >= availableAfter 유지
 *   CONFIRM 단계에서 `availableStock -= qty` 했고,
 *   SHIP 단계에서 `physicalStock -= qty` 만 하므로
 *   (physicalStock - qty) >= availableStock 는 항상 성립 (기존 physical >= available + qty 이었으므로).
 *
 * RBAC: TENANT_OWNER / ADMIN / QC.
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  startShipmentSchema,
  moveShipmentStageSchema,
  holdShipmentSchema,
  resumeShipmentSchema,
  type StartShipmentInput,
  type MoveShipmentStageInput,
  type HoldShipmentInput,
  type ResumeShipmentInput,
} from "@/lib/validators/shipment";
import { InventoryError, assertInvariant } from "@/lib/inventory/invariant";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

class ShipmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShipmentError";
  }
}

// ─── 조회 ─────────────────────────────────────────────────

/**
 * 칸반 단계 목록 (sortOrder asc). UI / 액션 양쪽에서 사용.
 */
export async function listKanbanColumns() {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  return prisma.kanbanColumn.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      key: true,
      label: true,
      sortOrder: true,
      isTerminal: true,
      color: true,
    },
  });
}

/**
 * 전체 활성 Shipment 목록 — 칸반 보드용. 완료된 것은 terminal 열에 남음.
 * 주문/거래처 최소 정보 포함.
 */
export async function listShipmentsForBoard() {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  return prisma.shipment.findMany({
    orderBy: [{ enteredStageAt: "asc" }, { createdAt: "asc" }],
    include: {
      currentStage: {
        select: { id: true, key: true, label: true, sortOrder: true, isTerminal: true },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          orderDate: true,
          requestedDate: true,
          client: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
          items: {
            select: { quantity: true, lineTotal: true },
          },
        },
      },
    },
  });
}

/**
 * 완료된 출고 내역 — R17 전용 리스트. completedAt 기준 내림차순.
 * 기간/거래처/주문번호 필터 지원. 라인 정보는 집계 요약만 포함 (성능).
 */
export type ShipmentHistoryFilter = {
  clientId?: string;
  from?: Date;
  to?: Date;
  q?: string; // 주문번호/거래처명 부분검색
  limit?: number;
};

export async function listShipmentHistory(
  filter: ShipmentHistoryFilter = {},
) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const where: Prisma.ShipmentWhereInput = {
    completedAt: { not: null },
  };
  if (filter.from || filter.to) {
    where.completedAt = { not: null };
    if (filter.from) (where.completedAt as Prisma.DateTimeFilter).gte = filter.from;
    if (filter.to) (where.completedAt as Prisma.DateTimeFilter).lte = filter.to;
  }
  if (filter.clientId) {
    where.order = { clientId: filter.clientId };
  }
  if (filter.q && filter.q.trim()) {
    const q = filter.q.trim();
    where.order = {
      ...(where.order as Prisma.OrderWhereInput | undefined),
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
        { client: { code: { contains: q, mode: "insensitive" } } },
      ],
    };
  }

  return prisma.shipment.findMany({
    where,
    orderBy: [{ completedAt: "desc" }],
    take: filter.limit ?? 500,
    include: {
      currentStage: {
        select: { id: true, key: true, label: true },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          billingMonth: true,
          shipToRecipient: true,
          shipToAddress: true,
          client: { select: { id: true, code: true, name: true } },
          items: {
            select: {
              quantity: true,
              lineTotal: true,
              product: { select: { code: true, name: true } },
              productSize: { select: { sizeCode: true } },
            },
          },
        },
      },
    },
  });
}

export async function getShipment(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  return prisma.shipment.findUnique({
    where: { id },
    include: {
      currentStage: true,
      order: {
        include: {
          client: true,
          items: {
            include: {
              product: { select: { id: true, code: true, name: true } },
              productSize: { select: { id: true, sizeCode: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      stageHistory: {
        orderBy: { movedAt: "desc" },
        take: 50,
      },
    },
  });
}

// ─── 액션: 출고 시작 ──────────────────────────────────────

/**
 * startShipment: Order.CONFIRMED → SHIPPING + Shipment 생성.
 * - 주문당 이미 활성 Shipment 가 있으면 거부 (중복 출고 방지).
 * - 첫 번째 KanbanColumn (sortOrder 최소) 에 진입.
 * - 재고 변동 없음 (SHIP 은 terminal 도달 시).
 */
export async function startShipment(
  orderId: string,
  input: StartShipmentInput = {},
): Promise<ActionResult<{ shipmentId: string; stageId: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = startShipmentSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          clientId: true,
          status: true,
          shipments: { select: { id: true, completedAt: true } },
        },
      });
      if (!order) throw new ShipmentError("존재하지 않는 주문입니다.");
      if (order.status !== "CONFIRMED")
        throw new ShipmentError(
          `CONFIRMED 상태에서만 출고를 시작할 수 있습니다 (현재: ${order.status}).`,
        );
      const active = order.shipments.find((s) => s.completedAt === null);
      if (active)
        throw new ShipmentError(
          "이미 진행 중인 출고가 있습니다. 기존 출고를 완료하거나 처리해주세요.",
        );

      const firstStage = await tx.kanbanColumn.findFirst({
        orderBy: { sortOrder: "asc" },
        select: { id: true, key: true, label: true, isTerminal: true },
      });
      if (!firstStage)
        throw new ShipmentError(
          "칸반 단계가 설정되어 있지 않습니다. 관리자에게 문의하세요.",
        );
      if (firstStage.isTerminal)
        throw new ShipmentError(
          "첫 번째 칸반 단계가 terminal 로 설정되어 있어 출고를 시작할 수 없습니다.",
        );

      const shipment = await tx.shipment.create({
        data: {
          orderId: order.id,
          currentStageId: firstStage.id,
          enteredStageAt: new Date(),
          createdBy: user.id,
        },
        select: { id: true },
      });

      await tx.shipmentStageLog.create({
        data: {
          shipmentId: shipment.id,
          fromStageId: null,
          toStageId: firstStage.id,
          movedBy: user.id,
          note: note ?? "START",
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "SHIPPING" },
      });

      return {
        shipmentId: shipment.id,
        stageId: firstStage.id,
        stageKey: firstStage.key,
        orderNumber: order.orderNumber,
        clientId: order.clientId,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "SHIPMENT_START",
      resource: `Shipment:${result.shipmentId}`,
      metadata: {
        orderId,
        orderNumber: result.orderNumber,
        clientId: result.clientId,
        firstStageKey: result.stageKey,
      },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/shipments");
    revalidatePath("/qc/board");
    return ok({ shipmentId: result.shipmentId, stageId: result.stageId });
  } catch (err) {
    if (err instanceof ShipmentError) return fail(err.message);
    throw err;
  }
}

// ─── 액션: 단계 이동 (terminal 이면 자동 완료) ─────────

/**
 * moveShipmentStage: 주어진 toStageId 로 이동.
 * - 같은 단계 거부.
 * - 완료된 출고(completedAt != null) 는 이동 불가.
 * - toStageId.isTerminal 이면 자동 완료 처리:
 *     • 각 라인 physicalStock -= quantity
 *     • InventoryLog.SHIP (qtyDelta = -qty, relatedOrderId)
 *     • invariant 검증 (이론상 통과, 방어적 호출)
 *     • Order.status = COMPLETED, completedAt = now()
 *     • Shipment.completedAt = now()
 */
export async function moveShipmentStage(
  shipmentId: string,
  input: MoveShipmentStageInput,
): Promise<
  ActionResult<{
    shipmentId: string;
    toStageId: string;
    completed: boolean;
  }>
> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = moveShipmentStageSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { toStageId, note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sh = await tx.shipment.findUnique({
        where: { id: shipmentId },
        select: {
          id: true,
          orderId: true,
          currentStageId: true,
          completedAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              clientId: true,
              status: true,
              items: {
                select: {
                  id: true,
                  productSizeId: true,
                  quantity: true,
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });
      if (!sh) throw new ShipmentError("존재하지 않는 출고입니다.");
      if (sh.completedAt !== null)
        throw new ShipmentError("이미 완료된 출고는 이동할 수 없습니다.");
      if (sh.currentStageId === toStageId)
        throw new ShipmentError("현재 단계와 동일한 단계로는 이동할 수 없습니다.");

      const toStage = await tx.kanbanColumn.findUnique({
        where: { id: toStageId },
        select: { id: true, key: true, label: true, isTerminal: true },
      });
      if (!toStage) throw new ShipmentError("존재하지 않는 단계입니다.");

      // 1) 단계 이동
      const now = new Date();
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          currentStageId: toStage.id,
          enteredStageAt: now,
        },
      });
      await tx.shipmentStageLog.create({
        data: {
          shipmentId,
          fromStageId: sh.currentStageId,
          toStageId: toStage.id,
          movedBy: user.id,
          note: note ?? null,
        },
      });

      // 2) terminal 이면 완료 처리
      let completed = false;
      const shipLogs: Array<{
        productSizeId: string;
        qty: number;
        physicalAfter: number;
        availableAfter: number;
      }> = [];

      if (toStage.isTerminal) {
        if (sh.order.status !== "SHIPPING")
          throw new ShipmentError(
            `SHIPPING 상태의 주문만 완료 가능합니다 (현재: ${sh.order.status}).`,
          );
        if (sh.order.items.length === 0)
          throw new ShipmentError("라인이 없는 주문은 완료할 수 없습니다.");

        for (const it of sh.order.items) {
          await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "tenant_altibio"."ProductSize"
            WHERE id = ${it.productSizeId}
            FOR UPDATE
          `;
          const size = await tx.productSize.findUnique({
            where: { id: it.productSizeId },
            select: {
              id: true,
              sizeCode: true,
              physicalStock: true,
              availableStock: true,
              product: { select: { code: true, name: true } },
            },
          });
          if (!size)
            throw new ShipmentError(
              `라인의 사이즈가 존재하지 않습니다 (라인 ${it.id}).`,
            );

          const nextPhysical = size.physicalStock - it.quantity;
          // available 은 CONFIRM 때 이미 차감됐으므로 그대로.
          assertInvariant(nextPhysical, size.availableStock);

          await tx.productSize.update({
            where: { id: size.id },
            data: { physicalStock: nextPhysical },
          });

          await tx.inventoryLog.create({
            data: {
              productSizeId: size.id,
              type: "SHIP",
              qtyDelta: -it.quantity,
              physicalAfter: nextPhysical,
              availableAfter: size.availableStock,
              relatedOrderId: sh.order.id,
              note: note ? `SHIP: ${note}` : "SHIP (칸반 완료)",
              createdBy: user.id,
            },
          });

          shipLogs.push({
            productSizeId: size.id,
            qty: it.quantity,
            physicalAfter: nextPhysical,
            availableAfter: size.availableStock,
          });
        }

        await tx.shipment.update({
          where: { id: shipmentId },
          data: { completedAt: now },
        });
        await tx.order.update({
          where: { id: sh.order.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
          },
        });

        completed = true;
      }

      return {
        orderId: sh.order.id,
        orderNumber: sh.order.orderNumber,
        clientId: sh.order.clientId,
        fromStageId: sh.currentStageId,
        toStageId: toStage.id,
        toStageKey: toStage.key,
        completed,
        shipLogs,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: result.completed ? "SHIPMENT_COMPLETE" : "SHIPMENT_MOVE",
      resource: `Shipment:${shipmentId}`,
      metadata: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        clientId: result.clientId,
        fromStageId: result.fromStageId,
        toStageId: result.toStageId,
        toStageKey: result.toStageKey,
        completed: result.completed,
        shipLines: result.shipLogs.length,
      },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${result.orderId}`);
    revalidatePath("/admin/shipments");
    revalidatePath("/qc/board");
    if (result.completed) {
      revalidatePath("/admin/inventory");
      revalidatePath("/admin/inventory/logs");
    }
    return ok({
      shipmentId,
      toStageId: result.toStageId,
      completed: result.completed,
    });
  } catch (err) {
    if (err instanceof ShipmentError) return fail(err.message);
    if (err instanceof InventoryError) return fail(err.message);
    throw err;
  }
}

// ─── 액션: 보류 / 재개 ─────────────────────────────────

/**
 * holdShipment: Shipment.holdReason 저장. 재고/주문 상태는 불변.
 */
export async function holdShipment(
  shipmentId: string,
  input: HoldShipmentInput,
): Promise<ActionResult<{ shipmentId: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = holdShipmentSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { reason } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sh = await tx.shipment.findUnique({
        where: { id: shipmentId },
        select: {
          id: true,
          orderId: true,
          holdReason: true,
          completedAt: true,
          order: { select: { orderNumber: true, clientId: true } },
        },
      });
      if (!sh) throw new ShipmentError("존재하지 않는 출고입니다.");
      if (sh.completedAt !== null)
        throw new ShipmentError("이미 완료된 출고는 보류할 수 없습니다.");
      if (sh.holdReason !== null)
        throw new ShipmentError("이미 보류 상태입니다.");

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { holdReason: reason },
      });

      return {
        orderId: sh.orderId,
        orderNumber: sh.order.orderNumber,
        clientId: sh.order.clientId,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "SHIPMENT_HOLD",
      resource: `Shipment:${shipmentId}`,
      metadata: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        clientId: result.clientId,
        reason,
      },
    });

    revalidatePath("/admin/shipments");
    revalidatePath(`/admin/orders/${result.orderId}`);
    revalidatePath("/qc/board");
    return ok({ shipmentId });
  } catch (err) {
    if (err instanceof ShipmentError) return fail(err.message);
    throw err;
  }
}

/**
 * resumeShipment: holdReason = null.
 */
export async function resumeShipment(
  shipmentId: string,
  input: ResumeShipmentInput = {},
): Promise<ActionResult<{ shipmentId: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const parsed = resumeShipmentSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sh = await tx.shipment.findUnique({
        where: { id: shipmentId },
        select: {
          id: true,
          orderId: true,
          holdReason: true,
          completedAt: true,
          order: { select: { orderNumber: true, clientId: true } },
        },
      });
      if (!sh) throw new ShipmentError("존재하지 않는 출고입니다.");
      if (sh.completedAt !== null)
        throw new ShipmentError("이미 완료된 출고는 재개할 수 없습니다.");
      if (sh.holdReason === null)
        throw new ShipmentError("보류 상태가 아닙니다.");

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { holdReason: null },
      });

      return {
        orderId: sh.orderId,
        orderNumber: sh.order.orderNumber,
        clientId: sh.order.clientId,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "SHIPMENT_RESUME",
      resource: `Shipment:${shipmentId}`,
      metadata: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        clientId: result.clientId,
        note: note ?? null,
      },
    });

    revalidatePath("/admin/shipments");
    revalidatePath(`/admin/orders/${result.orderId}`);
    revalidatePath("/qc/board");
    return ok({ shipmentId });
  } catch (err) {
    if (err instanceof ShipmentError) return fail(err.message);
    throw err;
  }
}
