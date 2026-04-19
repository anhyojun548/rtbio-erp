/**
 * Phase 3F-2 스모크 — 담당자별 매출(R15) 집계 정확성.
 *
 * 시나리오:
 *   fixture: 2 명(repA, repB), 3 거래처
 *     - C1: salesRepId=repA
 *     - C2: salesRepId=repB + SalesAssignment(repA, active=true)  → repA 복수배정
 *     - C3: salesRepId=repB
 *   invoices (이달 ISSUED/SENT): C1 ₩10,000 / C2 ₩20,000 / C3 ₩30,000
 *   payments (이달 PARTIAL/PAID): C1 ₩5,000 / C2 ₩15,000 / C3 ₩20,000
 *   ledgers (이달): C1 balance=5000, C2 balance=5000, C3 balance=10000
 *
 *   기대:
 *     repA (C1 ∪ C2): sales=30000, payment=20000, outstanding=10000, clients=2
 *     repB (C2 ∪ C3): sales=50000, payment=35000, outstanding=15000, clients=2
 *
 *   A. computeSalesPerformance(month) → 두 유저 모두 기대치와 일치
 *   B. computeClientBreakdown({repA, month}) → C1/C2 순서 (desc by sales) · 합=30000/20000
 *   C. computeProductBreakdown({repA, month}) → COMPLETED 주문 2건의 line 집계
 *
 * 실행: `npx tsx scripts/smoke-sales-performance.ts`
 */
import { prisma } from "../src/lib/prisma";
import {
  computeSalesPerformance,
  computeClientBreakdown,
  computeProductBreakdown,
} from "../src/lib/actions/sales-performance";

const PREFIX = `SMOKE_SP_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const MONTH = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

async function cleanup() {
  await prisma.payment.deleteMany({
    where: { client: { code: { startsWith: PREFIX } } },
  });
  await prisma.invoice.deleteMany({
    where: { client: { code: { startsWith: PREFIX } } },
  });
  await prisma.closingLedger.deleteMany({
    where: { client: { code: { startsWith: PREFIX } } },
  });
  await prisma.orderItem.deleteMany({
    where: { order: { client: { code: { startsWith: PREFIX } } } },
  });
  await prisma.order.deleteMany({
    where: { client: { code: { startsWith: PREFIX } } },
  });
  await prisma.salesAssignment.deleteMany({
    where: { client: { code: { startsWith: PREFIX } } },
  });
  await prisma.productSize.deleteMany({
    where: { product: { code: { startsWith: PREFIX } } },
  });
  await prisma.product.deleteMany({
    where: { code: { startsWith: PREFIX } },
  });
  await prisma.client.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({
    where: { email: { startsWith: PREFIX.toLowerCase() } },
  });
}

async function main() {
  console.log(`[smoke-sales-performance] prefix=${PREFIX} month=${MONTH}`);
  await cleanup();

  const tenant = await prisma.tenant.findFirst({
    where: { subdomain: "altibio" },
  });
  if (!tenant) throw new Error("altibio 테넌트 없음 — seed 먼저 돌려야 함");

  // ─── Users (repA, repB) ──────────────────────────────
  const repA = await prisma.user.create({
    data: {
      email: `${PREFIX.toLowerCase()}_a@test.local`,
      password: "x",
      name: `A영업 ${PREFIX}`,
      role: "EXEC",
      tenantId: tenant.id,
    },
    select: { id: true },
  });
  const repB = await prisma.user.create({
    data: {
      email: `${PREFIX.toLowerCase()}_b@test.local`,
      password: "x",
      name: `B영업 ${PREFIX}`,
      role: "EXEC",
      tenantId: tenant.id,
    },
    select: { id: true },
  });

  // ─── Clients ─────────────────────────────────────────
  const c1 = await prisma.client.create({
    data: {
      code: `${PREFIX}_C1`,
      name: "C1 병원",
      type: "HOSPITAL",
      salesRepId: repA.id,
    },
    select: { id: true },
  });
  const c2 = await prisma.client.create({
    data: {
      code: `${PREFIX}_C2`,
      name: "C2 병원",
      type: "HOSPITAL",
      salesRepId: repB.id,
    },
    select: { id: true },
  });
  const c3 = await prisma.client.create({
    data: {
      code: `${PREFIX}_C3`,
      name: "C3 병원",
      type: "HOSPITAL",
      salesRepId: repB.id,
    },
    select: { id: true },
  });
  await prisma.salesAssignment.create({
    data: { clientId: c2.id, salesRepId: repA.id, active: true },
  });

  // ─── Invoices (이달 ISSUED/SENT) ─────────────────────
  const now = new Date();
  await prisma.invoice.createMany({
    data: [
      {
        invoiceNumber: `${PREFIX}-INV1`,
        clientId: c1.id,
        issueDate: now,
        status: "ISSUED",
        supplyAmount: 9091,
        vatAmount: 909,
        totalAmount: 10000,
      },
      {
        invoiceNumber: `${PREFIX}-INV2`,
        clientId: c2.id,
        issueDate: now,
        status: "SENT",
        supplyAmount: 18182,
        vatAmount: 1818,
        totalAmount: 20000,
      },
      {
        invoiceNumber: `${PREFIX}-INV3`,
        clientId: c3.id,
        issueDate: now,
        status: "ISSUED",
        supplyAmount: 27273,
        vatAmount: 2727,
        totalAmount: 30000,
      },
    ],
  });

  // ─── Payments (이달 PARTIAL/PAID) ────────────────────
  await prisma.payment.createMany({
    data: [
      {
        clientId: c1.id,
        paidAt: now,
        amount: 5000,
        method: "BANK_TRANSFER",
        status: "PARTIAL",
      },
      {
        clientId: c2.id,
        paidAt: now,
        amount: 15000,
        method: "BANK_TRANSFER",
        status: "PAID",
      },
      {
        clientId: c3.id,
        paidAt: now,
        amount: 20000,
        method: "BANK_TRANSFER",
        status: "PARTIAL",
      },
    ],
  });

  // ─── Ledgers (이달 balance) ──────────────────────────
  await prisma.closingLedger.createMany({
    data: [
      {
        clientId: c1.id,
        closingMonth: MONTH,
        carryOver: 0,
        monthlySales: 10000,
        received: 5000,
        balance: 5000,
      },
      {
        clientId: c2.id,
        closingMonth: MONTH,
        carryOver: 0,
        monthlySales: 20000,
        received: 15000,
        balance: 5000,
      },
      {
        clientId: c3.id,
        closingMonth: MONTH,
        carryOver: 0,
        monthlySales: 30000,
        received: 20000,
        balance: 10000,
      },
    ],
  });

  // ─── A. listSalesPerformanceByMonth ──────────────────
  const perf = await computeSalesPerformance(MONTH);
  const rowA = perf.find((r) => r.salesRepId === repA.id);
  const rowB = perf.find((r) => r.salesRepId === repB.id);
  if (!rowA || !rowB) throw new Error("[A] repA/repB 성과 행 누락");

  const expA = { sales: 30000, payment: 20000, outstanding: 10000, clients: 2 };
  if (rowA.salesTotal !== expA.sales)
    throw new Error(`[A] repA sales ${expA.sales} 기대, got ${rowA.salesTotal}`);
  if (rowA.paymentTotal !== expA.payment)
    throw new Error(
      `[A] repA payment ${expA.payment} 기대, got ${rowA.paymentTotal}`,
    );
  if (rowA.outstanding !== expA.outstanding)
    throw new Error(
      `[A] repA outstanding ${expA.outstanding} 기대, got ${rowA.outstanding}`,
    );
  if (rowA.clientCount !== expA.clients)
    throw new Error(
      `[A] repA clients ${expA.clients} 기대, got ${rowA.clientCount}`,
    );
  console.log(
    `✅ A. repA sales=${rowA.salesTotal} pay=${rowA.paymentTotal} out=${rowA.outstanding} clients=${rowA.clientCount}`,
  );

  const expB = { sales: 50000, payment: 35000, outstanding: 15000, clients: 2 };
  if (rowB.salesTotal !== expB.sales)
    throw new Error(`[A] repB sales ${expB.sales} 기대, got ${rowB.salesTotal}`);
  if (rowB.paymentTotal !== expB.payment)
    throw new Error(
      `[A] repB payment ${expB.payment} 기대, got ${rowB.paymentTotal}`,
    );
  if (rowB.outstanding !== expB.outstanding)
    throw new Error(
      `[A] repB outstanding ${expB.outstanding} 기대, got ${rowB.outstanding}`,
    );
  console.log(
    `✅ A. repB sales=${rowB.salesTotal} pay=${rowB.paymentTotal} out=${rowB.outstanding} clients=${rowB.clientCount}`,
  );

  // 정렬 검증 — 매출 desc 이면 repB 가 상위
  const ranked = perf.map((r) => r.salesRepId);
  if (ranked.indexOf(repB.id) >= ranked.indexOf(repA.id))
    throw new Error(`[A] repB 가 매출 desc 최상위여야 함 — got ${ranked}`);
  console.log("✅ A. 매출 desc 정렬 (repB > repA) 검증");

  // ─── B. client breakdown — repA ───────────────────────
  const brA = await computeClientBreakdown({ salesRepId: repA.id, month: MONTH });
  if (brA.length !== 2) throw new Error(`[B] repA 거래처 2건 기대 — ${brA.length}`);
  if (brA[0]!.clientId !== c2.id)
    throw new Error(`[B] desc 정렬 — C2 (2만) 선두여야 함`);
  if (brA[1]!.clientId !== c1.id)
    throw new Error(`[B] desc 정렬 — C1 (1만) 두번째여야 함`);
  if (brA[0]!.salesTotal !== 20000 || brA[1]!.salesTotal !== 10000)
    throw new Error(`[B] 거래처별 매출 합산 오류`);
  if (brA[0]!.paymentTotal !== 15000 || brA[1]!.paymentTotal !== 5000)
    throw new Error(`[B] 거래처별 입금 합산 오류`);
  if (brA[0]!.outstanding !== 5000 || brA[1]!.outstanding !== 5000)
    throw new Error(`[B] 거래처별 미수금 합산 오류`);
  console.log(
    `✅ B. repA breakdown — C2 ₩${brA[0]!.salesTotal} / C1 ₩${brA[1]!.salesTotal}`,
  );

  // ─── C. product breakdown — repA + COMPLETED 주문 ────
  // 제품 1개 + 사이즈 1개 + COMPLETED 주문 2건(C1, C2) 만들기
  const prod = await prisma.product.create({
    data: {
      code: `${PREFIX}_PROD`,
      name: "테스트 제품",
      category: "카테고리X",
      basePrice: 1000,
    },
    select: { id: true },
  });
  const size = await prisma.productSize.create({
    data: {
      productId: prod.id,
      sizeCode: "M",
      physicalStock: 100,
      availableStock: 100,
    },
    select: { id: true },
  });

  const o1 = await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}-O1`,
      clientId: c1.id,
      orderDate: now,
      status: "COMPLETED",
      completedAt: now,
    },
    select: { id: true },
  });
  await prisma.orderItem.create({
    data: {
      orderId: o1.id,
      productId: prod.id,
      productSizeId: size.id,
      quantity: 3,
      unitPrice: 1000,
      basePriceAtOrder: 1000,
      lineTotal: 3000,
    },
  });
  const o2 = await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}-O2`,
      clientId: c2.id,
      orderDate: now,
      status: "COMPLETED",
      completedAt: now,
    },
    select: { id: true },
  });
  await prisma.orderItem.create({
    data: {
      orderId: o2.id,
      productId: prod.id,
      productSizeId: size.id,
      quantity: 5,
      unitPrice: 1000,
      basePriceAtOrder: 1000,
      lineTotal: 5000,
    },
  });

  const pdA = await computeProductBreakdown({ salesRepId: repA.id, month: MONTH });
  if (pdA.length !== 1)
    throw new Error(`[C] 같은 product/size → 1행 집계 기대 — ${pdA.length}`);
  if (pdA[0]!.qty !== 8)
    throw new Error(`[C] qty=8 기대(3+5), got ${pdA[0]!.qty}`);
  if (pdA[0]!.amount !== 8000)
    throw new Error(`[C] amount=8000 기대, got ${pdA[0]!.amount}`);
  console.log(
    `✅ C. repA product breakdown — 1행, qty=${pdA[0]!.qty}, amount=₩${pdA[0]!.amount}`,
  );

  // ─── D. 비배정 담당자 검증 — C3 만 담당한 repB 는 제품 출고 없음 ─
  // C3 에는 COMPLETED 주문 없으므로 product breakdown = []
  const pdB = await computeProductBreakdown({ salesRepId: repB.id, month: MONTH });
  // repB 는 C2+C3 담당. C2 에 출고 있으므로 1행은 나옴 — 확인
  if (pdB.length !== 1)
    throw new Error(`[D] repB 는 C2 COMPLETED 1행이 나와야 함 — got ${pdB.length}`);
  if (pdB[0]!.qty !== 5)
    throw new Error(`[D] repB qty=5 기대(C2 only), got ${pdB[0]!.qty}`);
  console.log(`✅ D. repB product breakdown — C2 qty=${pdB[0]!.qty}`);

  console.log("\n[smoke-sales-performance] all scenarios passed ✅");
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
