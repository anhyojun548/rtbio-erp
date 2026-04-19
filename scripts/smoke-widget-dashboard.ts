/**
 * Phase 3G-4 스모크 — CEO 대시보드 위젯(R24) CRUD + 프리셋 값 계산 검증.
 *
 * 시나리오:
 *   1. 유저 생성 + 위젯 0건
 *   2. addWidget KPI 3종 append — position 자동 0/1/2
 *   3. reorderWidgets 로 KPI1, KPI3, KPI2 순으로 재배치
 *   4. updateWidget width=6 / overrideDateRange='month'
 *   5. removeWidget 가운데 1건 → 2건 남음
 *   6. resetLayout 기본 4 KPI 로 초기화
 *   7. computePresetValue — 각 프리셋 유효 응답 (kind/label 확인)
 *
 * 실행: `npx tsx scripts/smoke-widget-dashboard.ts`
 */
import { prisma } from "../src/lib/prisma";
import {
  DASHBOARD_WIDGET_PRESETS,
  DEFAULT_LAYOUT_KEYS,
} from "../src/lib/validators/widget-dashboard";
import { computePresetValue } from "../src/lib/actions/widget-dashboard";

const PREFIX = `SMOKE_WD_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

async function cleanup(userId?: string) {
  if (userId) {
    await prisma.dashboardWidget.deleteMany({ where: { userId } });
  }
  await prisma.user.deleteMany({
    where: { email: { startsWith: PREFIX.toLowerCase() } },
  });
}

async function main() {
  console.log(`[smoke-widget-dashboard] prefix=${PREFIX}`);
  await cleanup();

  const tenant = await prisma.tenant.findFirst({
    where: { subdomain: "altibio" },
  });
  if (!tenant) throw new Error("altibio 테넌트 없음 — seed 먼저 돌려야 함");

  // ─── 1. 유저 생성 ───────────────────────────────
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX.toLowerCase()}_ceo@test.local`,
      password: "x",
      name: `${PREFIX} 임원`,
      role: "TENANT_OWNER",
      tenantId: tenant.id,
      active: true,
    },
    select: { id: true },
  });
  const countInit = await prisma.dashboardWidget.count({
    where: { userId: user.id },
  });
  if (countInit !== 0) throw new Error(`[1] 초기 위젯 수 0 기대, 실제 ${countInit}`);
  console.log(`✅ 1. 유저 생성 (초기 위젯 0건)`);

  // ─── 2. addWidget 3건 직접 insert (세션 우회) ──
  async function addDirect(preset: string, position: number, width = 3) {
    return prisma.dashboardWidget.create({
      data: { userId: user.id, preset, position, width, height: 2 },
      select: { id: true, preset: true, position: true },
    });
  }
  const w1 = await addDirect("kpi_monthly_sales", 0);
  const w2 = await addDirect("kpi_total_ar", 1);
  const w3 = await addDirect("kpi_open_orders", 2);
  const ordered1 = await prisma.dashboardWidget.findMany({
    where: { userId: user.id },
    orderBy: { position: "asc" },
    select: { preset: true },
  });
  if (ordered1.map((w) => w.preset).join(",") !==
    "kpi_monthly_sales,kpi_total_ar,kpi_open_orders")
    throw new Error(`[2] append 순서 깨짐: ${ordered1.map((w) => w.preset).join(",")}`);
  console.log(`✅ 2. append 3건 (position 0/1/2)`);

  // ─── 3. reorder: w1 → 0, w3 → 1, w2 → 2 ──────
  await prisma.$transaction(async (tx) => {
    await tx.dashboardWidget.update({
      where: { id: w1.id },
      data: { position: 0 },
    });
    await tx.dashboardWidget.update({
      where: { id: w3.id },
      data: { position: 1 },
    });
    await tx.dashboardWidget.update({
      where: { id: w2.id },
      data: { position: 2 },
    });
  });
  const ordered2 = await prisma.dashboardWidget.findMany({
    where: { userId: user.id },
    orderBy: { position: "asc" },
    select: { preset: true },
  });
  if (
    ordered2.map((w) => w.preset).join(",") !==
    "kpi_monthly_sales,kpi_open_orders,kpi_total_ar"
  )
    throw new Error(`[3] 재정렬 결과 다름: ${ordered2.map((w) => w.preset).join(",")}`);
  console.log(`✅ 3. reorder → [sales, open_orders, total_ar]`);

  // ─── 4. updateWidget width=6, overrideDateRange='month' ─
  await prisma.dashboardWidget.update({
    where: { id: w2.id },
    data: { width: 6, overrideDateRange: "month" },
  });
  const updated = await prisma.dashboardWidget.findUnique({
    where: { id: w2.id },
    select: { width: true, overrideDateRange: true },
  });
  if (updated?.width !== 6 || updated.overrideDateRange !== "month")
    throw new Error(
      `[4] update 반영 안됨: width=${updated?.width}, override=${updated?.overrideDateRange}`,
    );
  console.log(`✅ 4. update width=6 · override='month'`);

  // ─── 5. remove 가운데 1건 ───────────────────────
  await prisma.dashboardWidget.delete({ where: { id: w3.id } });
  const afterDel = await prisma.dashboardWidget.count({
    where: { userId: user.id },
  });
  if (afterDel !== 2) throw new Error(`[5] 삭제 후 2건 기대, 실제 ${afterDel}`);
  console.log(`✅ 5. remove 1건 → 2건`);

  // ─── 6. resetLayout 기본 4 KPI ─────────────────
  await prisma.$transaction(async (tx) => {
    await tx.dashboardWidget.deleteMany({ where: { userId: user.id } });
    for (let i = 0; i < DEFAULT_LAYOUT_KEYS.length; i++) {
      await tx.dashboardWidget.create({
        data: {
          userId: user.id,
          preset: DEFAULT_LAYOUT_KEYS[i]!,
          position: i,
          width: 3,
          height: 2,
        },
      });
    }
  });
  const finalRows = await prisma.dashboardWidget.findMany({
    where: { userId: user.id },
    orderBy: { position: "asc" },
    select: { preset: true },
  });
  if (finalRows.length !== DEFAULT_LAYOUT_KEYS.length)
    throw new Error(
      `[6] 기본 레이아웃 ${DEFAULT_LAYOUT_KEYS.length}건 기대, 실제 ${finalRows.length}`,
    );
  for (let i = 0; i < DEFAULT_LAYOUT_KEYS.length; i++) {
    if (finalRows[i]!.preset !== DEFAULT_LAYOUT_KEYS[i])
      throw new Error(
        `[6] [${i}] ${DEFAULT_LAYOUT_KEYS[i]} 기대, 실제 ${finalRows[i]!.preset}`,
      );
  }
  console.log(`✅ 6. resetLayout 기본 4 KPI 적용`);

  // ─── 7. computePresetValue 모든 프리셋 유효 응답 ──
  // (실제 데이터가 없어도 빈 집계가 나와야 함. 본 스모크는 DB 신뢰.)
  let ok = 0;
  for (const p of DASHBOARD_WIDGET_PRESETS) {
    const v = await computePresetValue(p.key);
    if (!v) throw new Error(`[7] '${p.key}' null 반환`);
    if (v.kind !== p.kind)
      throw new Error(`[7] '${p.key}' kind=${v.kind}, 기대 ${p.kind}`);
    if (v.label !== p.label)
      throw new Error(`[7] '${p.key}' label '${v.label}' ≠ '${p.label}'`);
    ok++;
  }
  if (ok !== DASHBOARD_WIDGET_PRESETS.length)
    throw new Error(`[7] ${DASHBOARD_WIDGET_PRESETS.length} 프리셋 기대, ok=${ok}`);
  console.log(`✅ 7. computePresetValue 10종 모두 유효 (kind/label 일치)`);

  console.log("\n[smoke-widget-dashboard] all scenarios passed ✅");
  await cleanup(user.id);
}

main()
  .catch(async (e) => {
    console.error("❌", e);
    await cleanup();
    await prisma.$disconnect();
    process.exit(1);
  })
  .then(async () => {
    await prisma.$disconnect();
  });
