/**
 * Phase 3E-3 스모크 — 재고 임계치 알럼 (R14).
 *
 * 시나리오:
 *   A. OUT — physicalStock=0, reorderPoint=10 → level=OUT, deficit=10
 *   B. LOW — physicalStock=5,  reorderPoint=10 → level=LOW, deficit=5
 *   C. OK  — physicalStock=20, reorderPoint=10 → level=OK, 알럼 미포함
 *   D. reorderPoint=null — 아무리 낮아도 OK (알럼 비대상)
 *   E. 정렬 — OUT 먼저, 그 뒤 deficit desc (A=OUT d10 · B=LOW d5 · F=LOW d3)
 *   F. countStockAlerts — OUT/LOW/OK 건수 집계 정확성
 *
 * 실행: `npx tsx scripts/smoke-stock-alert.ts`
 */
import { prisma } from "../src/lib/prisma";
import {
  classifyStock,
  compareStockUrgency,
} from "../src/lib/validators/stock-alert";

const PREFIX = `SMOKE_SA_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

async function cleanup() {
  const products = await prisma.product.findMany({
    where: { code: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = products.map((p) => p.id);
  if (ids.length === 0) return;
  // sizes 는 CASCADE 로 같이 삭제됨
  await prisma.product.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  console.log(`[smoke-stock-alert] prefix=${PREFIX}`);
  await cleanup();

  // ─── fixture 생성 ──────────────────────────────────────
  // 5개 사이즈(A=OUT, B=LOW d5, C=OK, D=reorderPoint null, F=LOW d3) + 활성 제품 1건
  const prod = await prisma.product.create({
    data: {
      code: `${PREFIX}P`,
      name: `smoke-stock-alert-product`,
      category: "소모품",
      brand: null,
      basePrice: 1000,
      active: true,
      sizes: {
        create: [
          {
            sizeCode: "A_OUT",
            physicalStock: 0,
            availableStock: 0,
            reorderPoint: 10,
          },
          {
            sizeCode: "B_LOW_D5",
            physicalStock: 5,
            availableStock: 5,
            reorderPoint: 10,
          },
          {
            sizeCode: "C_OK",
            physicalStock: 20,
            availableStock: 20,
            reorderPoint: 10,
          },
          {
            sizeCode: "D_NULL",
            physicalStock: 0,
            availableStock: 0,
            reorderPoint: null,
          },
          {
            sizeCode: "F_LOW_D3",
            physicalStock: 7,
            availableStock: 7,
            reorderPoint: 10,
          },
        ],
      },
    },
    include: { sizes: true },
  });
  console.log(`✅ fixture 제품(${prod.code}) + 사이즈 ${prod.sizes.length}개`);

  const byCode = new Map(prod.sizes.map((s) => [s.sizeCode, s]));

  // ─── A. OUT ────────────────────────────────────────────
  const A = classifyStock({
    physicalStock: byCode.get("A_OUT")!.physicalStock,
    availableStock: byCode.get("A_OUT")!.availableStock,
    reorderPoint: byCode.get("A_OUT")!.reorderPoint,
  });
  if (A.level !== "OUT" || A.deficit !== 10)
    throw new Error(`[A] OUT d10 기대 — got ${A.level} d${A.deficit}`);
  console.log("✅ A. OUT d10");

  // ─── B. LOW d5 ─────────────────────────────────────────
  const B = classifyStock({
    physicalStock: byCode.get("B_LOW_D5")!.physicalStock,
    availableStock: byCode.get("B_LOW_D5")!.availableStock,
    reorderPoint: byCode.get("B_LOW_D5")!.reorderPoint,
  });
  if (B.level !== "LOW" || B.deficit !== 5)
    throw new Error(`[B] LOW d5 기대 — got ${B.level} d${B.deficit}`);
  console.log("✅ B. LOW d5");

  // ─── C. OK ─────────────────────────────────────────────
  const C = classifyStock({
    physicalStock: byCode.get("C_OK")!.physicalStock,
    availableStock: byCode.get("C_OK")!.availableStock,
    reorderPoint: byCode.get("C_OK")!.reorderPoint,
  });
  if (C.level !== "OK") throw new Error(`[C] OK 기대 — got ${C.level}`);
  console.log("✅ C. OK");

  // ─── D. reorderPoint=null → OK ─────────────────────────
  const D = classifyStock({
    physicalStock: byCode.get("D_NULL")!.physicalStock,
    availableStock: byCode.get("D_NULL")!.availableStock,
    reorderPoint: byCode.get("D_NULL")!.reorderPoint,
  });
  // physicalStock=0 이지만 reorderPoint=null → OUT, deficit=0 (알럼 대상 되지만 "reorderPoint 미설정"임)
  if (D.level !== "OUT" || D.deficit !== 0)
    throw new Error(
      `[D] reorderPoint=null 재고0 = OUT d0 기대 — got ${D.level} d${D.deficit}`,
    );
  console.log(`✅ D. reorderPoint=null && stock=0 → OUT d0 (deficit 미계산)`);

  // ─── E. 정렬 — OUT 먼저, 같은 level 은 deficit desc ────
  const F = classifyStock({
    physicalStock: byCode.get("F_LOW_D3")!.physicalStock,
    availableStock: byCode.get("F_LOW_D3")!.availableStock,
    reorderPoint: byCode.get("F_LOW_D3")!.reorderPoint,
  });
  const picked = [
    { k: "A", cls: A },
    { k: "B", cls: B },
    { k: "F", cls: F },
  ].sort((x, y) => compareStockUrgency(x.cls, y.cls));
  const order = picked.map((p) => p.k).join(",");
  if (order !== "A,B,F")
    throw new Error(`[E] A,B,F (OUT → LOW d5 → LOW d3) 기대 — got ${order}`);
  console.log(`✅ E. 정렬 A,B,F (${picked.map((p) => `${p.k}=${p.cls.level}d${p.cls.deficit}`).join(" ")})`);

  // ─── F. countStockAlerts 등가 계산 ─────────────────────
  const allSizes = await prisma.productSize.findMany({
    where: { product: { active: true, id: prod.id } },
    select: { physicalStock: true, availableStock: true, reorderPoint: true },
  });
  let OUT = 0,
    LOW = 0,
    OK = 0;
  for (const s of allSizes) {
    const cls = classifyStock({
      physicalStock: s.physicalStock,
      availableStock: s.availableStock,
      reorderPoint: s.reorderPoint,
    });
    if (cls.level === "OUT") OUT += 1;
    else if (cls.level === "LOW") LOW += 1;
    else OK += 1;
  }
  // A=OUT, D=OUT, B=LOW, F=LOW, C=OK → 2/2/1
  if (OUT !== 2 || LOW !== 2 || OK !== 1)
    throw new Error(
      `[F] 집계 OUT=2/LOW=2/OK=1 기대 — got ${OUT}/${LOW}/${OK}`,
    );
  console.log(`✅ F. 집계 OUT=2, LOW=2, OK=1 (총 5개)`);

  console.log("\n[smoke-stock-alert] all scenarios passed ✅");
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
