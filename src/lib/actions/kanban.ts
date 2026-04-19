/**
 * 칸반 단계(KanbanColumn) Server Actions — Phase 3E-1 (R05).
 *
 * - listKanbanColumns 는 shipment.ts 에 이미 존재 (보드 렌더용). 여기선 관리용 CRUD 만.
 * - 삭제 가드: 해당 단계를 `currentStage` 로 참조하는 Shipment 가 있으면 거부.
 *   (prisma 의 onDelete: Restrict 로도 보호되지만, 앱 레이어에서 한글 에러 반환)
 * - reorder 는 tx 안에서 bulk update — `id` 로 매칭해 sortOrder 만 변경.
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
  createKanbanColumnSchema,
  updateKanbanColumnSchema,
  reorderKanbanColumnsSchema,
  type CreateKanbanColumnInput,
  type UpdateKanbanColumnInput,
  type ReorderKanbanColumnsInput,
} from "@/lib/validators/kanban";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

class KanbanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KanbanError";
  }
}

/**
 * 관리 페이지용 목록 — 사용량(각 단계에 걸린 shipment 수) 포함.
 */
export async function listKanbanColumnsWithUsage() {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.kanbanColumn.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { shipments: true } },
    },
  });
}

// ─── 생성 ─────────────────────────────────────────────────

export async function createKanbanColumn(
  input: CreateKanbanColumnInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = createKanbanColumnSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    // 중복 key 앱 레벨 가드 (DB 의 unique constraint 로도 보호되지만 한글 메시지)
    const dup = await prisma.kanbanColumn.findUnique({
      where: { key: data.key },
    });
    if (dup)
      throw new KanbanError(`이미 사용 중인 key 입니다: ${data.key}`);

    const created = await prisma.kanbanColumn.create({
      data: {
        key: data.key,
        label: data.label,
        sortOrder: data.sortOrder,
        isTerminal: data.isTerminal ?? false,
        color: data.color ?? null,
        createdBy: user.id,
      },
      select: { id: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "KANBAN_COLUMN_CREATE",
      resource: `KanbanColumn:${created.id}`,
      metadata: {
        key: data.key,
        label: data.label,
        sortOrder: data.sortOrder,
      },
    });

    revalidatePath("/admin/shipments");
    revalidatePath("/admin/shipments/columns");
    return ok(created);
  } catch (e) {
    if (e instanceof KanbanError) return fail(e.message);
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    )
      return fail("이미 사용 중인 key 입니다.");
    throw e;
  }
}

// ─── 수정 ─────────────────────────────────────────────────

export async function updateKanbanColumn(
  id: string,
  input: UpdateKanbanColumnInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = updateKanbanColumnSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const cur = await prisma.kanbanColumn.findUnique({ where: { id } });
    if (!cur) throw new KanbanError("존재하지 않는 단계입니다.");

    await prisma.kanbanColumn.update({
      where: { id },
      data: {
        label: data.label ?? undefined,
        sortOrder: data.sortOrder ?? undefined,
        isTerminal: data.isTerminal ?? undefined,
        color: data.color !== undefined ? data.color : undefined,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "KANBAN_COLUMN_UPDATE",
      resource: `KanbanColumn:${id}`,
      metadata: data as Prisma.InputJsonValue,
    });

    revalidatePath("/admin/shipments");
    revalidatePath("/admin/shipments/columns");
    return ok({ id });
  } catch (e) {
    if (e instanceof KanbanError) return fail(e.message);
    throw e;
  }
}

// ─── 삭제 ─────────────────────────────────────────────────

export async function deleteKanbanColumn(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  try {
    const col = await prisma.kanbanColumn.findUnique({
      where: { id },
      include: { _count: { select: { shipments: true } } },
    });
    if (!col) throw new KanbanError("존재하지 않는 단계입니다.");
    if (col._count.shipments > 0)
      throw new KanbanError(
        `해당 단계에 ${col._count.shipments}건의 출고가 연결되어 있어 삭제할 수 없습니다.`,
      );

    await prisma.kanbanColumn.delete({ where: { id } });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "KANBAN_COLUMN_DELETE",
      resource: `KanbanColumn:${id}`,
      metadata: { key: col.key, label: col.label },
    });

    revalidatePath("/admin/shipments");
    revalidatePath("/admin/shipments/columns");
    return ok({ id });
  } catch (e) {
    if (e instanceof KanbanError) return fail(e.message);
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2003"
    )
      return fail("이 단계를 참조하는 Shipment 가 있어 삭제할 수 없습니다.");
    throw e;
  }
}

// ─── 재정렬 ─────────────────────────────────────────────────

export async function reorderKanbanColumns(
  input: ReorderKanbanColumnsInput,
): Promise<ActionResult<{ count: number }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = reorderKanbanColumnsSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { items } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 존재 검증
      const found = await tx.kanbanColumn.findMany({
        where: { id: { in: items.map((i) => i.id) } },
        select: { id: true },
      });
      if (found.length !== items.length)
        throw new KanbanError("일부 단계가 존재하지 않습니다.");

      for (const it of items) {
        await tx.kanbanColumn.update({
          where: { id: it.id },
          data: { sortOrder: it.sortOrder },
        });
      }
      return items.length;
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "KANBAN_COLUMN_REORDER",
      resource: `KanbanColumn:bulk(${items.length})`,
      metadata: { items } as Prisma.InputJsonValue,
    });

    revalidatePath("/admin/shipments");
    revalidatePath("/admin/shipments/columns");
    return ok({ count: result });
  } catch (e) {
    if (e instanceof KanbanError) return fail(e.message);
    throw e;
  }
}
