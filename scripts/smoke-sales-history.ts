/**
 * Phase 3G-3 스모크 — 기간별 영업 이력서(Sales History) 집계 검증.
 *
 * 시나리오:
 *   1. rep 1명 + 거래처 2개(C1 직접, C2 배정) + 범위 밖 C3
 *   2. 기간 내 ORDER_CREATED 3건 (C1 2건, C2 1건) + 범위 밖 1건 (제외 확인)
 *   3. INVOICE_ISSUED 2건 (ISSUED+SENT) + DRAFT 1건 (제외 확인)
 *   4. PAYMENT_RECEIVED 2건 (PARTIAL+PAID) + PENDING 1건 (제외 확인)
 *   5. CONFERENCE_VISITOR 2건 (assignedRepId = rep, 범위 내)
 *   6. totals 집계 검증, byClient 정렬(매출 desc), events 타임라인 desc
 *
 * 실행: `npx tsx scripts/smoke-sales-history.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { computeSalesHistory } from "../src/lib/actions/sales-history";

const PREFIX = `SMOKE_SH_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// 기간: 2026-04-01 ~ 2026-04-30 (30일)
const WINDOW_FROM = new Date("2026-04-01T00:00:00");
const WINDOW_TO = new Date("2026-04-30T23:59:59");

// 범위 내 · 범위 밖 날짜
const IN_EARLY = new Date("2026-04-05T10:00:00");
const IN_MID = new Date("2026-04-15T14:00:00");
const IN_LATE = new Date("2026-04-28T09:00:00");
const BEFORE = new Date("2026-03-30T12:00:00");

async function cleanup() {
  await prisma.payment.deleteMany({
    where: { note: { startsWith: PREFIX } },
  });
  await prisma.invoiceItem.deleteMany({
    where: { invoice: { invoiceNumber: { startsWith: PREFIX } } },
  });
  await prisma.invoice.deleteMany({
    where: { invoiceNumber: { startsWith: PREFIX } },
  });
  await prisma.orderItem.deleteMany({
    where: { order: { orderNumber: { startsWith: PREFIX } } },
  });
  await prisma.order.deleteMany({
    where: { orderNumber: { startsWith: PREFIX } },
  });
  await prisma.conferenceVisitor.deleteMany({
    where: { conference: { name: { startsWith: PREFIX } } },
  });
  await prisma.conference.deleteMany({
    where: { name: { startsWith: PREFIX } },
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
  await prisma.client.deleteMany({
    where: { code: { startsWith: PREFIX } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: PREFIX.toLowerCase() } },
  });
}

async function main() {
  console.log(`[smoke-sales-history] prefix=${PREFIX}`);
  await cleanup();

  const tenant = await prisma.tenant.findFirst({
    where: { subdomain: "altibio" },
  });
  if (!tenant) throw new Error("altibio 테넌트 없음 — seed 먼저 돌려야 함");

  // ─── Setup: rep + 3 clients + product + size ────────
  const rep = await prisma.user.create({
    data: {
      email: `${PREFIX.toLowerCase()}_rep@test.local`,
      password: "x",
      name: `${PREFIX} 담당자`,
      role: "EXEC",
      tenantId: tenant.id,
      active: true,
    },
    select: { id: true },
  });
  const c1 = await prisma.client.create({
    data: {
      code: `${PREFIX}_C1`,
      name: `${PREFIX} 거래처1 (직접)`,
      type: "HOSPITAL",
      active: true,
      salesRepId: rep.id,
    },
    select: { id: true },
  });
  const c2 = await prisma.client.create({
    data: {
      code: `${PREFIX}_C2`,
      name: `${PREFIX} 거래처2 (배정)`,
      type: "AGENCY",
      active: true,
    },
    select: { id: true },
  });
  const c3 = await prisma.client.create({
    data: {
      code: `${PREFIX}_C3`,
      name: `${PREFIX} 거래처3 (미담당)`,
      type: "HOSPITAL",
      active: true,
    },
    select: { id: true },
  });
  await prisma.salesAssignment.create({
    data: { clientId: c2.id, salesRepId: rep.id, active: true },
  });

  const prod = await prisma.product.create({
    data: {
      code: `${PREFIX}_P`,
      name: `${PREFIX} 제품`,
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
  console.log(
    `✅ Setup: rep + 3 clients (C1 직접, C2 배정, C3 미담당) + product/size`,
  );

  // ─── 1. 주문 4건 (3건 범위 내, 1건 범위 밖) ──────────
  const ord1 = await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}_O1`,
      clientId: c1.id,
      orderDate: IN_EARLY,
      createdAt: IN_EARLY,
      status: "DRAFT",
      items: {
        create: [
          {
            productId: prod.id,
            productSizeId: size.id,
            quantity: 10,
            unitPrice: new Prisma.Decimal(1000),
            lineTotal: new Prisma.Decimal(10000),
            basePriceAtOrder: new Prisma.Decimal(1000),
          },
        ],
      },
    },
    select: { id: true },
  });
  const ord2 = await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}_O2`,
      clientId: c1.id,
      orderDate: IN_MID,
      createdAt: IN_MID,
      status: "DRAFT",
      items: {
        create: [
          {
            productId: prod.id,
            productSizeId: size.id,
            quantity: 5,
            unitPrice: new Prisma.Decimal(2000),
            lineTotal: new Prisma.Decimal(10000),
            basePriceAtOrder: new Prisma.Decimal(2000),
          },
        ],
      },
    },
    select: { id: true },
  });
  const ord3 = await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}_O3`,
      clientId: c2.id,
      orderDate: IN_LATE,
      createdAt: IN_LATE,
      status: "DRAFT",
      items: {
        create: [
          {
            productId: prod.id,
            productSizeId: size.id,
            quantity: 3,
            unitPrice: new Prisma.Decimal(5000),
            lineTotal: new Prisma.Decimal(15000),
            basePriceAtOrder: new Prisma.Decimal(5000),
          },
        ],
      },
    },
    select: { id: true },
  });
  await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}_OX`,
      clientId: c1.id,
      orderDate: BEFORE,
      createdAt: BEFORE,
      status: "DRAFT",
      items: {
        create: [
          {
            productId: prod.id,
            productSizeId: size.id,
            quantity: 1,
            unitPrice: new Prisma.Decimal(99999),
            lineTotal: new Prisma.Decimal(99999),
            basePriceAtOrder: new Prisma.Decimal(99999),
          },
        ],
      },
    },
  });
  console.log(`✅ 1. 주문 4건 (범위 내 3: O1/O2/O3 C1×2+C2×1, 범위 밖 1: OX)`);

  // ─── 2. Invoice 3건 (2건 ISSUED/SENT, 1건 DRAFT 제외) ─
  await prisma.invoice.create({
    data: {
      invoiceNumber: `${PREFIX}-INV-1`,
      clientId: c1.id,
      orderId: ord1.id,
      issueDate: IN_EARLY,
      supplyAmount: new Prisma.Decimal(10000),
      vatAmount: new Prisma.Decimal(1000),
      totalAmount: new Prisma.Decimal(11000),
      status: "ISSUED",
    },
  });
  await prisma.invoice.create({
    data: {
      invoiceNumber: `${PREFIX}-INV-2`,
      clientId: c2.id,
      orderId: ord3.id,
      issueDate: IN_LATE,
      supplyAmount: new Prisma.Decimal(15000),
      vatAmount: new Prisma.Decimal(1500),
      totalAmount: new Prisma.Decimal(16500),
      status: "SENT",
    },
  });
  await prisma.invoice.create({
    data: {
      invoiceNumber: `${PREFIX}-INV-3`,
      clientId: c1.id,
      orderId: ord2.id,
      issueDate: IN_MID,
      supplyAmount: new Prisma.Decimal(10000),
      vatAmount: new Prisma.Decimal(1000),
      totalAmount: new Prisma.Decimal(11000),
      status: "DRAFT", // 제외
    },
  });
  console.log(`✅ 2. Invoice 3건 (ISSUED+SENT 2건 포함, DRAFT 1건 제외)`);

  // ─── 3. Payment 3건 (2건 PARTIAL/PAID, 1건 PENDING 제외) ─
  await prisma.payment.create({
    data: {
      clientId: c1.id,
      amount: new Prisma.Decimal(7000),
      paidAt: IN_MID,
      method: "계좌이체",
      status: "PARTIAL",
      note: `${PREFIX} p1`,
    },
  });
  await prisma.payment.create({
    data: {
      clientId: c2.id,
      amount: new Prisma.Decimal(16500),
      paidAt: IN_LATE,
      method: "계좌이체",
      status: "PAID",
      note: `${PREFIX} p2`,
    },
  });
  await prisma.payment.create({
    data: {
      clientId: c1.id,
      amount: new Prisma.Decimal(5000),
      paidAt: IN_EARLY,
      method: "현금",
      status: "PENDING", // 제외
      note: `${PREFIX} p3`,
    },
  });
  console.log(`✅ 3. Payment 3건 (PARTIAL+PAID 2건 포함, PENDING 1건 제외)`);

  // ─── 4. Conference + Visitor ─────────────────────────
  const conf = await prisma.conference.create({
    data: {
      name: `${PREFIX} 학회`,
      startDate: IN_EARLY,
      endDate: IN_LATE,
    },
    select: { id: true },
  });
  await prisma.conferenceVisitor.create({
    data: {
      conferenceId: conf.id,
      name: "방문자 A",
      assignedRepId: rep.id,
      createdAt: IN_EARLY,
    },
  });
  await prisma.conferenceVisitor.create({
    data: {
      conferenceId: conf.id,
      name: "방문자 B",
      assignedRepId: rep.id,
      createdAt: IN_LATE,
    },
  });
  // 범위 밖 visitor
  await prisma.conferenceVisitor.create({
    data: {
      conferenceId: conf.id,
      name: "방문자 이전",
      assignedRepId: rep.id,
      createdAt: BEFORE,
    },
  });
  console.log(`✅ 4. Visitor 3건 (범위 내 2, 범위 밖 1)`);

  // ─── 5. 집계 실행 및 검증 ────────────────────────────
  const h = await computeSalesHistory({
    salesRepId: rep.id,
    from: WINDOW_FROM,
    to: WINDOW_TO,
  });

  if (h.totals.orders.count !== 3)
    throw new Error(
      `[5] orders.count 3 기대, 실제 ${h.totals.orders.count}`,
    );
  if (h.totals.orders.amount !== 35000)
    throw new Error(
      `[5] orders.amount 35000 기대 (10000+10000+15000), 실제 ${h.totals.orders.amount}`,
    );
  if (h.totals.invoices.count !== 2)
    throw new Error(
      `[5] invoices.count 2 기대, 실제 ${h.totals.invoices.count}`,
    );
  if (h.totals.invoices.amount !== 27500)
    throw new Error(
      `[5] invoices.amount 27500 기대 (11000+16500), 실제 ${h.totals.invoices.amount}`,
    );
  if (h.totals.payments.count !== 2)
    throw new Error(
      `[5] payments.count 2 기대, 실제 ${h.totals.payments.count}`,
    );
  if (h.totals.payments.amount !== 23500)
    throw new Error(
      `[5] payments.amount 23500 기대 (7000+16500), 실제 ${h.totals.payments.amount}`,
    );
  if (h.totals.visitors.count !== 2)
    throw new Error(
      `[5] visitors.count 2 기대, 실제 ${h.totals.visitors.count}`,
    );
  console.log(
    `✅ 5. totals — orders 3/35000 · invoices 2/27500 · payments 2/23500 · visitors 2 ✓`,
  );

  // ─── 6. byClient — C2(16500) > C1(11000) ─────────────
  if (h.byClient.length !== 2)
    throw new Error(
      `[6] byClient 2 기대 (C1/C2), 실제 ${h.byClient.length}`,
    );
  if (h.byClient[0]!.clientId !== c2.id)
    throw new Error(
      `[6] byClient[0] = C2 기대 (invoice desc), 실제 ${h.byClient[0]!.clientName}`,
    );
  if (h.byClient[0]!.invoiceAmount !== 16500)
    throw new Error(
      `[6] C2 invoiceAmount 16500 기대, 실제 ${h.byClient[0]!.invoiceAmount}`,
    );
  if (h.byClient[1]!.clientId !== c1.id || h.byClient[1]!.orders !== 2)
    throw new Error(
      `[6] byClient[1] = C1 w/ 2 orders 기대, 실제 ${h.byClient[1]!.clientName}/${h.byClient[1]!.orders}`,
    );
  console.log(
    `✅ 6. byClient — C2 (invoice=16500) > C1 (invoice=11000, orders=2) ✓`,
  );

  // ─── 7. events 타임라인 desc 정렬 ──────────────────
  const eventCount =
    h.totals.orders.count +
    h.totals.invoices.count +
    h.totals.payments.count +
    h.totals.visitors.count;
  if (h.events.length !== eventCount)
    throw new Error(
      `[7] events ${eventCount} 기대, 실제 ${h.events.length}`,
    );
  for (let i = 1; i < h.events.length; i++) {
    if (h.events[i - 1]!.occurredAt.getTime() < h.events[i]!.occurredAt.getTime()) {
      throw new Error(`[7] events[${i}] desc 정렬 깨짐`);
    }
  }
  // C3 이 범위 내 활동 없음 — byClient 에 나타나면 안 됨
  if (h.byClient.find((c) => c.clientId === c3.id))
    throw new Error(`[7] C3 는 범위 내 활동 없으므로 byClient 에 없어야 함`);
  console.log(
    `✅ 7. events ${h.events.length}건 desc 정렬 · C3 (미담당) 포함 안됨 ✓`,
  );

  console.log("\n[smoke-sales-history] all scenarios passed ✅");
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
