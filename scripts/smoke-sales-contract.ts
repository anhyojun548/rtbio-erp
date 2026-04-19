/**
 * Phase 3G-2 스모크 — SalesContract CRUD + classifyContract 경계.
 *
 * 시나리오:
 *   1. 거래처 C × 4건 계약 생성 (ACTIVE · ENDING_SOON · EXPIRED · FUTURE)
 *   2. classifyContract 로 4단계 분류 확인
 *   3. signed 업데이트 → 재조회
 *   4. endDate → null 로 변경 (무기한 전환) → 상태=ACTIVE
 *   5. 거래처 삭제 시 CASCADE 동작 — 계약서 전체 제거
 *
 * 실행: `npx tsx scripts/smoke-sales-contract.ts`
 */
import { prisma } from "../src/lib/prisma";
import { classifyContract } from "../src/lib/validators/sales-contract";

const PREFIX = `SMOKE_CON_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const now = new Date();
now.setHours(0, 0, 0, 0);

function plusDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function cleanup() {
  // 거래처 기준으로 연관 SalesContract 자동 CASCADE 제거됨.
  await prisma.salesContract.deleteMany({
    where: { title: { startsWith: PREFIX } },
  });
  await prisma.client.deleteMany({
    where: { code: { startsWith: PREFIX } },
  });
}

async function main() {
  console.log(`[smoke-sales-contract] prefix=${PREFIX}`);
  await cleanup();

  // ─── Setup: 테스트용 거래처 1건 ──────────────────────
  const client = await prisma.client.create({
    data: {
      code: `${PREFIX}_C1`,
      name: `${PREFIX} 테스트 거래처`,
      type: "HOSPITAL",
      active: true,
    },
    select: { id: true },
  });
  console.log(`✅ Setup: client=${client.id.slice(0, 6)}`);

  // ─── 1. 4건 계약 생성 (상태별 시나리오 각 1건) ───────
  const contracts = [
    {
      label: "ACTIVE",
      title: `${PREFIX} 장기계약 (1년)`,
      startDate: plusDays(now, -90),
      endDate: plusDays(now, 275),
    },
    {
      label: "ENDING_SOON",
      title: `${PREFIX} 임박계약 (15일)`,
      startDate: plusDays(now, -180),
      endDate: plusDays(now, 15),
    },
    {
      label: "EXPIRED",
      title: `${PREFIX} 만료계약 (어제 종료)`,
      startDate: plusDays(now, -365),
      endDate: plusDays(now, -1),
    },
    {
      label: "FUTURE",
      title: `${PREFIX} 예정계약 (2개월 후)`,
      startDate: plusDays(now, 60),
      endDate: plusDays(now, 425),
    },
  ];
  const created: Record<string, { id: string }> = {};
  for (const c of contracts) {
    const row = await prisma.salesContract.create({
      data: {
        clientId: client.id,
        title: c.title,
        startDate: c.startDate,
        endDate: c.endDate,
        signed: false,
      },
      select: { id: true },
    });
    created[c.label] = row;
  }
  console.log(`✅ 1. 4건 계약 생성 (ACTIVE/ENDING_SOON/EXPIRED/FUTURE)`);

  // ─── 2. classifyContract 상태 4단계 일치 확인 ────────
  for (const c of contracts) {
    const cls = classifyContract(c.startDate, c.endDate, now);
    if (cls.status !== c.label)
      throw new Error(
        `[2] ${c.label} 분류 실패 — 실제 ${cls.status} (daysLeft=${cls.daysLeft})`,
      );
  }
  console.log(`✅ 2. classifyContract 경계 — 4단계 모두 정확`);

  // ─── 3. signed 업데이트 ──────────────────────────────
  const activeId = created.ACTIVE!.id;
  await prisma.salesContract.update({
    where: { id: activeId },
    data: { signed: true },
  });
  const refetch = await prisma.salesContract.findUnique({
    where: { id: activeId },
  });
  if (!refetch?.signed)
    throw new Error(`[3] signed 업데이트 실패 — ${refetch?.signed}`);
  console.log(`✅ 3. signed 토글 ✓`);

  // ─── 4. endDate → null 로 변경 (무기한) ──────────────
  const endingSoonId = created.ENDING_SOON!.id;
  await prisma.salesContract.update({
    where: { id: endingSoonId },
    data: { endDate: null },
  });
  const endingNow = await prisma.salesContract.findUnique({
    where: { id: endingSoonId },
  });
  if (!endingNow) throw new Error(`[4] ENDING_SOON 계약 소실`);
  const cls4 = classifyContract(endingNow.startDate, endingNow.endDate, now);
  if (cls4.status !== "ACTIVE" || cls4.daysLeft !== null)
    throw new Error(
      `[4] 무기한 전환 실패 — status=${cls4.status} daysLeft=${cls4.daysLeft}`,
    );
  console.log(`✅ 4. endDate=null 로 무기한 전환 → status=ACTIVE ✓`);

  // ─── 5. 거래처 삭제 → CASCADE 확인 ───────────────────
  const beforeCount = await prisma.salesContract.count({
    where: { clientId: client.id },
  });
  if (beforeCount !== 4)
    throw new Error(`[5] 삭제 전 4건 기대, 실제 ${beforeCount}`);

  await prisma.client.delete({ where: { id: client.id } });

  const afterCount = await prisma.salesContract.count({
    where: { clientId: client.id },
  });
  if (afterCount !== 0)
    throw new Error(`[5] CASCADE 실패 — 삭제 후 ${afterCount}건 남음`);
  console.log(`✅ 5. Client 삭제 → SalesContract CASCADE 제거 (4→0) ✓`);

  console.log("\n[smoke-sales-contract] all scenarios passed ✅");
}

main()
  .catch(async (e) => {
    console.error("❌", e);
    await cleanup();
    await prisma.$disconnect();
    process.exit(1);
  })
  .then(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
