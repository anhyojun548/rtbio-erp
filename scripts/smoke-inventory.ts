/**
 * Phase 3C 재고 액션 스모크 테스트.
 *
 * `receiveStock` / `createAdjustment` 를 실제 DB 에 대해 1회씩 실행한 뒤
 * 로그 테이블과 재고 상태 전이를 검증한다.
 *
 * 실행: `npx tsx scripts/smoke-inventory.ts`
 *
 * NOTE: requireRole 은 NextAuth 세션을 요구 → 여기선 prisma 만 직접 사용해
 *       핵심 DB 파이프라인 (FOR UPDATE + 불변식 + 로그 기록) 만 확인.
 */
import { prisma } from "../src/lib/prisma";
import { assertInvariant } from "../src/lib/inventory/invariant";

async function main() {
  const size = await prisma.productSize.findFirst({
    where: { product: { active: true } },
    include: { product: { select: { name: true, code: true } } },
  });
  if (!size) {
    console.error("✗ 활성 제품 사이즈가 없습니다. Phase 3B 시드가 필요합니다.");
    process.exit(1);
  }

  console.log(
    `시작 상태: ${size.product.name}(${size.product.code}) / ${size.sizeCode}`,
  );
  console.log(
    `  실재고 ${size.physicalStock} · 가용재고 ${size.availableStock}`,
  );

  const RECEIVE_QTY = 7;
  const ADJUST_QTY = -3;

  // ─── 1) 입고 시뮬 (receiveStock 의 트랜잭션 핵심) ─────────────
  const afterReceive = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "tenant_altibio"."ProductSize"
      WHERE id = ${size.id}
      FOR UPDATE
    `;
    const cur = await tx.productSize.findUnique({
      where: { id: size.id },
      select: { physicalStock: true, availableStock: true },
    });
    if (!cur) throw new Error("unreachable");

    const nextP = cur.physicalStock + RECEIVE_QTY;
    const nextA = cur.availableStock + RECEIVE_QTY;
    assertInvariant(nextP, nextA);

    await tx.productSize.update({
      where: { id: size.id },
      data: { physicalStock: nextP, availableStock: nextA },
    });
    await tx.inventoryLog.create({
      data: {
        productSizeId: size.id,
        type: "RECEIVE",
        qtyDelta: RECEIVE_QTY,
        physicalAfter: nextP,
        availableAfter: nextA,
        note: "smoke-inventory: receive",
      },
    });
    return { p: nextP, a: nextA };
  });
  console.log(
    `✓ 입고 +${RECEIVE_QTY}: 실재고 ${afterReceive.p} · 가용재고 ${afterReceive.a}`,
  );

  // ─── 2) 조정 시뮬 (createAdjustment 의 트랜잭션 핵심 — 폐기 -3) ─
  const afterAdjust = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "tenant_altibio"."ProductSize"
      WHERE id = ${size.id}
      FOR UPDATE
    `;
    const cur = await tx.productSize.findUnique({
      where: { id: size.id },
      select: { physicalStock: true, availableStock: true },
    });
    if (!cur) throw new Error("unreachable");

    const nextP = cur.physicalStock + ADJUST_QTY;
    const nextA = cur.availableStock + ADJUST_QTY;
    assertInvariant(nextP, nextA);

    await tx.productSize.update({
      where: { id: size.id },
      data: { physicalStock: nextP, availableStock: nextA },
    });
    const adj = await tx.inventoryAdjustment.create({
      data: {
        productSizeId: size.id,
        qty: ADJUST_QTY,
        reason: "폐기",
        note: "smoke-inventory: discard",
      },
      select: { id: true },
    });
    await tx.inventoryLog.create({
      data: {
        productSizeId: size.id,
        type: "ADJUST_OUT",
        qtyDelta: ADJUST_QTY,
        physicalAfter: nextP,
        availableAfter: nextA,
        note: `smoke: 폐기(${adj.id})`,
      },
    });
    return { p: nextP, a: nextA, adjId: adj.id };
  });
  console.log(
    `✓ 조정 ${ADJUST_QTY}(폐기): 실재고 ${afterAdjust.p} · 가용재고 ${afterAdjust.a}`,
  );

  // ─── 3) 이력 조회 확인 ─────────────────────────────────────
  const recent = await prisma.inventoryLog.findMany({
    where: { productSizeId: size.id },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  console.log(`✓ 최근 로그 ${recent.length}건:`);
  for (const r of recent) {
    console.log(
      `    - ${r.type} qtyDelta=${r.qtyDelta} → p=${r.physicalAfter} a=${r.availableAfter}  "${r.note ?? ""}"`,
    );
  }

  // ─── 4) 불변식 위반 테스트 (커밋 전 rollback) ──────────────
  console.log(`\n불변식 테스트:`);
  try {
    assertInvariant(-1, 0);
    console.error("✗ physical < 0 인데 통과했다 (버그)");
    process.exit(1);
  } catch {
    console.log("  ✓ physical < 0 거부");
  }
  try {
    assertInvariant(3, 5);
    console.error("✗ physical < available 인데 통과했다 (버그)");
    process.exit(1);
  } catch {
    console.log("  ✓ physical < available 거부");
  }

  console.log(`\n✅ 재고 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
