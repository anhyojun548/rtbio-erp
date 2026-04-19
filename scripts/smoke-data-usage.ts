/**
 * Phase 3G-1 스모크 — DataUsage CRUD + upsert + 월 비교.
 *
 * 시나리오:
 *   1. 2026-03, 2026-04 2개월에 걸쳐 3개 카테고리 (서버/스토리지/이메일) 생성
 *   2. 동일 month+category 중복 생성 시 P2002 에러 (createDataUsage 동작 재현)
 *   3. upsertDataUsage 는 중복 시 amount 덮어쓰기
 *   4. getMonthSummary(2026-04) → 카테고리별 합·행 수
 *   5. getMonthWithPrev(2026-04) 비교 — 서버 당월/전월, 신규 카테고리, 누락 카테고리
 *   6. delete 후 재조회
 *
 * 실행: `npx tsx scripts/smoke-data-usage.ts`
 */
import { prisma } from "../src/lib/prisma";
import { Prisma } from "@prisma/client";
import { prevMonthString } from "../src/lib/validators/data-usage";

const PREFIX = `SMOKE_DU_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// 스모크 격리를 위해 category 에 PREFIX 를 붙여 사용.
const CAT_SERVER = `${PREFIX}_서버`;
const CAT_STORAGE = `${PREFIX}_스토리지`;
const CAT_EMAIL = `${PREFIX}_이메일`;
const CAT_NEW = `${PREFIX}_CDN`;

const MONTH_CURR = "2026-04";
const MONTH_PREV = prevMonthString(MONTH_CURR); // "2026-03"

async function cleanup() {
  await prisma.dataUsage.deleteMany({
    where: { category: { startsWith: PREFIX } },
  });
}

async function getMonthSummary(month: string) {
  const rows = await prisma.dataUsage.findMany({
    where: { month, category: { startsWith: PREFIX } },
    orderBy: { category: "asc" },
  });
  const byCategory = new Map<string, { amount: number; unit: string; count: number }>();
  for (const r of rows) {
    const amount = Number(r.amount);
    const prev = byCategory.get(r.category);
    byCategory.set(r.category, {
      amount: (prev?.amount ?? 0) + amount,
      unit: r.unit,
      count: (prev?.count ?? 0) + 1,
    });
  }
  return {
    rows: rows.map((r) => ({ ...r, amount: Number(r.amount) })),
    byCategory: Array.from(byCategory.entries()).map(([category, v]) => ({
      category,
      ...v,
    })),
    totalRows: rows.length,
  };
}

async function getMonthWithPrev(month: string) {
  const prevM = prevMonthString(month);
  const [curr, prev] = await Promise.all([
    prisma.dataUsage.findMany({
      where: { month, category: { startsWith: PREFIX } },
    }),
    prisma.dataUsage.findMany({
      where: { month: prevM, category: { startsWith: PREFIX } },
    }),
  ]);
  const currMap = new Map(curr.map((r) => [r.category, Number(r.amount)]));
  const prevMap = new Map(prev.map((r) => [r.category, Number(r.amount)]));
  const allCats = new Set([...currMap.keys(), ...prevMap.keys()]);
  return Array.from(allCats)
    .sort()
    .map((c) => ({
      category: c,
      current: currMap.get(c) ?? null,
      previous: prevMap.get(c) ?? null,
    }));
}

async function main() {
  console.log(`[smoke-data-usage] prefix=${PREFIX}`);
  await cleanup();

  // ─── 1. 2개월 × 3카테고리 = 6건 ─────────────────────
  const fixtures: Array<{ month: string; category: string; unit: string; amount: number }> = [
    { month: MONTH_PREV, category: CAT_SERVER, unit: "GB", amount: 100 },
    { month: MONTH_PREV, category: CAT_STORAGE, unit: "GB", amount: 50 },
    { month: MONTH_PREV, category: CAT_EMAIL, unit: "건", amount: 800 },
    { month: MONTH_CURR, category: CAT_SERVER, unit: "GB", amount: 120 },
    { month: MONTH_CURR, category: CAT_STORAGE, unit: "GB", amount: 45 },
    // CAT_EMAIL 은 당월에 없음 (누락 검증용)
    { month: MONTH_CURR, category: CAT_NEW, unit: "GB", amount: 20 }, // 신규
  ];

  for (const f of fixtures) {
    await prisma.dataUsage.create({
      data: {
        month: f.month,
        category: f.category,
        unit: f.unit,
        amount: new Prisma.Decimal(f.amount),
      },
    });
  }
  console.log(`✅ 1. 6건 생성 (전월 3 · 당월 3, 당월에는 이메일 누락·CDN 신규)`);

  // ─── 2. P2002 중복 가드 ──────────────────────────────
  let duplicated = false;
  try {
    await prisma.dataUsage.create({
      data: {
        month: MONTH_CURR,
        category: CAT_SERVER,
        unit: "GB",
        amount: new Prisma.Decimal(999),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      duplicated = true;
    } else {
      throw e;
    }
  }
  if (!duplicated)
    throw new Error(`[2] month+category unique 미작동 — 중복 생성 성공`);
  console.log(`✅ 2. P2002 중복 가드 동작 ✓`);

  // ─── 3. upsert 로 덮어쓰기 ───────────────────────────
  await prisma.dataUsage.upsert({
    where: {
      month_category: { month: MONTH_CURR, category: CAT_SERVER },
    },
    create: {
      month: MONTH_CURR,
      category: CAT_SERVER,
      unit: "GB",
      amount: new Prisma.Decimal(999),
    },
    update: {
      amount: new Prisma.Decimal(130),
      note: "upsert 덮어쓰기",
    },
  });
  const serverAfter = await prisma.dataUsage.findUnique({
    where: { month_category: { month: MONTH_CURR, category: CAT_SERVER } },
  });
  if (!serverAfter || Number(serverAfter.amount) !== 130)
    throw new Error(`[3] upsert 덮어쓰기 실패 — ${serverAfter?.amount}`);
  if (serverAfter.note !== "upsert 덮어쓰기")
    throw new Error(`[3] note 업데이트 실패 — ${serverAfter.note}`);
  console.log(`✅ 3. upsert 덮어쓰기 → amount=120→130 ✓`);

  // ─── 4. getMonthSummary(MONTH_CURR) ───────────────
  const summary = await getMonthSummary(MONTH_CURR);
  if (summary.totalRows !== 3)
    throw new Error(`[4] 당월 3건 기대, 실제 ${summary.totalRows}`);
  const serverRow = summary.byCategory.find((c) => c.category === CAT_SERVER);
  if (!serverRow || serverRow.amount !== 130)
    throw new Error(`[4] 서버 카테고리 합 130 기대, 실제 ${serverRow?.amount}`);
  const totalAmount = summary.byCategory.reduce((s, c) => s + c.amount, 0);
  if (totalAmount !== 130 + 45 + 20)
    throw new Error(`[4] 전체합 ${130 + 45 + 20} 기대, 실제 ${totalAmount}`);
  console.log(
    `✅ 4. MonthSummary(${MONTH_CURR}) — 3건 · 합=${totalAmount} (서버=130, 스토리지=45, CDN=20) ✓`,
  );

  // ─── 5. getMonthWithPrev 비교 ─────────────────────
  const compare = await getMonthWithPrev(MONTH_CURR);
  if (compare.length !== 4)
    throw new Error(
      `[5] 비교 카테고리 4개 기대 (서버·스토리지·이메일·CDN), 실제 ${compare.length}`,
    );
  const server = compare.find((c) => c.category === CAT_SERVER)!;
  if (server.current !== 130 || server.previous !== 100)
    throw new Error(
      `[5] 서버 비교 current=130/previous=100 기대, 실제 ${server.current}/${server.previous}`,
    );
  const email = compare.find((c) => c.category === CAT_EMAIL)!;
  if (email.current !== null || email.previous !== 800)
    throw new Error(
      `[5] 이메일 비교 current=null/previous=800 기대, 실제 ${email.current}/${email.previous}`,
    );
  const cdn = compare.find((c) => c.category === CAT_NEW)!;
  if (cdn.current !== 20 || cdn.previous !== null)
    throw new Error(
      `[5] CDN 비교 current=20/previous=null 기대, 실제 ${cdn.current}/${cdn.previous}`,
    );
  console.log(
    `✅ 5. MonthWithPrev — 서버 100→130 · 스토리지 50→45 · 이메일 800→누락 · CDN 신규=20 ✓`,
  );

  // ─── 6. delete 후 재조회 ──────────────────────────
  await prisma.dataUsage.delete({
    where: { month_category: { month: MONTH_CURR, category: CAT_NEW } },
  });
  const afterDelete = await getMonthSummary(MONTH_CURR);
  if (afterDelete.totalRows !== 2)
    throw new Error(
      `[6] 삭제 후 2건 기대, 실제 ${afterDelete.totalRows}`,
    );
  console.log(`✅ 6. delete 후 2건 ✓`);

  console.log("\n[smoke-data-usage] all scenarios passed ✅");
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
