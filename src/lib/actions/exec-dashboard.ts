"use server";

/**
 * 영업 대시보드 매출 요약 (2026-06-08, Phase 2)
 *
 * 한 번의 호출로 영업 대시보드가 필요한 매출 지표를 반환:
 *   - 월/주간/일 매출 (Invoice ISSUED+SENT)
 *   - 대리점/병원 분리 (이번 달)
 *   - 목표 대비 (SalesTarget, 로그인 담당자 또는 팀 전체)
 *   - 최근 7일 추이 — 날짜별 금액/건수/수량/품목종류수
 *
 * 스코프: EXEC = 본인 담당 거래처 / ADMIN·TENANT_OWNER = 팀 전체(또는 forUserId 지정 시 그 담당자).
 * 매출 인식 = 거래명세서(issueDate) — 대시보드 상단 카드·직원별 지표와 동일.
 */
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { monthToRange } from "@/lib/validators/ledger";
import { achievementRate } from "@/lib/validators/sales-target";
import { Prisma } from "@prisma/client";

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

function kstYmd(d: Date): string {
  return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
function kstMidnight(ymd: string): Date {
  return new Date(ymd + "T00:00:00+09:00");
}

export type DayPoint = { date: string; amount: number; count: number; qty: number; kinds: number };
export type ExecSalesSummary = {
  scope: "rep" | "team";
  anchorDate: string; // 최신 거래 일자 (YYYY-MM-DD)
  month: string; // YYYY-MM
  monthSales: number;
  weekSales: number; // 최근 7일
  daySales: number; // anchorDate 당일
  agencySales: number; // 이번 달 대리점
  hospitalSales: number; // 이번 달 병원
  target: { total: number; agency: number; hospital: number };
  rate: { total: number | null; agency: number | null; hospital: number | null };
  last7: DayPoint[];
};

export async function getExecSalesSummary(
  opts: { forUserId?: string } = {},
): Promise<ExecSalesSummary> {
  const me = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");

  // 스코프 결정
  let clientIds: string[] | null;
  let scope: "rep" | "team";
  let targetRepId: string | null;
  if (me.role === "EXEC") {
    clientIds = await getClientIdsForRep(me.id);
    scope = "rep";
    targetRepId = me.id;
  } else if (opts.forUserId) {
    clientIds = await getClientIdsForRep(opts.forUserId);
    scope = "rep";
    targetRepId = opts.forUserId;
  } else {
    clientIds = null; // 전체
    scope = "team";
    targetRepId = null;
  }

  const baseWhere: Prisma.InvoiceWhereInput = { status: { in: ["ISSUED", "SENT"] } };
  if (clientIds) baseWhere.clientId = { in: clientIds.length ? clientIds : ["__none__"] };

  // anchor = 최신 거래명세서 발행일 (없으면 KST 오늘)
  const latest = await prisma.invoice.findFirst({
    where: baseWhere,
    orderBy: { issueDate: "desc" },
    select: { issueDate: true },
  });
  const anchor = latest?.issueDate ?? new Date();
  const anchorYmd = kstYmd(anchor);
  const month = anchorYmd.slice(0, 7);

  // 범위
  const { start: monthStart, end: monthEnd } = monthToRange(month);
  const dayStart = kstMidnight(anchorYmd);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const weekStart = new Date(dayEnd.getTime() - 7 * 86400000); // [anchor-6d 00:00, anchor+1d 00:00)

  // 이번 달 매출 + 대리점/병원 분리 (clientId+type 조인)
  const monthInvoices = await prisma.invoice.findMany({
    where: { ...baseWhere, issueDate: { gte: monthStart, lt: monthEnd } },
    select: { clientId: true, totalAmount: true, client: { select: { type: true } } },
  });
  let monthSales = 0;
  let agencySales = 0;
  let hospitalSales = 0;
  for (const inv of monthInvoices) {
    const amt = Number(inv.totalAmount ?? 0);
    monthSales += amt;
    if (inv.client?.type === "AGENCY") agencySales += amt;
    else if (inv.client?.type === "HOSPITAL") hospitalSales += amt;
  }

  // 최근 7일 (일자별 금액/건수/수량/품목종류)
  const weekInvoices = await prisma.invoice.findMany({
    where: { ...baseWhere, issueDate: { gte: weekStart, lt: dayEnd } },
    select: {
      issueDate: true,
      totalAmount: true,
      items: { select: { quantity: true, description: true } },
    },
  });
  const dayMap = new Map<string, { amount: number; count: number; qty: number; kinds: Set<string> }>();
  for (let i = 6; i >= 0; i--) {
    const d = kstYmd(new Date(dayEnd.getTime() - (i + 1) * 86400000));
    dayMap.set(d, { amount: 0, count: 0, qty: 0, kinds: new Set() });
  }
  let weekSales = 0;
  let daySales = 0;
  for (const inv of weekInvoices) {
    const d = kstYmd(inv.issueDate);
    const amt = Number(inv.totalAmount ?? 0);
    weekSales += amt;
    if (d === anchorYmd) daySales += amt;
    const bucket = dayMap.get(d);
    if (bucket) {
      bucket.amount += amt;
      bucket.count += 1;
      for (const it of inv.items) {
        bucket.qty += it.quantity;
        if (it.description) bucket.kinds.add(it.description);
      }
    }
  }
  const last7: DayPoint[] = [...dayMap.entries()].map(([date, b]) => ({
    date,
    amount: b.amount,
    count: b.count,
    qty: b.qty,
    kinds: b.kinds.size,
  }));

  // 목표 (SalesTarget) — rep 또는 팀 전체
  const targetWhere: Prisma.SalesTargetWhereInput = { month };
  if (targetRepId) targetWhere.salesRepId = targetRepId;
  const targets = await prisma.salesTarget.findMany({ where: targetWhere });
  let tAgency = 0;
  let tHospital = 0;
  for (const t of targets) {
    if (t.clientType === "AGENCY") tAgency += Number(t.amount);
    else if (t.clientType === "HOSPITAL") tHospital += Number(t.amount);
  }
  const tTotal = tAgency + tHospital;

  return {
    scope,
    anchorDate: anchorYmd,
    month,
    monthSales,
    weekSales,
    daySales,
    agencySales,
    hospitalSales,
    target: { total: tTotal, agency: tAgency, hospital: tHospital },
    rate: {
      total: achievementRate(monthSales, tTotal),
      agency: achievementRate(agencySales, tAgency),
      hospital: achievementRate(hospitalSales, tHospital),
    },
    last7,
  };
}
