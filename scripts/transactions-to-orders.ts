/**
 * 41K TransactionLedger → Order / OrderItem / Invoice / Payment / ClosingLedger 변환
 *
 * 그룹핑 전략: (clientCode, YYYY-MM) 별 1 Order (SALE 만)
 * - 거래처 126 × 10개월 ≈ ~1,260 Orders (SALE 만, clientCode null 제외)
 *
 * 실행: pnpm tsx scripts/transactions-to-orders.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/** productCode 를 Product.code 와 동일한 규칙으로 정규화 (replace-seed-from-transactions.ts 참조) */
function normalizeProductCode(raw: string): string {
  return raw
    .replace(/[()]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "")
    .slice(0, 32);
}

/** YYYY-MM 의 말일(last day) 반환 */
function lastDayOfMonth(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m!, 0); // day=0 → 전달 말일
}

/** 날짜에 N일 더하기 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

async function main() {
  const startTime = Date.now();
  console.log("=== transactions-to-orders 시작 ===\n");

  // ─── 1. 데이터 로드 ────────────────────────────────────────────
  console.log("--- 1. 데이터 로드 ---");
  const transactions = await prisma.transactionLedger.findMany({
    where: { kind: "SALE" },
    orderBy: { txnDate: "asc" },
  });
  console.log(`Loaded ${transactions.length} SALE transactions`);

  const clients = await prisma.client.findMany({ where: { active: true } });
  const clientByCode = new Map(clients.map((c) => [c.code, c]));
  console.log(`Clients (active): ${clients.length}`);

  const products = await prisma.product.findMany({
    where: { active: true },
    include: { sizes: true },
  });
  // code → product (sizes 포함)
  const productByCode = new Map(products.map((p) => [p.code, p]));
  console.log(`Products (active): ${products.length}`);

  // ─── 2. (clientCode, month) 별 그룹핑 ─────────────────────────
  console.log("\n--- 2. 그룹핑 (clientCode × month) ---");
  type TxnRow = (typeof transactions)[number];
  const groups = new Map<string, TxnRow[]>();

  for (const t of transactions) {
    if (!t.clientCode) continue;
    const month = t.txnDate.toISOString().slice(0, 7); // YYYY-MM
    const key = `${t.clientCode}|${month}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  console.log(`Total groups → Orders: ${groups.size}`);

  // ─── 3. 기존 데이터 삭제 (cascade 역순) ────────────────────────
  console.log("\n--- 3. 기존 Order/Invoice/Payment/ClosingLedger 삭제 ---");
  await prisma.payment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.closingLedger.deleteMany({});
  console.log("Cleared existing records");

  // ─── 4. Order + OrderItem + Invoice + Payment 생성 ─────────────
  console.log("\n--- 4. Order / OrderItem / Invoice / Payment 생성 ---");
  let orderSeq = 1;
  let invoiceSeq = 1;
  let createdOrders = 0;
  let unmatchedItems = 0;
  let skippedGroups = 0;

  for (const [key, txns] of groups) {
    const [clientCode, month] = key.split("|");
    const client = clientByCode.get(`C-${clientCode}`);
    if (!client) {
      skippedGroups++;
      continue;
    }

    // OrderItem 빌드
    type ItemData = {
      productId: string;
      productSizeId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      basePriceAtOrder: Prisma.Decimal;
      discountRateAtOrder: Prisma.Decimal | null;
      fixedPriceAppliedAtOrder: boolean;
      lineTotal: Prisma.Decimal;
    };
    const items: ItemData[] = [];
    let groupSupply = 0;
    let groupVat = 0;

    for (const t of txns) {
      if (!t.productCode) {
        unmatchedItems++;
        continue;
      }
      const normalizedCode = normalizeProductCode(t.productCode);
      const product = productByCode.get(normalizedCode);
      if (!product || product.sizes.length === 0) {
        unmatchedItems++;
        continue;
      }
      const size = product.sizes[0]!; // STD (유일 사이즈)
      const qty = Number(t.qty);
      const unitPrice = new Prisma.Decimal(Number(t.unitPrice).toFixed(2));
      const lineTotal = new Prisma.Decimal(Number(t.totalAmount).toFixed(2));

      items.push({
        productId: product.id,
        productSizeId: size.id,
        quantity: qty,
        unitPrice,
        basePriceAtOrder: unitPrice,
        discountRateAtOrder: null,
        fixedPriceAppliedAtOrder: false,
        lineTotal,
      });

      groupSupply += Number(t.supplyAmount);
      groupVat += Number(t.vat);
    }

    if (items.length === 0) {
      skippedGroups++;
      continue;
    }

    const totalAmount = items.reduce(
      (s, it) => s + Number(it.lineTotal),
      0,
    );
    const firstTxn = txns[0]!;
    const lastTxn = txns[txns.length - 1]!;
    const orderDate = firstTxn.txnDate;

    // orderNumber: ORD-YYYYMMDD-NNN (월 첫 거래일 기준)
    const orderDateStr = orderDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const orderNumber = `ORD-${orderDateStr}-${String(orderSeq++).padStart(3, "0")}`;

    // Order 생성
    const order = await prisma.order.create({
      data: {
        orderNumber,
        clientId: client.id,
        status: "COMPLETED",
        orderDate,
        confirmedAt: firstTxn.txnDate,
        completedAt: lastTxn.txnDate,
        invoiceIssued: true,
        billingMonth: month,
        shipToLabel: client.name,
        shipToRecipient: client.representative ?? "",
        shipToPhone: client.phone ?? "",
        shipToAddress: client.address ?? "",
        createdBy: "transactions-to-orders",
        createdAt: firstTxn.txnDate,
        items: { create: items },
      },
    });
    createdOrders++;

    // Invoice 생성
    const issueDate = lastDayOfMonth(month!);
    const dueDate = addDays(issueDate, 30);
    const invoiceDateStr = issueDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const invoiceNumber = `INV-${invoiceDateStr}-${String(invoiceSeq++).padStart(3, "0")}`;

    const supplyAmount = new Prisma.Decimal(groupSupply.toFixed(2));
    const vatAmount = new Prisma.Decimal(groupVat.toFixed(2));
    const invoiceTotal = new Prisma.Decimal(
      (groupSupply + groupVat).toFixed(2),
    );

    await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: client.id,
        orderId: order.id,
        issueDate,
        dueDate,
        supplyAmount,
        vatAmount,
        totalAmount: invoiceTotal,
        status: "ISSUED",
        sentAt: issueDate,
        createdBy: "transactions-to-orders",
        createdAt: issueDate,
        items: {
          create: items.map((it) => ({
            description: "거래원장 품목",
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: it.lineTotal,
          })),
        },
      },
    });

    // Payment 생성 (invoice 총액을 30일 후 PAID 처리)
    await prisma.payment.create({
      data: {
        clientId: client.id,
        amount: invoiceTotal,
        paidAt: dueDate,
        method: "계좌이체",
        status: "PAID",
        createdBy: "transactions-to-orders",
        createdAt: dueDate,
      },
    });

    if (createdOrders % 100 === 0) {
      console.log(`  ${createdOrders} orders created...`);
    }
  }

  console.log(`\nOrders created:       ${createdOrders}`);
  console.log(`Groups skipped:       ${skippedGroups}`);
  console.log(`Items unmatched:      ${unmatchedItems}`);

  // ─── 5. ClosingLedger 생성 ─────────────────────────────────────
  console.log("\n--- 5. ClosingLedger 생성 ---");

  // Invoice ISSUED+SENT → 거래처×월별 매출
  const allInvoices = await prisma.invoice.findMany({
    where: { status: { in: ["ISSUED", "SENT"] } },
    select: { clientId: true, totalAmount: true, issueDate: true },
  });

  // Payment PAID → 거래처×입금월별 수금
  const allPayments = await prisma.payment.findMany({
    where: { status: "PAID" },
    select: { clientId: true, amount: true, paidAt: true },
  });

  type LedgerAccum = {
    clientId: string;
    month: string;
    sales: number;
    received: number;
  };
  const ledgerMap = new Map<string, LedgerAccum>();

  for (const inv of allInvoices) {
    const month = inv.issueDate.toISOString().slice(0, 7);
    const k = `${inv.clientId}|${month}`;
    if (!ledgerMap.has(k))
      ledgerMap.set(k, { clientId: inv.clientId, month, sales: 0, received: 0 });
    ledgerMap.get(k)!.sales += Number(inv.totalAmount);
  }

  for (const p of allPayments) {
    if (!p.paidAt) continue;
    const month = p.paidAt.toISOString().slice(0, 7);
    const k = `${p.clientId}|${month}`;
    if (!ledgerMap.has(k))
      ledgerMap.set(k, {
        clientId: p.clientId,
        month,
        sales: 0,
        received: 0,
      });
    ledgerMap.get(k)!.received += Number(p.amount);
  }

  // clientId→month asc 정렬 → carry 누적
  const ledgerArr = Array.from(ledgerMap.values()).sort((a, b) =>
    a.clientId === b.clientId
      ? a.month.localeCompare(b.month)
      : a.clientId.localeCompare(b.clientId),
  );

  const carryByClient = new Map<string, number>();
  let ledgerCount = 0;

  for (const lg of ledgerArr) {
    const carry = carryByClient.get(lg.clientId) ?? 0;
    const balance = carry + lg.sales - lg.received;

    await prisma.closingLedger.create({
      data: {
        clientId: lg.clientId,
        closingMonth: lg.month,
        carryOver: new Prisma.Decimal(carry.toFixed(2)),
        monthlySales: new Prisma.Decimal(lg.sales.toFixed(2)),
        received: new Prisma.Decimal(lg.received.toFixed(2)),
        balance: new Prisma.Decimal(balance.toFixed(2)),
        createdBy: "transactions-to-orders",
      },
    });
    carryByClient.set(lg.clientId, balance);
    ledgerCount++;
  }
  console.log(`ClosingLedger rows:   ${ledgerCount}`);

  // ─── 6. 최종 집계 ──────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const [oCount, oi, inv, pay, cl] = await Promise.all([
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.closingLedger.count(),
  ]);

  console.log("\n=== 최종 결과 ===");
  console.log(`Orders:        ${oCount}`);
  console.log(`OrderItems:    ${oi}`);
  console.log(`Invoices:      ${inv}`);
  console.log(`Payments:      ${pay}`);
  console.log(`ClosingLedger: ${cl}`);
  console.log(`Elapsed:       ${elapsed}s`);
  console.log("\n완료.");
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
