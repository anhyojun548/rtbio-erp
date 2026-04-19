/**
 * Phase 3E-2 스모크 — 테넌트 설정(TenantSetting) CRUD + VAT 재계산.
 *
 * 시나리오:
 *   A. 초기 시드 확인 — 알려진 5개 키 모두 존재
 *   B. 단일 upsert — 새 값 쓰고 다시 읽어 일치
 *   C. 일괄 upsert — 3개 키를 동시에 변경
 *   D. VAT 재계산 — vat_rate=0.08 로 변경 후 calcVatTotal 이 0.08 을 따르는지 확인
 *   E. 업무시간 start > end 시 validateBusinessHours 실패
 *
 * 실행: `npx tsx scripts/smoke-tenant-setting.ts`
 */
import { prisma } from "../src/lib/prisma";
import { calcVatTotal } from "../src/lib/validators/invoice";
import { validateBusinessHours } from "../src/lib/validators/tenant-setting";

const EXPECTED_KEYS = [
  "business_hour_start",
  "business_hour_end",
  "shipping_cutoff",
  "reorder_multiplier",
  "vat_rate",
] as const;

// 테스트 종료 시 원래 값으로 복원하기 위해 시작 시점 스냅샷 저장
const snapshots: Array<{ key: string; value: string }> = [];

async function restore() {
  for (const s of snapshots) {
    await prisma.tenantSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, updatedBy: "smoke-restore" },
      create: {
        key: s.key,
        value: s.value,
        description: "restored",
        updatedBy: "smoke-restore",
      },
    });
  }
}

async function main() {
  console.log("[smoke-tenant-setting] start");

  // ─── A. 초기 시드 확인 ─────────────────────────────────
  const rows = await prisma.tenantSetting.findMany({
    where: { key: { in: [...EXPECTED_KEYS] } },
  });
  if (rows.length !== EXPECTED_KEYS.length)
    throw new Error(
      `[A] 기대 ${EXPECTED_KEYS.length}키, 실제 ${rows.length}키 — 시드 누락 가능성 (npx prisma db seed 필요)`,
    );
  for (const r of rows) snapshots.push({ key: r.key, value: r.value });
  console.log(`✅ A. 시드된 ${rows.length}개 키 확인`);

  // ─── B. 단일 upsert ────────────────────────────────────
  await prisma.tenantSetting.upsert({
    where: { key: "shipping_cutoff" },
    update: { value: "17:00", updatedBy: "smoke-B" },
    create: {
      key: "shipping_cutoff",
      value: "17:00",
      description: "smoke B",
      updatedBy: "smoke-B",
    },
  });
  const afterB = await prisma.tenantSetting.findUnique({
    where: { key: "shipping_cutoff" },
  });
  if (afterB?.value !== "17:00")
    throw new Error(`[B] shipping_cutoff=17:00 기대, got ${afterB?.value}`);
  console.log("✅ B. shipping_cutoff → 17:00 upsert OK");

  // ─── C. 일괄 upsert (tx) ───────────────────────────────
  await prisma.$transaction([
    prisma.tenantSetting.upsert({
      where: { key: "business_hour_start" },
      update: { value: "08:30", updatedBy: "smoke-C" },
      create: {
        key: "business_hour_start",
        value: "08:30",
        description: "c",
        updatedBy: "smoke-C",
      },
    }),
    prisma.tenantSetting.upsert({
      where: { key: "business_hour_end" },
      update: { value: "17:30", updatedBy: "smoke-C" },
      create: {
        key: "business_hour_end",
        value: "17:30",
        description: "c",
        updatedBy: "smoke-C",
      },
    }),
    prisma.tenantSetting.upsert({
      where: { key: "reorder_multiplier" },
      update: { value: "3.0", updatedBy: "smoke-C" },
      create: {
        key: "reorder_multiplier",
        value: "3.0",
        description: "c",
        updatedBy: "smoke-C",
      },
    }),
  ]);
  const afterC = await prisma.tenantSetting.findMany({
    where: {
      key: { in: ["business_hour_start", "business_hour_end", "reorder_multiplier"] },
    },
  });
  const cMap = new Map(afterC.map((r) => [r.key, r.value]));
  if (
    cMap.get("business_hour_start") !== "08:30" ||
    cMap.get("business_hour_end") !== "17:30" ||
    cMap.get("reorder_multiplier") !== "3.0"
  )
    throw new Error(`[C] 일괄 upsert 반영 실패: ${JSON.stringify([...cMap])}`);
  console.log("✅ C. 3키 일괄 upsert OK");

  // ─── D. VAT 재계산 ─────────────────────────────────────
  await prisma.tenantSetting.upsert({
    where: { key: "vat_rate" },
    update: { value: "0.08", updatedBy: "smoke-D" },
    create: {
      key: "vat_rate",
      value: "0.08",
      description: "d",
      updatedBy: "smoke-D",
    },
  });
  const vatSetting = await prisma.tenantSetting.findUnique({
    where: { key: "vat_rate" },
  });
  const rate = Number(vatSetting!.value);
  const { vat, total } = calcVatTotal(10000, rate);
  if (vat !== 800 || total !== 10800)
    throw new Error(
      `[D] rate=0.08 → vat=800/total=10800 기대, got ${vat}/${total}`,
    );
  // 기본값(rate=0.10) 확인
  const dflt = calcVatTotal(10000);
  if (dflt.vat !== 1000 || dflt.total !== 11000)
    throw new Error(
      `[D] default rate=0.10 → vat=1000/total=11000 기대, got ${dflt.vat}/${dflt.total}`,
    );
  console.log(`✅ D. VAT 재계산 — 0.08=${vat}, default 0.10=${dflt.vat}`);

  // ─── E. 업무시간 start < end 규칙 ──────────────────────
  const r1 = validateBusinessHours("09:00", "18:00");
  if (!r1.ok) throw new Error("[E] 09~18 OK 기대");
  const r2 = validateBusinessHours("18:00", "09:00");
  if (r2.ok) throw new Error("[E] 18>09 는 거부 기대");
  const r3 = validateBusinessHours("09:00", "09:00");
  if (r3.ok) throw new Error("[E] 09==09 은 거부 기대");
  console.log("✅ E. validateBusinessHours 규칙 동작");

  console.log("\n[smoke-tenant-setting] all scenarios passed ✅");
}

main()
  .catch(async (e) => {
    console.error("❌", e);
    await restore();
    await prisma.$disconnect();
    process.exit(1);
  })
  .then(async () => {
    await restore();
    await prisma.$disconnect();
  });
