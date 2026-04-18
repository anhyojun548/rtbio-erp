/**
 * Phase 3D-3b 스모크 — 수금(Payment) · 은행거래(BankTransaction) · 월 원장(ClosingLedger).
 *
 * 시나리오:
 *   A. BankTransaction 생성 → matched=false 조회 확인
 *   B. Payment 기록 + bankTxn 매칭 → BankTransaction.matched=true 전이
 *   C. 매칭 해제(unmatch) → Payment.bankTxnId=null, BankTransaction.matched=false
 *   D. Payment 소프트 취소 → status=PENDING + note "[취소]"
 *   E. Invoice(ISSUED) + Payment → recomputeLedger → carryOver/monthlySales/received/balance 검산
 *      · 전월 원장 존재 시 carryOver 계승
 *   F. closeMonth → closedAt 세팅 → 재-recompute 거부 → reopenMonth → 다시 허용
 *
 * 실행: `npx tsx scripts/smoke-payment.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { monthToRange, prevMonth } from "../src/lib/validators/ledger";

// ─── 헬퍼 ────────────────────────────────────────────────

async function computeFiguresInline(clientId: string, closingMonth: string) {
  const { start, end } = monthToRange(closingMonth);
  const pm = prevMonth(closingMonth);
  const prev = await prisma.closingLedger.findUnique({
    where: { clientId_closingMonth: { clientId, closingMonth: pm } },
    select: { balance: true },
  });
  const carryOver = Number(prev?.balance ?? 0);
  const invAgg = await prisma.invoice.aggregate({
    where: {
      clientId,
      status: { in: ["ISSUED", "SENT"] },
      issueDate: { gte: start, lt: end },
    },
    _sum: { totalAmount: true },
  });
  const monthlySales = Number(invAgg._sum.totalAmount ?? 0);
  const payAgg = await prisma.payment.aggregate({
    where: {
      clientId,
      status: { in: ["PARTIAL", "PAID"] },
      paidAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });
  const received = Number(payAgg._sum.amount ?? 0);
  const balance = carryOver + monthlySales - received;
  return { carryOver, monthlySales, received, balance };
}

async function upsertLedgerInline(clientId: string, closingMonth: string) {
  const cur = await prisma.closingLedger.findUnique({
    where: { clientId_closingMonth: { clientId, closingMonth } },
    select: { closedAt: true },
  });
  if (cur?.closedAt) throw new Error("마감된 원장");
  const f = await computeFiguresInline(clientId, closingMonth);
  return prisma.closingLedger.upsert({
    where: { clientId_closingMonth: { clientId, closingMonth } },
    create: {
      clientId,
      closingMonth,
      carryOver: new Prisma.Decimal(f.carryOver.toFixed(2)),
      monthlySales: new Prisma.Decimal(f.monthlySales.toFixed(2)),
      received: new Prisma.Decimal(f.received.toFixed(2)),
      balance: new Prisma.Decimal(f.balance.toFixed(2)),
    },
    update: {
      carryOver: new Prisma.Decimal(f.carryOver.toFixed(2)),
      monthlySales: new Prisma.Decimal(f.monthlySales.toFixed(2)),
      received: new Prisma.Decimal(f.received.toFixed(2)),
      balance: new Prisma.Decimal(f.balance.toFixed(2)),
    },
  });
}

async function createBankTxnInline(
  bankName: string,
  payer: string,
  amount: number,
  txnDate: Date,
  reference?: string,
) {
  return prisma.bankTransaction.create({
    data: {
      bankName,
      payer,
      amount: new Prisma.Decimal(amount.toFixed(2)),
      txnDate,
      reference: reference ?? null,
    },
  });
}

async function recordPaymentInline(opts: {
  clientId: string;
  amount: number;
  paidAt: Date;
  method: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  bankTxnId?: string;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    if (opts.bankTxnId) {
      const b = await tx.bankTransaction.findUnique({
        where: { id: opts.bankTxnId },
        select: { matched: true },
      });
      if (!b) throw new Error("bankTxn 없음");
      if (b.matched) throw new Error("이미 매칭됨");
    }
    const p = await tx.payment.create({
      data: {
        clientId: opts.clientId,
        amount: new Prisma.Decimal(opts.amount.toFixed(2)),
        paidAt: opts.paidAt,
        method: opts.method,
        status: opts.status,
        bankTxnId: opts.bankTxnId ?? null,
        note: opts.note ?? null,
      },
    });
    if (opts.bankTxnId) {
      await tx.bankTransaction.update({
        where: { id: opts.bankTxnId },
        data: { matched: true },
      });
    }
    return p;
  });
}

async function unmatchBankTxnInline(txnId: string) {
  return prisma.$transaction(async (tx) => {
    const payments = await tx.payment.findMany({
      where: { bankTxnId: txnId },
      select: { id: true },
    });
    for (const p of payments) {
      await tx.payment.update({
        where: { id: p.id },
        data: { bankTxnId: null },
      });
    }
    await tx.bankTransaction.update({
      where: { id: txnId },
      data: { matched: false },
    });
    return { unlinked: payments.map((p) => p.id) };
  });
}

async function cancelPaymentInline(id: string, reason: string) {
  const cur = await prisma.payment.findUnique({
    where: { id },
    select: { note: true },
  });
  if (!cur) throw new Error("payment 없음");
  return prisma.payment.update({
    where: { id },
    data: {
      status: "PENDING",
      note: cur.note ? `${cur.note}\n[취소] ${reason}` : `[취소] ${reason}`,
    },
  });
}

async function issueInvoiceInlineDirect(opts: {
  clientId: string;
  orderId: string | null;
  issueDate: Date;
  supply: number;
}) {
  const supplyDec = new Prisma.Decimal(opts.supply.toFixed(2));
  const vat = Math.round(opts.supply * 0.1 * 100) / 100;
  const total = opts.supply + vat;
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return prisma.invoice.create({
    data: {
      invoiceNumber: `INV-SMOKE-${rand}`,
      clientId: opts.clientId,
      orderId: opts.orderId,
      issueDate: opts.issueDate,
      supplyAmount: supplyDec,
      vatAmount: new Prisma.Decimal(vat.toFixed(2)),
      totalAmount: new Prisma.Decimal(total.toFixed(2)),
      status: "ISSUED",
    },
  });
}

// ─── main ───────────────────────────────────────────────

async function main() {
  const client = await prisma.client.findFirst({ where: { active: true } });
  if (!client) throw new Error("활성 거래처 없음");
  console.log(`거래처: ${client.name} (${client.code})`);

  // 테스트는 현재월 − 과거. 충돌 피하기 위해 먼 과거 사용.
  const thisMonth = "2025-06"; // 현재월
  const prevM = "2025-05";

  // 이 클라이언트에 대해 해당 월 기존 원장 · 수금 · 인보이스 삭제 (재현 가능성)
  await prisma.payment.deleteMany({
    where: {
      clientId: client.id,
      paidAt: {
        gte: new Date(2025, 4, 1),
        lt: new Date(2025, 6, 1),
      },
    },
  });
  await prisma.invoiceItem.deleteMany({
    where: {
      invoice: {
        clientId: client.id,
        invoiceNumber: { startsWith: "INV-SMOKE-" },
      },
    },
  });
  await prisma.invoice.deleteMany({
    where: {
      clientId: client.id,
      invoiceNumber: { startsWith: "INV-SMOKE-" },
    },
  });
  await prisma.closingLedger.deleteMany({
    where: {
      clientId: client.id,
      closingMonth: { in: [prevM, thisMonth] },
    },
  });
  await prisma.bankTransaction.deleteMany({
    where: { reference: { startsWith: "SMOKE-" } },
  });

  // ─── A. BankTxn 생성 ────────────────────────────────────
  const btA = await createBankTxnInline(
    "국민은행",
    "테스트입금",
    100000,
    new Date(2025, 5, 10),
    "SMOKE-A",
  );
  if (btA.matched) throw new Error("[A] 기본 matched 는 false 여야");
  console.log(`✓ [A] BankTxn 생성: ${btA.bankName}·${btA.payer}·matched=${btA.matched}`);

  // ─── B. Payment 기록 + bankTxn 매칭 ──────────────────────
  const payB = await recordPaymentInline({
    clientId: client.id,
    amount: 100000,
    paidAt: new Date(2025, 5, 10),
    method: "계좌이체",
    status: "PAID",
    bankTxnId: btA.id,
  });
  const btAfter = await prisma.bankTransaction.findUnique({
    where: { id: btA.id },
    select: { matched: true },
  });
  if (!btAfter?.matched) throw new Error("[B] 매칭 플래그 전이 실패");
  if (payB.bankTxnId !== btA.id) throw new Error("[B] bankTxnId 미반영");
  console.log(
    `✓ [B] Payment 생성+매칭: amount=${payB.amount}, bankTxnId=${payB.bankTxnId?.slice(-6)}, matched=${btAfter.matched}`,
  );

  // ─── C. Unmatch ─────────────────────────────────────────
  const unmatchRes = await unmatchBankTxnInline(btA.id);
  const payAfterUnmatch = await prisma.payment.findUnique({
    where: { id: payB.id },
    select: { bankTxnId: true },
  });
  const btAfterUnmatch = await prisma.bankTransaction.findUnique({
    where: { id: btA.id },
    select: { matched: true },
  });
  if (payAfterUnmatch?.bankTxnId !== null)
    throw new Error("[C] Payment.bankTxnId null 전이 실패");
  if (btAfterUnmatch?.matched !== false)
    throw new Error("[C] BankTxn.matched false 전이 실패");
  console.log(
    `✓ [C] Unmatch 완료: unlinked=${unmatchRes.unlinked.length}건, bankTxn.matched=${btAfterUnmatch.matched}`,
  );

  // ─── D. 소프트 취소 ────────────────────────────────────
  const cancelled = await cancelPaymentInline(payB.id, "중복 입력");
  if (cancelled.status !== "PENDING")
    throw new Error(`[D] 상태 PENDING 전이 실패: ${cancelled.status}`);
  if (!cancelled.note?.includes("[취소]"))
    throw new Error("[D] note 에 [취소] 태그 없음");
  console.log(
    `✓ [D] 소프트 취소: status=${cancelled.status}, note="${cancelled.note}"`,
  );

  // ─── E. recomputeLedger ─────────────────────────────────
  // 전월(2025-05) balance 300,000 으로 세팅 (carryOver 계승 확인)
  await prisma.closingLedger.create({
    data: {
      clientId: client.id,
      closingMonth: prevM,
      carryOver: new Prisma.Decimal("0"),
      monthlySales: new Prisma.Decimal("500000"),
      received: new Prisma.Decimal("200000"),
      balance: new Prisma.Decimal("300000"),
    },
  });

  // 이번달에 Invoice(공급가 1,000,000 · VAT 100,000 · 합 1,100,000) 발행
  const invE = await issueInvoiceInlineDirect({
    clientId: client.id,
    orderId: null,
    issueDate: new Date(2025, 5, 15),
    supply: 1_000_000,
  });
  // Payment 400,000 PAID
  const payE = await recordPaymentInline({
    clientId: client.id,
    amount: 400000,
    paidAt: new Date(2025, 5, 20),
    method: "계좌이체",
    status: "PAID",
  });

  const ledger = await upsertLedgerInline(client.id, thisMonth);
  const carryOver = Number(ledger.carryOver);
  const monthlySales = Number(ledger.monthlySales);
  const received = Number(ledger.received);
  const balance = Number(ledger.balance);
  // 기대값: carryOver=300,000, monthlySales=1,100,000(총액), received=400,000, balance=1,000,000
  if (carryOver !== 300000)
    throw new Error(`[E] carryOver 불일치: ${carryOver}`);
  if (Math.abs(monthlySales - 1_100_000) > 0.01)
    throw new Error(`[E] monthlySales 불일치: ${monthlySales}`);
  if (received !== 400000) throw new Error(`[E] received 불일치: ${received}`);
  if (Math.abs(balance - 1_000_000) > 0.01)
    throw new Error(`[E] balance 불일치: ${balance}`);
  console.log(
    `✓ [E] 원장 집계: carryOver=${carryOver}, monthlySales=${monthlySales}, received=${received}, balance=${balance}`,
  );

  // ─── F. closeMonth → 재-recompute 거부 → reopen → 허용 ─
  await prisma.closingLedger.update({
    where: { clientId_closingMonth: { clientId: client.id, closingMonth: thisMonth } },
    data: { closedAt: new Date() },
  });
  let blocked = false;
  try {
    await upsertLedgerInline(client.id, thisMonth);
  } catch (e) {
    blocked = true;
    console.log(`✓ [F] 마감 후 재계산 가드: ${(e as Error).message}`);
  }
  if (!blocked) throw new Error("[F] 마감된 원장 재계산 가드 실패");

  // reopen
  await prisma.closingLedger.update({
    where: { clientId_closingMonth: { clientId: client.id, closingMonth: thisMonth } },
    data: { closedAt: null, note: "[재개] 스모크 테스트" },
  });
  const re = await upsertLedgerInline(client.id, thisMonth);
  if (re.closedAt) throw new Error("[F] 재개 후 closedAt null 이어야 함");
  console.log(`✓ [F] reopen 후 재계산 성공.`);

  // ─── 청소 ──────────────────────────────────────────────
  await prisma.closingLedger.deleteMany({
    where: {
      clientId: client.id,
      closingMonth: { in: [prevM, thisMonth] },
    },
  });
  await prisma.payment.deleteMany({
    where: { id: { in: [payB.id, payE.id] } },
  });
  await prisma.invoice.delete({ where: { id: invE.id } });
  await prisma.bankTransaction.delete({ where: { id: btA.id } });

  console.log(`\n✅ Payment/BankTxn/Ledger 스모크 통과.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
