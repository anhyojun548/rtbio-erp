"use server";

/**
 * 영업 매출 목표(SalesTarget) 서버 액션 (2026-06-08)
 *
 *  - upsertTarget: 담당자 × 월 × 거래처유형(대리점/병원) 목표 업서트
 *  - computeRepMetrics: 활성 영업 담당자별 {목표(대리점/병원/총), 실매출(분리), 달성률}
 *  - listRepMetrics: 세션 게이트 래퍼
 *
 * 실적 = Invoice(ISSUED+SENT) 매출을 거래처 type 으로 분리 집계 (대시보드/보고서/원장과 동일 매출 인식).
 * 담당 거래처 규칙 = Client.salesRepId ∪ SalesAssignment{active} (exec.ts 와 동일).
 */
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ok, zodFail, type ActionResult } from "@/lib/action-result";
import { Prisma } from "@prisma/client";
import { monthToRange } from "@/lib/validators/ledger";
import {
  upsertSalesTargetSchema,
  achievementRate,
  type UpsertSalesTargetInput,
} from "@/lib/validators/sales-target";

/** 담당자 관리 거래처 ID 셋 (직접 담당 ∪ 활성 배정) */
async function getClientIdsForRep(salesRepId: string): Promise<string[]> {
  const [direct, assigned] = await Promise.all([
    prisma.client.findMany({ where: { salesRepId, active: true }, select: { id: true } }),
    prisma.salesAssignment.findMany({
      where: { salesRepId, active: true, client: { active: true } },
      select: { clientId: true },
    }),
  ]);
  const set = new Set<string>();
  for (const c of direct) set.add(c.id);
  for (const a of assigned) set.add(a.clientId);
  return [...set];
}

export type RepMetricRow = {
  salesRepId: string;
  name: string;
  email: string;
  role: string;
  clientCount: number;
  agencyCount: number;
  hospitalCount: number;
  targetAgency: number;
  targetHospital: number;
  targetTotal: number;
  actualAgency: number;
  actualHospital: number;
  actualTotal: number;
  rateAgency: number | null;
  rateHospital: number | null;
  rateTotal: number | null;
};

/**
 * 담당자별 목표·실적·달성률 (세션 우회 — smoke/테스트용).
 */
export async function computeRepMetrics(month: string): Promise<RepMetricRow[]> {
  const { start, end } = monthToRange(month);

  const reps = await prisma.user.findMany({
    where: { active: true, role: { in: ["EXEC", "ADMIN", "TENANT_OWNER"] } },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  // 해당 월 전체 목표 로드 → repId 별 {AGENCY, HOSPITAL}
  const targets = await prisma.salesTarget.findMany({ where: { month } });
  const targetMap = new Map<string, { AGENCY: number; HOSPITAL: number }>();
  for (const t of targets) {
    const e = targetMap.get(t.salesRepId) ?? { AGENCY: 0, HOSPITAL: 0 };
    if (t.clientType === "AGENCY") e.AGENCY = Number(t.amount);
    else if (t.clientType === "HOSPITAL") e.HOSPITAL = Number(t.amount);
    targetMap.set(t.salesRepId, e);
  }

  const rows: RepMetricRow[] = [];
  for (const rep of reps) {
    const clientIds = await getClientIdsForRep(rep.id);
    const tgt = targetMap.get(rep.id);
    // 표시 대상: 영업(EXEC) 이거나 · 담당 거래처가 있거나 · 목표가 설정된 경우
    if (rep.role !== "EXEC" && clientIds.length === 0 && !tgt) continue;

    const clients = clientIds.length
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, type: true },
        })
      : [];
    const typeById = new Map(clients.map((c) => [c.id, c.type]));
    let agencyCount = 0;
    let hospitalCount = 0;
    for (const c of clients) {
      if (c.type === "AGENCY") agencyCount++;
      else if (c.type === "HOSPITAL") hospitalCount++;
    }

    const invoices = clientIds.length
      ? await prisma.invoice.findMany({
          where: {
            clientId: { in: clientIds },
            issueDate: { gte: start, lt: end },
            status: { in: ["ISSUED", "SENT"] },
          },
          select: { clientId: true, totalAmount: true },
        })
      : [];
    let actualAgency = 0;
    let actualHospital = 0;
    let actualTotal = 0;
    for (const inv of invoices) {
      const amt = Number(inv.totalAmount ?? 0);
      actualTotal += amt;
      const t = typeById.get(inv.clientId);
      if (t === "AGENCY") actualAgency += amt;
      else if (t === "HOSPITAL") actualHospital += amt;
    }

    const targetAgency = tgt?.AGENCY ?? 0;
    const targetHospital = tgt?.HOSPITAL ?? 0;
    const targetTotal = targetAgency + targetHospital;

    rows.push({
      salesRepId: rep.id,
      name: rep.name,
      email: rep.email,
      role: rep.role,
      clientCount: clientIds.length,
      agencyCount,
      hospitalCount,
      targetAgency,
      targetHospital,
      targetTotal,
      actualAgency,
      actualHospital,
      actualTotal,
      rateAgency: achievementRate(actualAgency, targetAgency),
      rateHospital: achievementRate(actualHospital, targetHospital),
      rateTotal: achievementRate(actualTotal, targetTotal),
    });
  }

  rows.sort(
    (a, b) =>
      b.actualTotal - a.actualTotal || a.name.localeCompare(b.name, "ko"),
  );
  return rows;
}

/**
 * 세션 게이트 — 영업/관리진이 담당자별 지표 조회.
 */
export async function listRepMetrics(month: string): Promise<RepMetricRow[]> {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  return computeRepMetrics(month);
}

/**
 * 목표 업서트 — (담당자, 월, 유형) 고유키.
 */
export async function upsertTarget(
  input: UpsertSalesTargetInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const parsed = upsertSalesTargetSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const row = await prisma.salesTarget.upsert({
    where: {
      salesRepId_month_clientType: {
        salesRepId: d.salesRepId,
        month: d.month,
        clientType: d.clientType,
      },
    },
    create: {
      salesRepId: d.salesRepId,
      month: d.month,
      clientType: d.clientType,
      amount: d.amount,
      createdBy: user.id,
    },
    update: { amount: d.amount },
    select: { id: true },
  });

  await logAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "SALES_TARGET_UPSERT",
    resource: `SalesTarget:${d.salesRepId}:${d.month}:${d.clientType}`,
    metadata: { amount: d.amount } as Prisma.InputJsonValue,
  });
  revalidatePath("/exec");
  return ok(row);
}
