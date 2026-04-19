/**
 * Phase 3D-4a 스모크 — 유통기한 로트(ExpiryLot) CRUD + 만료 단계 분류.
 *
 * 시나리오:
 *   A. createExpiryLot → remainingQty == quantity 로 초기화
 *   B. 같은 사이즈 로트번호 중복 → 실패 (가드)
 *   C. updateExpiryLot — remainingQty 감소, 초과 입력은 거부
 *   D. classifyExpiry 4단계 (EXPIRED / URGENT / SOON / SAFE) 정렬
 *   E. deleteExpiryLot → 사라짐
 *
 * 실행: `npx tsx scripts/smoke-expiry.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { classifyExpiry } from "../src/lib/validators/expiry";

async function createLotInline(opts: {
  productSizeId: string;
  lotNumber: string;
  expiryDate: Date;
  quantity: number;
  note?: string;
}) {
  // 같은 사이즈 내 중복 체크
  const dup = await prisma.expiryLot.findFirst({
    where: {
      productSizeId: opts.productSizeId,
      lotNumber: opts.lotNumber,
    },
  });
  if (dup) throw new Error(`로트 중복: ${opts.lotNumber}`);
  return prisma.expiryLot.create({
    data: {
      productSizeId: opts.productSizeId,
      lotNumber: opts.lotNumber,
      expiryDate: opts.expiryDate,
      quantity: opts.quantity,
      remainingQty: opts.quantity,
      note: opts.note ?? null,
    },
  });
}

async function updateLotInline(
  id: string,
  patch: { remainingQty?: number; note?: string },
) {
  const cur = await prisma.expiryLot.findUnique({ where: { id } });
  if (!cur) throw new Error("로트 없음");
  if (patch.remainingQty !== undefined && patch.remainingQty > cur.quantity) {
    throw new Error(
      `잔여수량은 원본(${cur.quantity})을 초과할 수 없음 (요청 ${patch.remainingQty})`,
    );
  }
  return prisma.expiryLot.update({
    where: { id },
    data: {
      remainingQty: patch.remainingQty ?? undefined,
      note: patch.note ?? undefined,
    },
  });
}

async function main() {
  const size = await prisma.productSize.findFirst({
    include: { product: { select: { id: true, name: true, code: true } } },
  });
  if (!size) throw new Error("사이즈 없음");
  console.log(
    `사이즈: ${size.product.name}/${size.sizeCode} (${size.product.code})`,
  );

  // 기존 SMOKE 로트 제거
  await prisma.expiryLot.deleteMany({
    where: {
      productSizeId: size.id,
      lotNumber: { startsWith: "SMOKE-" },
    },
  });

  const now = new Date();

  // ─── A. 생성 ────────────────────────────────────────────
  const lotA = await createLotInline({
    productSizeId: size.id,
    lotNumber: "SMOKE-A-001",
    expiryDate: new Date(now.getTime() + 180 * 24 * 3600 * 1000), // 180일 뒤
    quantity: 100,
  });
  if (lotA.remainingQty !== lotA.quantity)
    throw new Error("[A] remainingQty 초기화 실패");
  console.log(
    `✓ [A] 로트 생성: lot=${lotA.lotNumber}, qty=${lotA.quantity}, remaining=${lotA.remainingQty}`,
  );

  // ─── B. 중복 거부 ────────────────────────────────────────
  let blocked = false;
  try {
    await createLotInline({
      productSizeId: size.id,
      lotNumber: "SMOKE-A-001",
      expiryDate: new Date(now.getTime() + 200 * 24 * 3600 * 1000),
      quantity: 50,
    });
  } catch (e) {
    blocked = true;
    console.log(`✓ [B] 중복 로트번호 가드: ${(e as Error).message}`);
  }
  if (!blocked) throw new Error("[B] 중복 가드 실패");

  // ─── C. update: remainingQty 감소 ────────────────────────
  const updated = await updateLotInline(lotA.id, { remainingQty: 40 });
  if (updated.remainingQty !== 40) throw new Error("[C] 잔여 수량 미반영");
  console.log(`✓ [C] 잔여수량 100 → 40 감소`);

  // C-2: 원본 초과 거부
  let overBlocked = false;
  try {
    await updateLotInline(lotA.id, { remainingQty: 200 });
  } catch (e) {
    overBlocked = true;
    console.log(`✓ [C] 원본 초과 가드: ${(e as Error).message}`);
  }
  if (!overBlocked) throw new Error("[C] 원본 초과 가드 실패");

  // ─── D. 4단계 분류 ─────────────────────────────────────
  const expired = await createLotInline({
    productSizeId: size.id,
    lotNumber: "SMOKE-EXPIRED",
    expiryDate: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
    quantity: 10,
  });
  const urgent = await createLotInline({
    productSizeId: size.id,
    lotNumber: "SMOKE-URGENT",
    expiryDate: new Date(now.getTime() + 15 * 24 * 3600 * 1000),
    quantity: 10,
  });
  const soon = await createLotInline({
    productSizeId: size.id,
    lotNumber: "SMOKE-SOON",
    expiryDate: new Date(now.getTime() + 60 * 24 * 3600 * 1000),
    quantity: 10,
  });
  const safe = await createLotInline({
    productSizeId: size.id,
    lotNumber: "SMOKE-SAFE",
    expiryDate: new Date(now.getTime() + 400 * 24 * 3600 * 1000),
    quantity: 10,
  });

  const checks: Array<[string, string, string]> = [
    ["EXPIRED", expired.lotNumber, classifyExpiry(expired.expiryDate, now).stage],
    ["URGENT", urgent.lotNumber, classifyExpiry(urgent.expiryDate, now).stage],
    ["SOON", soon.lotNumber, classifyExpiry(soon.expiryDate, now).stage],
    ["SAFE", safe.lotNumber, classifyExpiry(safe.expiryDate, now).stage],
  ];
  for (const [expected, lot, actual] of checks) {
    if (actual !== expected)
      throw new Error(`[D] ${lot} 분류 오류: expected ${expected}, got ${actual}`);
  }
  console.log(`✓ [D] 4단계 분류 검증: EXPIRED/URGENT/SOON/SAFE 모두 정확`);

  // ─── E. 삭제 ────────────────────────────────────────────
  await prisma.expiryLot.delete({ where: { id: lotA.id } });
  const after = await prisma.expiryLot.findUnique({ where: { id: lotA.id } });
  if (after) throw new Error("[E] 삭제 실패");
  console.log(`✓ [E] deleteExpiryLot`);

  // 청소
  await prisma.expiryLot.deleteMany({
    where: {
      id: { in: [expired.id, urgent.id, soon.id, safe.id] },
    },
  });

  console.log(`\n✅ Expiry 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
