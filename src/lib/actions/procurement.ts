"use server";

/**
 * 베트남 발주 트래킹 (생산발주 → 항공/선박 분할 입고) — Phase 5
 */
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { z } from "zod";
import type { ProcurementCategory, ProcurementStatus, ShipmentTransport } from "@prisma/client";

const PROC_CATEGORIES = ["FABRIC", "MATERIAL", "PRODUCT"] as const;
const PROC_STATUSES = ["PENDING", "IN_PRODUCTION", "SHIPPING", "PARTIAL", "COMPLETED"] as const;
const SHIPMENT_TRANSPORTS = ["AIR", "SEA"] as const;

// LABEL 상수는 lib/validators/procurement.ts 에 분리 (use server 호환)

const createProjectSchema = z.object({
  title:          z.string().trim().min(1).max(200),
  category:       z.enum(PROC_CATEGORIES),
  orderDate:      z.coerce.date(),
  plannedArrival: z.coerce.date().optional().nullable(),
  totalQty:       z.coerce.number().int().nonnegative(),
  note:           z.string().max(1000).optional().nullable(),
});

const createShipmentSchema = z.object({
  projectId:      z.string().cuid(),
  transport:      z.enum(SHIPMENT_TRANSPORTS),
  qty:            z.coerce.number().int().positive(),
  departureDate:  z.coerce.date().optional().nullable(),
  expectedDate:   z.coerce.date().optional().nullable(),
  trackingNumber: z.string().max(100).optional().nullable(),
  note:           z.string().max(500).optional().nullable(),
});

const recordArrivalSchema = z.object({
  shipmentId:  z.string().cuid(),
  arrivalDate: z.coerce.date(),
});

export async function listProcurementProjects(opts?: {
  category?: ProcurementCategory;
  status?: ProcurementStatus;
  q?: string;
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "SUPER_ADMIN", "EXEC");
  return prisma.procurementProject.findMany({
    where: {
      ...(opts?.category && { category: opts.category }),
      ...(opts?.status && { status: opts.status }),
      ...(opts?.q && {
        OR: [
          { title: { contains: opts.q, mode: "insensitive" } },
          { code:  { contains: opts.q, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      shipments: { orderBy: { departureDate: "asc" } },
    },
    orderBy: { orderDate: "desc" },
    take: 200,
  });
}

export async function createProcurementProject(
  input: z.input<typeof createProjectSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "검증 실패");

  // code 자동 생성: PRJ-YYMM-NN
  const d = parsed.data.orderDate;
  const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const cnt = await prisma.procurementProject.count({
    where: { code: { startsWith: `PRJ-${ym}-` } },
  });
  const code = `PRJ-${ym}-${String(cnt + 1).padStart(2, "0")}`;

  const proj = await prisma.procurementProject.create({
    data: {
      code,
      title:          parsed.data.title,
      category:       parsed.data.category,
      orderDate:      parsed.data.orderDate,
      plannedArrival: parsed.data.plannedArrival,
      totalQty:       parsed.data.totalQty,
      note:           parsed.data.note,
      createdBy:      user.id,
    },
  });
  await logAudit({ action: "PROCUREMENT_CREATE", resource: `ProcurementProject:${proj.id}` });
  revalidatePath("/admin/procurement");
  revalidatePath("/ceo/procurement");
  return ok({ id: proj.id });
}

export async function addProcurementShipment(
  input: z.input<typeof createShipmentSchema>,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = createShipmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "검증 실패");

  const sh = await prisma.procurementShipment.create({ data: parsed.data });

  // 프로젝트 상태 업데이트
  await prisma.procurementProject.update({
    where: { id: parsed.data.projectId },
    data:  { status: "SHIPPING" },
  });

  await logAudit({ action: "PROCUREMENT_SHIPMENT_ADD", resource: `ProcurementShipment:${sh.id}` });
  revalidatePath("/admin/procurement");
  return ok({ id: sh.id });
}

export async function recordShipmentArrival(
  input: z.input<typeof recordArrivalSchema>,
): Promise<ActionResult<{ id: string }>> {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  const parsed = recordArrivalSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "검증 실패");

  const sh = await prisma.procurementShipment.update({
    where: { id: parsed.data.shipmentId },
    data:  { arrivalDate: parsed.data.arrivalDate },
    include: { project: { include: { shipments: true } } },
  });

  // 프로젝트 receivedQty / status 재계산
  const arrivedQty = sh.project.shipments
    .map((s) => (s.id === sh.id ? sh.qty : s.arrivalDate ? s.qty : 0))
    .reduce((a, b) => a + b, 0);

  const nextStatus: ProcurementStatus =
    arrivedQty >= sh.project.totalQty ? "COMPLETED" :
    arrivedQty > 0                    ? "PARTIAL"   :
    "SHIPPING";

  await prisma.procurementProject.update({
    where: { id: sh.projectId },
    data:  { receivedQty: arrivedQty, status: nextStatus },
  });

  await logAudit({ action: "PROCUREMENT_ARRIVAL", resource: `ProcurementShipment:${sh.id}` });
  revalidatePath("/admin/procurement");
  return ok({ id: sh.id });
}
