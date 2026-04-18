/**
 * Phase 3D-3a 스모크 — 거래명세서(Invoice) 수명주기.
 *
 * 시나리오:
 *   A. COMPLETED 주문 → createInvoiceFromOrder
 *      ✓ DRAFT Invoice 1건 + InvoiceItem 주문 라인 수만큼
 *      ✓ supplyAmount = Σ lineTotal, vatAmount = supply × 0.1 (round), totalAmount = supply + vat
 *      ✓ invoiceNumber = `DRAFT-INV-...`
 *   B. issueInvoice → 공식 번호 `INV-YYYYMMDD-001` 로 재채번, 상태 ISSUED
 *   C. 같은 주문에 createInvoiceFromOrder 재호출 → 실패 (활성 invoice 중복 가드)
 *   D. cancelInvoice → CANCELLED, 비고에 "[취소]" 태그
 *   E. 취소 후 재생성 가능 → 새 DRAFT 발급 → 두번째 issue 시 seq=002 증분
 *
 * 실행: `npx tsx scripts/smoke-invoice.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { calculatePriceSnapshot } from "../src/lib/pricing";
import { assertInvariant } from "../src/lib/inventory/invariant";
import { calcVatTotal } from "../src/lib/validators/invoice";

function draftOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `DRAFT-${rand}`;
}

async function issueOrderOfficial(
  tx: Prisma.TransactionClient,
  orderDate: Date,
): Promise<string> {
  const y = orderDate.getFullYear();
  const m = `${orderDate.getMonth() + 1}`.padStart(2, "0");
  const d = `${orderDate.getDate()}`.padStart(2, "0");
  const prefix = `ORD-${y}${m}${d}-`;
  const lockKey = Number(`${y}${m}${d}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
  const rows = await tx.$queryRaw<{ orderNumber: string }[]>`
    SELECT "orderNumber" FROM "tenant_altibio"."Order"
    WHERE "orderNumber" LIKE ${prefix + "%"}
    ORDER BY "orderNumber" DESC
    LIMIT 1
  `;
  let nextSeq = 1;
  if (rows[0]) {
    const tail = rows[0].orderNumber.slice(prefix.length);
    const parsed = Number.parseInt(tail, 10);
    if (Number.isFinite(parsed)) nextSeq = parsed + 1;
  }
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

async function issueInvoiceOfficial(
  tx: Prisma.TransactionClient,
  issueDate: Date,
): Promise<string> {
  const y = issueDate.getFullYear();
  const m = `${issueDate.getMonth() + 1}`.padStart(2, "0");
  const d = `${issueDate.getDate()}`.padStart(2, "0");
  const prefix = `INV-${y}${m}${d}-`;
  const lockKey = Number(`${y}${m}${d}`) + 10_000_000_000;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
  const rows = await tx.$queryRaw<{ invoiceNumber: string }[]>`
    SELECT "invoiceNumber" FROM "tenant_altibio"."Invoice"
    WHERE "invoiceNumber" LIKE ${prefix + "%"}
    ORDER BY "invoiceNumber" DESC
    LIMIT 1
  `;
  let nextSeq = 1;
  if (rows[0]) {
    const tail = rows[0].invoiceNumber.slice(prefix.length);
    const parsed = Number.parseInt(tail, 10);
    if (Number.isFinite(parsed)) nextSeq = parsed + 1;
  }
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

async function createDraftOrder(
  clientId: string,
  sizeId: string,
  productId: string,
  quantity: number,
) {
  const size = await prisma.productSize.findUnique({
    where: { id: sizeId },
    include: {
      product: { select: { basePrice: true, category: true, id: true } },
    },
  });
  if (!size) throw new Error("사이즈 없음");
  const snap = calculatePriceSnapshot({
    basePrice: size.product.basePrice,
    category: size.product.category,
    clientDiscounts: [],
    clientFixedPrice: null,
  });
  const unit = new Prisma.Decimal(Number(snap.unitPrice).toFixed(2));
  const base = new Prisma.Decimal(Number(snap.basePriceAtOrder).toFixed(2));
  return prisma.order.create({
    data: {
      orderNumber: draftOrderNumber(),
      clientId,
      status: "DRAFT",
      orderDate: new Date(),
      items: {
        create: [
          {
            productId,
            productSizeId: sizeId,
            quantity,
            unitPrice: unit,
            basePriceAtOrder: base,
            discountRateAtOrder: null,
            fixedPriceAppliedAtOrder: false,
            lineTotal: unit.mul(quantity),
          },
        ],
      },
    },
    include: { items: true },
  });
}

async function promoteToCompleted(orderId: string) {
  // DRAFT → SUBMITTED → CONFIRMED (RESERVE) → SHIPPING → terminal SHIP → COMPLETED
  return prisma.$transaction(async (tx) => {
    const cur = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: { id: true, productSizeId: true, quantity: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!cur) throw new Error("order 없음");

    const newNumber = await issueOrderOfficial(tx, cur.orderDate);
    const bmY = cur.orderDate.getFullYear();
    const bmM = `${cur.orderDate.getMonth() + 1}`.padStart(2, "0");
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "SUBMITTED",
        orderNumber: newNumber,
        billingMonth: `${bmY}-${bmM}`,
      },
    });

    // CONFIRM — RESERVE each line
    for (const it of cur.items) {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "tenant_altibio"."ProductSize"
        WHERE id = ${it.productSizeId}
        FOR UPDATE
      `;
      const size = await tx.productSize.findUnique({
        where: { id: it.productSizeId },
      });
      if (!size) throw new Error("사이즈 없음");
      if (size.availableStock < it.quantity) throw new Error("재고 부족");
      const nextAvailable = size.availableStock - it.quantity;
      assertInvariant(size.physicalStock, nextAvailable);
      await tx.productSize.update({
        where: { id: size.id },
        data: { availableStock: nextAvailable },
      });
      await tx.inventoryLog.create({
        data: {
          productSizeId: size.id,
          type: "RESERVE",
          qtyDelta: -it.quantity,
          physicalAfter: size.physicalStock,
          availableAfter: nextAvailable,
          relatedOrderId: orderId,
          note: "CONFIRM (smoke-invoice)",
        },
      });
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    // startShipment — shipment 만 만들고 곧바로 terminal 로 점프 (스모크 간소화)
    const stages = await tx.kanbanColumn.findMany({
      orderBy: { sortOrder: "asc" },
    });
    if (stages.length === 0) throw new Error("칸반 단계 없음");
    const terminal = stages.find((s) => s.isTerminal);
    if (!terminal) throw new Error("terminal 단계 없음");
    const firstStage = stages[0]!;
    const sh = await tx.shipment.create({
      data: {
        orderId,
        currentStageId: firstStage.id,
        enteredStageAt: new Date(),
      },
    });
    await tx.shipmentStageLog.create({
      data: {
        shipmentId: sh.id,
        fromStageId: null,
        toStageId: firstStage.id,
        note: "START (smoke-invoice)",
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "SHIPPING" },
    });

    // 바로 terminal 로 이동 (SHIP)
    const now = new Date();
    if (firstStage.id !== terminal.id) {
      await tx.shipment.update({
        where: { id: sh.id },
        data: { currentStageId: terminal.id, enteredStageAt: now },
      });
      await tx.shipmentStageLog.create({
        data: {
          shipmentId: sh.id,
          fromStageId: firstStage.id,
          toStageId: terminal.id,
          note: "JUMP → terminal (smoke-invoice)",
        },
      });
    }

    for (const it of cur.items) {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "tenant_altibio"."ProductSize"
        WHERE id = ${it.productSizeId}
        FOR UPDATE
      `;
      const size = await tx.productSize.findUnique({
        where: { id: it.productSizeId },
      });
      if (!size) throw new Error("사이즈 없음");
      const nextPhysical = size.physicalStock - it.quantity;
      assertInvariant(nextPhysical, size.availableStock);
      await tx.productSize.update({
        where: { id: size.id },
        data: { physicalStock: nextPhysical },
      });
      await tx.inventoryLog.create({
        data: {
          productSizeId: size.id,
          type: "SHIP",
          qtyDelta: -it.quantity,
          physicalAfter: nextPhysical,
          availableAfter: size.availableStock,
          relatedOrderId: orderId,
          note: "SHIP (smoke-invoice)",
        },
      });
    }
    await tx.shipment.update({
      where: { id: sh.id },
      data: { completedAt: now },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "COMPLETED", completedAt: now },
    });
    return { shipmentId: sh.id };
  });
}

async function createInvoiceInline(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true, code: true } },
            productSize: { select: { sizeCode: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!order) throw new Error("주문 없음");
    if (order.status !== "COMPLETED")
      throw new Error(`COMPLETED 아님: ${order.status}`);

    const existing = await tx.invoice.findFirst({
      where: { orderId, status: { not: "CANCELLED" } },
    });
    if (existing) throw new Error("이미 활성 거래명세서 있음");

    const supplyN = order.items.reduce(
      (s, it) => s + Number(it.lineTotal),
      0,
    );
    const { vat, total } = calcVatTotal(supplyN);
    const supply = new Prisma.Decimal(supplyN.toFixed(2));
    const vatDec = new Prisma.Decimal(vat.toFixed(2));
    const totalDec = new Prisma.Decimal(total.toFixed(2));
    const draftNumber = `DRAFT-INV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    return tx.invoice.create({
      data: {
        invoiceNumber: draftNumber,
        clientId: order.clientId,
        orderId: order.id,
        issueDate: new Date(),
        supplyAmount: supply,
        vatAmount: vatDec,
        totalAmount: totalDec,
        status: "DRAFT",
        items: {
          create: order.items.map((it) => ({
            description: `${it.product.name} / ${it.productSize.sizeCode}`,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: new Prisma.Decimal(Number(it.lineTotal).toFixed(2)),
          })),
        },
      },
      include: { items: true },
    });
  });
}

async function issueInvoiceInline(id: string) {
  return prisma.$transaction(async (tx) => {
    const cur = await tx.invoice.findUnique({ where: { id } });
    if (!cur) throw new Error("invoice 없음");
    if (cur.status !== "DRAFT") throw new Error(`DRAFT 아님: ${cur.status}`);
    const officialNumber = await issueInvoiceOfficial(tx, cur.issueDate);
    return tx.invoice.update({
      where: { id },
      data: {
        status: "ISSUED",
        invoiceNumber: officialNumber,
      },
    });
  });
}

async function cancelInvoiceInline(id: string, reason: string) {
  return prisma.invoice.update({
    where: { id },
    data: {
      status: "CANCELLED",
      note: `[취소] ${reason}`,
    },
  });
}

async function main() {
  const client = await prisma.client.findFirst({ where: { active: true } });
  if (!client) throw new Error("활성 거래처 없음");
  const size = await prisma.productSize.findFirst({
    where: { product: { active: true }, availableStock: { gte: 3 } },
    include: { product: { select: { id: true, name: true, code: true } } },
  });
  if (!size) throw new Error("재고 충분한 사이즈 없음");

  console.log(
    `거래처: ${client.name} (${client.code}) · 사이즈: ${size.product.name}/${size.sizeCode} (phy=${size.physicalStock}, avail=${size.availableStock})`,
  );

  const initialPhy = size.physicalStock;
  const initialAvail = size.availableStock;

  // ─── 시나리오 A: COMPLETED 주문 → DRAFT invoice ────────
  const dA = await createDraftOrder(client.id, size.id, size.product.id, 3);
  await promoteToCompleted(dA.id);

  const invA = await createInvoiceInline(dA.id);
  console.log(
    `✓ [A] createInvoiceFromOrder → ${invA.invoiceNumber} (status=${invA.status}, items=${invA.items.length})`,
  );

  if (!invA.invoiceNumber.startsWith("DRAFT-INV-"))
    throw new Error("DRAFT 임시번호 형식 오류");
  if (invA.items.length !== 1) throw new Error("라인 수 오류");

  // 금액 검증 — lineTotal × 0.1 == VAT
  const orderA = await prisma.order.findUnique({
    where: { id: dA.id },
    include: { items: true },
  });
  const expectedSupply = orderA!.items.reduce(
    (s, it) => s + Number(it.lineTotal),
    0,
  );
  const { vat: expVat, total: expTotal } = calcVatTotal(expectedSupply);
  if (Math.abs(Number(invA.supplyAmount) - expectedSupply) > 0.01)
    throw new Error(
      `supply 불일치: expected ${expectedSupply}, got ${invA.supplyAmount}`,
    );
  if (Math.abs(Number(invA.vatAmount) - expVat) > 0.01)
    throw new Error(`vat 불일치: expected ${expVat}, got ${invA.vatAmount}`);
  if (Math.abs(Number(invA.totalAmount) - expTotal) > 0.01)
    throw new Error(
      `total 불일치: expected ${expTotal}, got ${invA.totalAmount}`,
    );
  console.log(
    `✓ [A] 금액: supply=${invA.supplyAmount}, vat=${invA.vatAmount}, total=${invA.totalAmount}`,
  );

  // ─── 시나리오 B: issueInvoice → 공식 번호 ──────────────
  const issuedA = await issueInvoiceInline(invA.id);
  if (issuedA.status !== "ISSUED")
    throw new Error(`ISSUED 전환 실패: ${issuedA.status}`);
  if (!/^INV-\d{8}-\d{3}$/.test(issuedA.invoiceNumber))
    throw new Error(`번호 포맷 오류: ${issuedA.invoiceNumber}`);
  console.log(
    `✓ [B] issueInvoice → ${issuedA.invoiceNumber} (status=${issuedA.status})`,
  );

  const firstSeq = Number.parseInt(issuedA.invoiceNumber.slice(-3), 10);

  // ─── 시나리오 C: 같은 주문에 재생성 → 실패 ──────────────
  let cBlocked = false;
  try {
    await createInvoiceInline(dA.id);
  } catch (e) {
    cBlocked = true;
    console.log(
      `✓ [C] 재-createInvoiceFromOrder 가드: ${(e as Error).message}`,
    );
  }
  if (!cBlocked) throw new Error("[C] 중복 가드 실패");

  // ─── 시나리오 D: cancelInvoice ─────────────────────────
  const cancelled = await cancelInvoiceInline(issuedA.id, "스모크 테스트 취소");
  if (cancelled.status !== "CANCELLED")
    throw new Error(`CANCELLED 전환 실패: ${cancelled.status}`);
  if (!cancelled.note?.includes("[취소]"))
    throw new Error("취소 사유 비고 미기록");
  console.log(
    `✓ [D] cancelInvoice → status=${cancelled.status}, note="${cancelled.note}"`,
  );

  // ─── 시나리오 E: 취소 후 재생성 → 두번째 issue seq 증분 ─
  const invE = await createInvoiceInline(dA.id);
  console.log(`✓ [E] 재-DRAFT 생성 → ${invE.invoiceNumber}`);
  const issuedE = await issueInvoiceInline(invE.id);
  const secondSeq = Number.parseInt(issuedE.invoiceNumber.slice(-3), 10);
  if (secondSeq !== firstSeq + 1)
    throw new Error(
      `seq 증분 오류: ${firstSeq} → ${secondSeq} (expected ${firstSeq + 1})`,
    );
  console.log(
    `✓ [E] 공식 번호 증분: ${issuedA.invoiceNumber}(cancelled) → ${issuedE.invoiceNumber}`,
  );

  // ─── 청소 ──────────────────────────────────────────────
  await prisma.invoiceItem.deleteMany({
    where: { invoiceId: { in: [invA.id, invE.id] } },
  });
  await prisma.invoice.deleteMany({
    where: { id: { in: [invA.id, invE.id] } },
  });

  // Order 정리 — 주문 A 는 COMPLETED · shipment 포함
  await prisma.inventoryLog.deleteMany({ where: { relatedOrderId: dA.id } });
  await prisma.shipmentStageLog.deleteMany({
    where: { shipment: { orderId: dA.id } },
  });
  await prisma.shipment.deleteMany({ where: { orderId: dA.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: dA.id } });
  await prisma.order.delete({ where: { id: dA.id } });

  // 재고 원복
  await prisma.productSize.update({
    where: { id: size.id },
    data: { physicalStock: initialPhy, availableStock: initialAvail },
  });
  console.log(
    `✓ 정리: invoice 2건, order 1건, shipment 1건 삭제 · 재고 복원 (phy=${initialPhy}, avail=${initialAvail})`,
  );

  console.log(`\n✅ Invoice 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
