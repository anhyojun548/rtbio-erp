/**
 * 출고 단계별 담당자 (ShipmentAssignee) Server Actions — R17.
 *
 * 한 Shipment 의 각 KanbanColumn 단계마다 다수 담당자 배정 가능.
 * Unique 제약: (shipmentId, stageId, userId).
 *
 * 호출자는 `stage` 를 KanbanColumn.id (cuid) 또는 KanbanColumn.key 둘 다로 보낼 수 있다.
 * 서버에서 먼저 id 로 lookup, 없으면 key 로 fallback 한다. 둘 다 실패하면 400.
 *
 * RBAC: TENANT_OWNER / ADMIN / QC.
 * 감사: SHIPMENT_ASSIGNEE_ADD / SHIPMENT_ASSIGNEE_REMOVE.
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";

class AssigneeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssigneeError";
  }
}

/**
 * stage 문자열을 KanbanColumn.id 로 정규화.
 * - 먼저 id 로 시도 (이미 cuid 인 경우 — 칸반 보드에서 stageId 직접 전달)
 * - 실패 시 key 로 lookup (예: "waiting", "barcode")
 */
async function resolveStageId(
  tx: Prisma.TransactionClient | typeof prisma,
  stage: string,
): Promise<{ id: string; key: string; label: string } | null> {
  // 1) id 매칭 시도
  const byId = await tx.kanbanColumn.findUnique({
    where: { id: stage },
    select: { id: true, key: true, label: true },
  });
  if (byId) return byId;
  // 2) key 매칭 fallback
  const byKey = await tx.kanbanColumn.findUnique({
    where: { key: stage },
    select: { id: true, key: true, label: true },
  });
  return byKey;
}

/**
 * 한 Shipment 의 모든 단계 담당자 목록.
 * UI 카드/상세에서 stage 별로 그룹핑해 사용.
 */
export async function listShipmentAssignees(shipmentId: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  if (!shipmentId) return [];
  return prisma.shipmentAssignee.findMany({
    where: { shipmentId },
    orderBy: { assignedAt: "asc" },
    select: {
      id: true,
      shipmentId: true,
      stageId: true,
      userId: true,
      assignedAt: true,
    },
  });
}

/**
 * 담당자 배정. 같은 (shipmentId, stageId, userId) 가 이미 있으면 멱등 처리 (기존 row 반환).
 */
export async function assignToShipment(
  shipmentId: string,
  stage: string,
  userId: string,
): Promise<ActionResult<{ id: string; stageId: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  if (!shipmentId) return fail("shipmentId가 필요합니다.");
  if (!stage) return fail("stage가 필요합니다.");
  if (!userId) return fail("userId가 필요합니다.");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ship = await tx.shipment.findUnique({
        where: { id: shipmentId },
        select: { id: true, orderId: true },
      });
      if (!ship) throw new AssigneeError("존재하지 않는 출고입니다.");

      const stageCol = await resolveStageId(tx, stage);
      if (!stageCol)
        throw new AssigneeError(
          `존재하지 않는 칸반 단계입니다: ${stage}`,
        );

      // 멱등 처리 — 이미 같은 (shipment, stage, user) 가 있으면 그대로 반환
      const existing = await tx.shipmentAssignee.findUnique({
        where: {
          shipmentId_stageId_userId: {
            shipmentId,
            stageId: stageCol.id,
            userId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        return {
          id: existing.id,
          stageId: stageCol.id,
          stageKey: stageCol.key,
          orderId: ship.orderId,
          deduped: true,
        };
      }

      const created = await tx.shipmentAssignee.create({
        data: {
          shipmentId,
          stageId: stageCol.id,
          userId,
        },
        select: { id: true },
      });

      return {
        id: created.id,
        stageId: stageCol.id,
        stageKey: stageCol.key,
        orderId: ship.orderId,
        deduped: false,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "SHIPMENT_ASSIGNEE_ADD",
      resource: `Shipment:${shipmentId}`,
      metadata: {
        assigneeId: result.id,
        stageId: result.stageId,
        stageKey: result.stageKey,
        userId,
        orderId: result.orderId,
        deduped: result.deduped,
      },
    });

    revalidatePath("/qc/shipments");
    revalidatePath("/admin/shipments");
    return ok({ id: result.id, stageId: result.stageId });
  } catch (err) {
    if (err instanceof AssigneeError) return fail(err.message);
    // Prisma P2003 — 외래키 위반 (예: userId 가 public.User 에 없음).
    // cross-schema 라 DB 제약이 걸리지는 않지만, 잡으면 친절한 메시지 반환.
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2003")
        return fail("존재하지 않는 사용자입니다.");
      if (err.code === "P2002")
        return fail("이미 배정된 담당자입니다.");
    }
    throw err;
  }
}

/**
 * 담당자 배정 해제 (id 기반).
 */
export async function removeAssignee(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");
  if (!id) return fail("id가 필요합니다.");

  try {
    const existing = await prisma.shipmentAssignee.findUnique({
      where: { id },
      select: {
        id: true,
        shipmentId: true,
        stageId: true,
        userId: true,
        shipment: { select: { orderId: true } },
      },
    });
    if (!existing) return fail("존재하지 않는 배정입니다.");

    await prisma.shipmentAssignee.delete({ where: { id } });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "SHIPMENT_ASSIGNEE_REMOVE",
      resource: `Shipment:${existing.shipmentId}`,
      metadata: {
        assigneeId: id,
        stageId: existing.stageId,
        userId: existing.userId,
        orderId: existing.shipment.orderId,
      },
    });

    revalidatePath("/qc/shipments");
    revalidatePath("/admin/shipments");
    return ok({ id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return fail("존재하지 않는 배정입니다.");
    }
    throw err;
  }
}

/**
 * 인덱스 (shipmentId + stage + userId) 로 배정 해제 — id 를 모르는 호출자용.
 */
export async function removeAssigneeByStaff(
  shipmentId: string,
  stage: string,
  userId: string,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  if (!shipmentId) return fail("shipmentId가 필요합니다.");
  if (!stage) return fail("stage가 필요합니다.");
  if (!userId) return fail("userId가 필요합니다.");

  const stageCol = await resolveStageId(prisma, stage);
  if (!stageCol) return fail(`존재하지 않는 칸반 단계입니다: ${stage}`);

  const row = await prisma.shipmentAssignee.findUnique({
    where: {
      shipmentId_stageId_userId: {
        shipmentId,
        stageId: stageCol.id,
        userId,
      },
    },
    select: { id: true },
  });
  if (!row) return fail("배정 기록을 찾을 수 없습니다.");

  return removeAssignee(row.id);
}
