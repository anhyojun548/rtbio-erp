/**
 * Phase 3D-4c 스모크 — 월간 보고서 집계 검증 (R16).
 *
 * 전략: 테스트용 fixture(Invoice · Payment · Shipment · ClosingLedger)를 한 달에 주입하고
 * `computeMonthlyReport` 가 올바른 합을 반환하는지 검증. 끝에 정리.
 *
 * 시나리오:
 *   A. 빈 월 (당월) — 모든 집계 0
 *   B. Invoice/Payment/Shipment 혼합 fixture 월 — 상태별 분포, 합계, Top 거래처, 원장 요약
 *
 * 실행: `npx tsx scripts/smoke-monthly-report.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { computeMonthlyReport } from "../src/lib/actions/report";

const dec = (n: number) => new Prisma.Decimal(n.toFixed(2));

async function seedFixture(month: string, clientAId: string, clientBId: string, sizeId: string, productId: string, stageId: string) {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const d10 = new Date(year, mon - 1, 10, 12, 0, 0);
  const d15 = new Date(year, mon - 1, 15, 12, 0, 0);
  const d20 = new Date(year, mon - 1, 20, 12, 0, 0);
  const d25 = new Date(year, mon - 1, 25, 12, 0, 0);

  const createdOrders: string[] = [];
  const createdInvoices: string[] = [];
  const createdPayments: string[] = [];
  const createdShipments: string[] = [];
  const createdLedgers: string[] = [];

  // ── 주문+완료 shipment (A: qty=2, amount=2000; B: qty=5, amount=5000)
  for (const [ci, qty, orderNumPrefix] of [
    [clientAId, 2, `SMOKE-R-${month}-A`],
    [clientBId, 5, `SMOKE-R-${month}-B`],
  ] as const) {
    const order = await prisma.order.create({
      data: {
        orderNumber: orderNumPrefix,
        clientId: ci,
        status: "COMPLETED",
        orderDate: d10,
        confirmedAt: d10,
        completedAt: d15,
        billingMonth: month,
        shipToRecipient: "수령",
        shipToAddress: "주소",
        items: {
          create: [
            {
              productId,
              productSizeId: sizeId,
              quantity: qty,
              unitPrice: dec(1000),
              basePriceAtOrder: dec(1000),
              discountRateAtOrder: null,
              fixedPriceAppliedAtOrder: false,
              lineTotal: dec(1000 * qty),
            },
          ],
        },
      },
    });
    createdOrders.push(order.id);
    const sh = await prisma.shipment.create({
      data: {
        orderId: order.id,
        currentStageId: stageId,
        enteredStageAt: d15,
        completedAt: d15,
      },
    });
    createdShipments.push(sh.id);
  }

  // ── Invoice fixture
  // A: ISSUED 2000
  const invA1 = await prisma.invoice.create({
    data: {
      invoiceNumber: `SMOKE-R-INV-A1-${month}`,
      clientId: clientAId,
      orderId: createdOrders[0]!,
      status: "ISSUED",
      issueDate: d15,
      supplyAmount: dec(2000),
      vatAmount: dec(200),
      totalAmount: dec(2200),
    },
  });
  createdInvoices.push(invA1.id);
  // B: SENT 5000
  const invB1 = await prisma.invoice.create({
    data: {
      invoiceNumber: `SMOKE-R-INV-B1-${month}`,
      clientId: clientBId,
      orderId: createdOrders[1]!,
      status: "SENT",
      issueDate: d20,
      sentAt: d25,
      supplyAmount: dec(5000),
      vatAmount: dec(500),
      totalAmount: dec(5500),
    },
  });
  createdInvoices.push(invB1.id);
  // A: DRAFT 1000 (합계 제외)
  const invA2 = await prisma.invoice.create({
    data: {
      invoiceNumber: `SMOKE-R-INV-A2-${month}-DRAFT`,
      clientId: clientAId,
      status: "DRAFT",
      issueDate: d25,
      supplyAmount: dec(1000),
      vatAmount: dec(100),
      totalAmount: dec(1100),
    },
  });
  createdInvoices.push(invA2.id);
  // B: CANCELLED 500 (합계 제외)
  const invB2 = await prisma.invoice.create({
    data: {
      invoiceNumber: `SMOKE-R-INV-B2-${month}-CXL`,
      clientId: clientBId,
      status: "CANCELLED",
      issueDate: d25,
      supplyAmount: dec(500),
      vatAmount: dec(50),
      totalAmount: dec(550),
    },
  });
  createdInvoices.push(invB2.id);

  // ── Payment fixture
  // PAID 2200 (A 전액)
  const payA = await prisma.payment.create({
    data: {
      clientId: clientAId,
      status: "PAID",
      amount: dec(2200),
      paidAt: d20,
      method: "계좌이체",
    },
  });
  createdPayments.push(payA.id);
  // PARTIAL 3000 (B 부분)
  const payB1 = await prisma.payment.create({
    data: {
      clientId: clientBId,
      status: "PARTIAL",
      amount: dec(3000),
      paidAt: d25,
      method: "계좌이체",
    },
  });
  createdPayments.push(payB1.id);
  // PENDING 999 (합계 제외)
  const payB2 = await prisma.payment.create({
    data: {
      clientId: clientBId,
      status: "PENDING",
      amount: dec(999),
      paidAt: d25,
      method: "계좌이체",
      note: "[취소]",
    },
  });
  createdPayments.push(payB2.id);

  // ── Ledger fixture
  const ledgerA = await prisma.closingLedger.create({
    data: {
      clientId: clientAId,
      closingMonth: month,
      carryOver: dec(500),
      monthlySales: dec(2200),
      received: dec(2200),
      balance: dec(500), // 500 + 2200 - 2200
    },
  });
  createdLedgers.push(ledgerA.id);
  const ledgerB = await prisma.closingLedger.create({
    data: {
      clientId: clientBId,
      closingMonth: month,
      carryOver: dec(1000),
      monthlySales: dec(5500),
      received: dec(3000),
      balance: dec(3500), // 1000 + 5500 - 3000
      closedAt: d25,
    },
  });
  createdLedgers.push(ledgerB.id);

  return {
    orderIds: createdOrders,
    invoiceIds: createdInvoices,
    paymentIds: createdPayments,
    shipmentIds: createdShipments,
    ledgerIds: createdLedgers,
  };
}

async function cleanup(ids: {
  orderIds: string[];
  invoiceIds: string[];
  paymentIds: string[];
  shipmentIds: string[];
  ledgerIds: string[];
}) {
  await prisma.payment.deleteMany({ where: { id: { in: ids.paymentIds } } });
  await prisma.invoiceItem.deleteMany({
    where: { invoiceId: { in: ids.invoiceIds } },
  });
  await prisma.invoice.deleteMany({ where: { id: { in: ids.invoiceIds } } });
  await prisma.shipmentStageLog.deleteMany({
    where: { shipmentId: { in: ids.shipmentIds } },
  });
  await prisma.shipment.deleteMany({ where: { id: { in: ids.shipmentIds } } });
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: ids.orderIds } },
  });
  await prisma.order.deleteMany({ where: { id: { in: ids.orderIds } } });
  await prisma.closingLedger.deleteMany({
    where: { id: { in: ids.ledgerIds } },
  });
}

async function main() {
  // 사용할 엔티티 확보
  const size = await prisma.productSize.findFirst({
    include: { product: { select: { id: true } } },
  });
  if (!size) throw new Error("사이즈 없음");
  const clientA = await prisma.client.findFirst({ where: { active: true } });
  if (!clientA) throw new Error("거래처 없음");
  const clientB = await prisma.client.findFirst({
    where: { active: true, id: { not: clientA.id } },
  });
  if (!clientB) throw new Error("두 번째 거래처 필요");
  const terminal = await prisma.kanbanColumn.findFirst({
    where: { isTerminal: true },
  });
  if (!terminal) throw new Error("terminal 스테이지 없음");

  // 테스트 월 — 먼 과거(2023-11) 로 설정해서 실데이터와 겹치지 않게
  const testMonth = "2023-11";
  const emptyMonth = "2023-10";

  // ─── A. 빈 월 ──────────────────────────────────
  const empty = await computeMonthlyReport(emptyMonth);
  if (empty.invoices.total !== 0)
    throw new Error(`[A] 빈월 invoice.total ${empty.invoices.total}`);
  if (empty.payments.total !== 0)
    throw new Error(`[A] 빈월 payments.total ${empty.payments.total}`);
  if (empty.shipments.completed !== 0)
    throw new Error(`[A] 빈월 shipments ${empty.shipments.completed}`);
  if (empty.ledgerSummary.clients !== 0)
    throw new Error(`[A] 빈월 ledger ${empty.ledgerSummary.clients}`);
  console.log(`✓ [A] 빈 월 (${emptyMonth}) — 모든 집계 0`);

  // ─── B. Fixture 월 ─────────────────────────────
  const fixtureIds = await seedFixture(
    testMonth,
    clientA.id,
    clientB.id,
    size.id,
    size.product.id,
    terminal.id,
  );

  try {
    const r = await computeMonthlyReport(testMonth);

    // Invoice 합계: ISSUED 2200 + SENT 5500 = 7700, 총 2건 (DRAFT/CANCELLED 제외)
    if (r.invoices.total !== 2)
      throw new Error(`[B] invoices.total 기대 2, 실제 ${r.invoices.total}`);
    if (r.invoices.totalAmount !== 7700)
      throw new Error(
        `[B] invoices.totalAmount 기대 7700, 실제 ${r.invoices.totalAmount}`,
      );
    if (r.invoices.byStatus.ISSUED.amount !== 2200)
      throw new Error(`[B] ISSUED ${r.invoices.byStatus.ISSUED.amount}`);
    if (r.invoices.byStatus.SENT.amount !== 5500)
      throw new Error(`[B] SENT ${r.invoices.byStatus.SENT.amount}`);
    if (r.invoices.byStatus.DRAFT.amount !== 1100)
      throw new Error(`[B] DRAFT ${r.invoices.byStatus.DRAFT.amount}`);
    if (r.invoices.byStatus.CANCELLED.amount !== 550)
      throw new Error(`[B] CANCELLED ${r.invoices.byStatus.CANCELLED.amount}`);
    console.log(
      `✓ [B] Invoice 집계 (total=7700, ISSUED=2200 · SENT=5500 · DRAFT=1100 · CXL=550)`,
    );

    // Payment 합계: PAID 2200 + PARTIAL 3000 = 5200, 2건 (PENDING 제외)
    if (r.payments.total !== 2)
      throw new Error(`[B] payments.total ${r.payments.total}`);
    if (r.payments.totalAmount !== 5200)
      throw new Error(
        `[B] payments.totalAmount 기대 5200, 실제 ${r.payments.totalAmount}`,
      );
    if (r.payments.byStatus.PAID.amount !== 2200)
      throw new Error(`[B] PAID ${r.payments.byStatus.PAID.amount}`);
    if (r.payments.byStatus.PARTIAL.amount !== 3000)
      throw new Error(`[B] PARTIAL ${r.payments.byStatus.PARTIAL.amount}`);
    if (r.payments.byStatus.PENDING.amount !== 999)
      throw new Error(`[B] PENDING ${r.payments.byStatus.PENDING.amount}`);
    console.log(
      `✓ [B] Payment 집계 (total=5200, PAID=2200 · PARTIAL=3000, PENDING=999 제외됨)`,
    );

    // Shipment 집계: 2건 완료, qty=2+5=7, amount=2000+5000=7000
    if (r.shipments.completed !== 2)
      throw new Error(`[B] shipments.completed ${r.shipments.completed}`);
    if (r.shipments.totalQty !== 7)
      throw new Error(`[B] shipments.totalQty ${r.shipments.totalQty}`);
    if (r.shipments.totalAmount !== 7000)
      throw new Error(`[B] shipments.totalAmount ${r.shipments.totalAmount}`);
    console.log(
      `✓ [B] Shipment 집계 (완료=2건, qty=7, amount=7000)`,
    );

    // Top 클라이언트: B=5500 > A=2200
    if (r.topClients.length !== 2)
      throw new Error(`[B] topClients.length ${r.topClients.length}`);
    if (r.topClients[0]!.clientId !== clientB.id)
      throw new Error(`[B] top 1 은 B 기대`);
    if (r.topClients[0]!.totalAmount !== 5500)
      throw new Error(`[B] top B amount ${r.topClients[0]!.totalAmount}`);
    if (r.topClients[1]!.clientId !== clientA.id)
      throw new Error(`[B] top 2 는 A 기대`);
    console.log(
      `✓ [B] Top 거래처 (1위 B=5500 · 2위 A=2200)`,
    );

    // Ledger 요약: 2건 (1 마감), carry=1500 / sales=7700 / received=5200 / balance=4000
    if (r.ledgerSummary.clients !== 2)
      throw new Error(`[B] ledger clients ${r.ledgerSummary.clients}`);
    if (r.ledgerSummary.closed !== 1)
      throw new Error(`[B] ledger closed ${r.ledgerSummary.closed}`);
    if (r.ledgerSummary.carryOver !== 1500)
      throw new Error(`[B] carryOver ${r.ledgerSummary.carryOver}`);
    if (r.ledgerSummary.monthlySales !== 7700)
      throw new Error(`[B] monthlySales ${r.ledgerSummary.monthlySales}`);
    if (r.ledgerSummary.received !== 5200)
      throw new Error(`[B] received ${r.ledgerSummary.received}`);
    if (r.ledgerSummary.balance !== 4000)
      throw new Error(`[B] balance ${r.ledgerSummary.balance}`);
    console.log(
      `✓ [B] Ledger 요약 (carry=1500 + sales=7700 - received=5200 = balance=4000)`,
    );

    console.log(`\n✅ Monthly Report 스모크 통과.`);
  } finally {
    await cleanup(fixtureIds);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
