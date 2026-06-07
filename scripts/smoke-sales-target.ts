/**
 * 영업 매출 목표(SalesTarget) 스모크 — 실 DB.
 *
 * computeRepMetrics 는 requireRole 없는 순수 집계라 직접 호출 가능. upsert 는 prisma 로 재현.
 *
 * 시나리오:
 *   1. rep + 대리점/병원 거래처 + Invoice(ISSUED 30M·SENT 17.85M·DRAFT 9.99M 제외) 생성
 *   2. 목표 upsert 대리점 50M · 병원 18M (unique[rep,month,type])
 *   3. computeRepMetrics: actual 대리점 30M/병원 17.85M/총 47.85M, target 50M/18M/68M
 *      달성률 대리점 60 · 병원 99.2 · 총 70.4, DRAFT 제외
 *   4. upsert 업데이트(대리점 50M→55M) → 행 1개 유지, target 갱신
 *
 * 실행: `npx tsx scripts/smoke-sales-target.ts`
 */
import { prisma } from "../src/lib/prisma";
import { computeRepMetrics } from "../src/lib/actions/sales-target";

const PREFIX = `SMOKE_TGT_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const MONTH = "2026-06";

let failed = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failed++;
    console.error(`  ✗ ${label}`, extra ?? "");
  }
}

async function cleanup(repId?: string, clientIds: string[] = []) {
  if (clientIds.length) {
    await prisma.invoice.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  }
  if (repId) {
    await prisma.salesTarget.deleteMany({ where: { salesRepId: repId } });
    await prisma.user.deleteMany({ where: { id: repId } });
  }
}

async function main() {
  console.log(`[smoke-sales-target] prefix=${PREFIX}`);
  const tenant = await prisma.tenant.findFirst({ where: { subdomain: "altibio" } });
  if (!tenant) throw new Error("altibio 테넌트 없음 — seed 먼저");

  const rep = await prisma.user.create({
    data: {
      email: `${PREFIX.toLowerCase()}@test.local`,
      password: "x",
      name: `${PREFIX} 영업담당`,
      role: "EXEC",
      tenantId: tenant.id,
      active: true,
    },
    select: { id: true },
  });

  const agency = await prisma.client.create({
    data: { code: `${PREFIX}_A`, name: `${PREFIX} 대리점`, type: "AGENCY", salesRepId: rep.id, active: true },
    select: { id: true },
  });
  const hospital = await prisma.client.create({
    data: { code: `${PREFIX}_H`, name: `${PREFIX} 병원`, type: "HOSPITAL", salesRepId: rep.id, active: true },
    select: { id: true },
  });
  const clientIds = [agency.id, hospital.id];

  const issueDate = new Date("2026-06-15T12:00:00Z");
  const mkInv = (clientId: string, total: number, status: "ISSUED" | "SENT" | "DRAFT", n: string) =>
    prisma.invoice.create({
      data: {
        invoiceNumber: `${PREFIX}-${n}`,
        clientId,
        issueDate,
        supplyAmount: total.toString(),
        vatAmount: "0",
        totalAmount: total.toString(),
        status,
      },
    });

  try {
    await mkInv(agency.id, 30_000_000, "ISSUED", "A1");
    await mkInv(hospital.id, 17_850_000, "SENT", "H1");
    await mkInv(agency.id, 9_990_000, "DRAFT", "A2"); // 제외 대상

    // 목표 upsert (prisma 로 액션 재현)
    const upsertTgt = (clientType: "AGENCY" | "HOSPITAL", amount: number) =>
      prisma.salesTarget.upsert({
        where: { salesRepId_month_clientType: { salesRepId: rep.id, month: MONTH, clientType } },
        create: { salesRepId: rep.id, month: MONTH, clientType, amount, createdBy: "smoke" },
        update: { amount },
        select: { id: true },
      });
    await upsertTgt("AGENCY", 50_000_000);
    await upsertTgt("HOSPITAL", 18_000_000);

    const rows = await computeRepMetrics(MONTH);
    const me = rows.find((r) => r.salesRepId === rep.id);
    check("내 rep 행 존재", !!me, rows.length);
    if (me) {
      check("targetAgency 50,000,000", me.targetAgency === 50_000_000, me.targetAgency);
      check("targetHospital 18,000,000", me.targetHospital === 18_000_000, me.targetHospital);
      check("targetTotal 68,000,000", me.targetTotal === 68_000_000, me.targetTotal);
      check("actualAgency 30,000,000 (DRAFT 제외)", me.actualAgency === 30_000_000, me.actualAgency);
      check("actualHospital 17,850,000", me.actualHospital === 17_850_000, me.actualHospital);
      check("actualTotal 47,850,000", me.actualTotal === 47_850_000, me.actualTotal);
      check("rateAgency 60", me.rateAgency === 60, me.rateAgency);
      check("rateHospital 99.2", me.rateHospital === 99.2, me.rateHospital);
      check("rateTotal 70.4", me.rateTotal === 70.4, me.rateTotal);
      check("agencyCount 1 / hospitalCount 1", me.agencyCount === 1 && me.hospitalCount === 1, [me.agencyCount, me.hospitalCount]);
    }

    // upsert 업데이트 — 대리점 50M → 55M
    await upsertTgt("AGENCY", 55_000_000);
    const cnt = await prisma.salesTarget.count({ where: { salesRepId: rep.id, month: MONTH, clientType: "AGENCY" } });
    check("AGENCY 목표 행 1개 유지(업데이트)", cnt === 1, cnt);
    const rows2 = await computeRepMetrics(MONTH);
    const me2 = rows2.find((r) => r.salesRepId === rep.id);
    check("targetAgency 55,000,000 갱신", me2?.targetAgency === 55_000_000, me2?.targetAgency);
  } finally {
    await cleanup(rep.id, clientIds);
  }

  console.log(failed === 0 ? "\n[smoke-sales-target] ✅ ALL PASS" : `\n[smoke-sales-target] ❌ ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
