/**
 * 매입 수기 입력 스모크 — TransactionLedger(kind=PURCHASE) 기반.
 *
 * 액션은 requireRole(세션)로 막혀 CLI 직접 호출 불가 → 액션과 동일한 DB 경로/계산을 재현해
 * 스키마·집계·KST 기간 필터·수기전표 삭제 가드를 실 DB 로 검증한다.
 * (실제 액션 함수는 브라우저 E2E 로 검증)
 *
 * 시나리오:
 *   1. 전표 PUR-YYYYMMDD-NNN 채번(당일 max+1) → 2라인 과세 매입 insert
 *   2. 라인 금액 = calcPurchaseLine (과세 VAT 10%) 검증
 *   3. 전표 그룹핑(listPurchaseEntries 로직) — itemCount=2, 합계 일치
 *   4. getPurchaseJournal KST 기간 필터 — 같은 날 조회 2건, 다른 날 0건
 *   5. 수기 전표 삭제 가드 — importSource=manual 만 삭제
 *
 * 실행: `npx tsx scripts/smoke-purchase.ts`
 */
import { prisma } from "../src/lib/prisma";
import { calcPurchaseLine } from "../src/lib/validators/purchase";

const MANUAL_SOURCE = "manual:purchase-entry";
const SUP = `SMOKE_PUR_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function kstYmd(d: Date): string {
  return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
function kstMidnight(ymd: string): Date {
  return new Date(ymd + "T00:00:00+09:00");
}

let failed = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`, extra ?? "");
  }
}

async function nextVoucher(ymd: string): Promise<string> {
  const prefix = "PUR-" + ymd.replace(/-/g, "") + "-";
  const rows = await prisma.transactionLedger.findMany({
    where: { kind: "PURCHASE", voucherNo: { startsWith: prefix } },
    select: { voucherNo: true },
    distinct: ["voucherNo"],
  });
  const max = rows.reduce((m, r) => {
    const n = parseInt((r.voucherNo || "").slice(prefix.length), 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return prefix + String(max + 1).padStart(3, "0");
}

async function cleanup() {
  await prisma.transactionLedger.deleteMany({ where: { clientName: { startsWith: SUP } } });
}

async function main() {
  console.log(`[smoke-purchase] supplier=${SUP}`);
  await cleanup();

  const date = "2026-06-08";
  const txnDate = kstMidnight(date);

  // ── 1) 채번 + 2라인 insert ──────────────────────────────
  const voucherNo = await nextVoucher(date);
  check("전표번호 형식 PUR-YYYYMMDD-NNN", /^PUR-\d{8}-\d{3}$/.test(voucherNo), voucherNo);

  const lines = [
    { productName: "RECOTAP PLUS KNEE L", spec: "L", qty: 3, unitPrice: 13191 },
    { productName: "RECOTAP PLUS ELBOW M", spec: "M", qty: 10, unitPrice: 5000 },
  ];
  const rows = lines.map((l) => {
    const { supply, vat, total } = calcPurchaseLine(l.qty, l.unitPrice, "과세");
    return {
      txnDate, kind: "PURCHASE" as const, taxType: "과세",
      clientCode: null, clientName: SUP,
      productCode: null, productName: l.productName, spec: l.spec, unit: null,
      qty: l.qty.toString(), unitPrice: l.unitPrice.toString(),
      supplyAmount: supply.toString(), vat: vat.toString(), totalAmount: total.toString(),
      voucherNo, hasInvoice: false, memo: null,
      importSource: MANUAL_SOURCE, createdBy: "smoke",
    };
  });
  await prisma.transactionLedger.createMany({ data: rows });

  // ── 2) 라인 금액 검증 ───────────────────────────────────
  const saved = await prisma.transactionLedger.findMany({
    where: { voucherNo, clientName: SUP },
    orderBy: { unitPrice: "desc" },
  });
  check("2라인 저장됨", saved.length === 2, saved.length);
  const l0 = saved.find((r) => r.productName === "RECOTAP PLUS KNEE L")!;
  check("라인1 supply=39573", Number(l0.supplyAmount) === 39573, l0.supplyAmount);
  check("라인1 vat=3957 (round 3957.3)", Number(l0.vat) === 3957, l0.vat);
  check("라인1 total=43530", Number(l0.totalAmount) === 43530, l0.totalAmount);

  // ── 3) 전표 그룹핑 (listPurchaseEntries 로직) ───────────
  const all = await prisma.transactionLedger.findMany({
    where: { kind: "PURCHASE", clientName: SUP },
    select: { voucherNo: true, txnDate: true, clientName: true, supplyAmount: true, vat: true, totalAmount: true, importSource: true },
  });
  const group = new Map<string, { itemCount: number; supply: number; vat: number; total: number; manual: boolean }>();
  for (const r of all) {
    const key = r.voucherNo || `${kstYmd(r.txnDate)}|${r.clientName}`;
    const e = group.get(key) ?? { itemCount: 0, supply: 0, vat: 0, total: 0, manual: (r.importSource || "").startsWith("manual") };
    e.itemCount += 1; e.supply += Number(r.supplyAmount); e.vat += Number(r.vat); e.total += Number(r.totalAmount);
    group.set(key, e);
  }
  const g = group.get(voucherNo)!;
  check("전표 그룹 itemCount=2", g.itemCount === 2, g.itemCount);
  check("전표 합계 supply=89573", g.supply === 39573 + 50000, g.supply);
  check("전표 합계 total=98530", g.total === 43530 + 55000, g.total);
  check("전표 manual=true", g.manual === true);

  // ── 4) getPurchaseJournal KST 기간 필터 ─────────────────
  const fromIn = kstMidnight(date);
  const toExIn = new Date(kstMidnight(date).getTime() + 86400000);
  const inRange = await prisma.transactionLedger.count({
    where: { kind: "PURCHASE", clientName: SUP, txnDate: { gte: fromIn, lt: toExIn } },
  });
  check("같은 날(06-08) 기간 조회 2건", inRange === 2, inRange);
  check("표시 일자 KST = 2026-06-08", kstYmd(saved[0]!.txnDate) === "2026-06-08", kstYmd(saved[0]!.txnDate));

  const nextDay = "2026-06-09";
  const fromOut = kstMidnight(nextDay);
  const toExOut = new Date(kstMidnight(nextDay).getTime() + 86400000);
  const outRange = await prisma.transactionLedger.count({
    where: { kind: "PURCHASE", clientName: SUP, txnDate: { gte: fromOut, lt: toExOut } },
  });
  check("다른 날(06-09) 기간 조회 0건", outRange === 0, outRange);

  // ── 5) 수기 전표 삭제 가드 ──────────────────────────────
  // 비-manual 행을 하나 섞어 넣고, manual 만 삭제되는지 확인
  await prisma.transactionLedger.create({
    data: {
      txnDate, kind: "PURCHASE", taxType: "과세", clientName: SUP,
      productName: "SEED_IMPORTED", qty: "1", unitPrice: "0",
      supplyAmount: "0", vat: "0", totalAmount: "0",
      voucherNo: voucherNo + "X", hasInvoice: false, importSource: "excel:seed", createdBy: "smoke",
    },
  });
  const delManual = await prisma.transactionLedger.deleteMany({
    where: { kind: "PURCHASE", voucherNo, importSource: MANUAL_SOURCE },
  });
  check("manual 전표 2라인 삭제", delManual.count === 2, delManual.count);
  const leftover = await prisma.transactionLedger.count({ where: { clientName: SUP } });
  check("비-manual(seed) 행은 보존됨", leftover === 1, leftover);

  await cleanup();
  console.log(failed === 0 ? "\n[smoke-purchase] ✅ ALL PASS" : `\n[smoke-purchase] ❌ ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
