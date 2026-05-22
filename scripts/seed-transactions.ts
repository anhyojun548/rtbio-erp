/**
 * 거래원장 시드 스크립트 — Phase 5 (데이터 탐색기)
 *
 * 사용:
 *   pnpm tsx scripts/seed-transactions.ts
 *
 * 입력: prisma/seed-transactions.json (41,536 행, 19MB)
 *   - 2023.01 ~ 2026.05 알티바이오 매입매출 데이터
 *
 * 동작:
 *   1. JSON 로드 (Date 문자열 → Date 객체)
 *   2. 기존 importSource = 'seed' 데이터 모두 삭제
 *   3. 5000건씩 chunked createMany 로 insert
 *   4. 통계 출력
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

interface RawRow {
  txnDate: string;
  kind: "SALE" | "PURCHASE";
  taxType: string | null;
  clientCode: string | null;
  clientName: string | null;
  productCode: string | null;
  productName: string;
  spec: string | null;
  unit: string | null;
  qty: number;
  unitPrice: number;
  supplyAmount: number;
  vat: number;
  totalAmount: number;
  itemMemo: string | null;
  voucherNo: string | null;
  hasInvoice: boolean;
  evidence: string | null;
  category: string | null;
  memo: string | null;
}

const CHUNK = 5000;
const IMPORT_SOURCE = "seed:2023-2026-altibio";

async function main() {
  const jsonPath = path.join(process.cwd(), "prisma/seed-transactions.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ ${jsonPath} 가 없습니다. 엑셀 → JSON 변환 먼저 실행.`);
    process.exit(1);
  }

  console.log(`📂 JSON 로드: ${jsonPath}`);
  const rawText = fs.readFileSync(jsonPath, "utf-8");
  const rows: RawRow[] = JSON.parse(rawText);
  console.log(`✓ ${rows.length}개 행 로드됨`);

  // 기존 seed 데이터 삭제
  console.log("🗑️  기존 seed 데이터 삭제...");
  const deleted = await prisma.transactionLedger.deleteMany({
    where: { importSource: IMPORT_SOURCE },
  });
  console.log(`✓ ${deleted.count}건 삭제`);

  // chunked insert
  console.log(`💾 insert 시작 (${CHUNK}건씩 chunk)...`);
  let inserted = 0;
  const t0 = Date.now();
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const data = chunk.map((r) => ({
      txnDate:      new Date(r.txnDate),
      kind:         r.kind,
      taxType:      r.taxType,
      clientCode:   r.clientCode,
      clientName:   r.clientName,
      productCode:  r.productCode,
      productName:  r.productName,
      spec:         r.spec,
      unit:         r.unit,
      qty:          r.qty.toString(),
      unitPrice:    r.unitPrice.toString(),
      supplyAmount: r.supplyAmount.toString(),
      vat:          r.vat.toString(),
      totalAmount:  r.totalAmount.toString(),
      itemMemo:     r.itemMemo,
      voucherNo:    r.voucherNo,
      hasInvoice:   r.hasInvoice,
      evidence:     r.evidence,
      category:     r.category,
      memo:         r.memo,
      importSource: IMPORT_SOURCE,
      createdBy:    "seed",
    }));
    const res = await prisma.transactionLedger.createMany({ data, skipDuplicates: true });
    inserted += res.count;
    process.stdout.write(`\r  ${inserted}/${rows.length}건 (${((inserted / rows.length) * 100).toFixed(1)}%)`);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ 완료: ${inserted}건 insert (${elapsed}초)`);

  // 통계
  const stats = await prisma.transactionLedger.groupBy({
    by: ["kind"],
    where: { importSource: IMPORT_SOURCE },
    _count: { _all: true },
    _sum:   { totalAmount: true },
  });
  console.log("📊 통계:");
  for (const s of stats) {
    console.log(`  · ${s.kind === "SALE" ? "매출" : "매입"}: ${s._count._all}건 / ₩${Number(s._sum.totalAmount ?? 0).toLocaleString()}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
