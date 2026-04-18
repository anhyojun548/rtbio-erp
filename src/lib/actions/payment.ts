/**
 * 수금(Payment) + 은행 입금(BankTransaction) Server Actions — Phase 3D-3b (R12).
 *
 * 주요 액션:
 *   - listPayments(filter)
 *   - recordPayment(input)
 *   - updatePayment(id, patch)
 *   - cancelPayment(id, {reason})      : 소프트 취소 = 상태를 PENDING 로 되돌리고 note 에 [취소] 태그.
 *                                         실제 삭제는 하지 않음 (감사 이력 보존).
 *   - listBankTxns(filter)
 *   - createBankTxn(input)
 *   - matchBankTxn(txnId, {paymentId}) : Payment.bankTxnId = txnId + BankTransaction.matched = true
 *   - unmatchBankTxn(txnId)            : 연결된 Payment.bankTxnId = null + matched = false
 *   - deleteBankTxn(id)                : matched=false 인 건만 삭제 허용.
 *
 * RBAC: TENANT_OWNER / ADMIN.
 *
 * 설계 결정:
 *   - Payment 를 Client 단위로만 기록 (스키마상 Invoice 연결 없음).
 *     월별 집계는 ClosingLedger 에서 paidAt 기준으로 처리.
 *   - Cancel = soft (상태 PENDING + note 태그). 하드 삭제하면 Payment.id 참조 (BankTxn) 처리 복잡.
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  recordPaymentSchema,
  updatePaymentSchema,
  cancelPaymentSchema,
  createBankTxnSchema,
  updateBankTxnSchema,
  matchBankTxnSchema,
  type RecordPaymentInput,
  type UpdatePaymentInput,
  type CancelPaymentInput,
  type CreateBankTxnInput,
  type UpdateBankTxnInput,
  type MatchBankTxnInput,
} from "@/lib/validators/payment";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

// ─── 조회 ─────────────────────────────────────────────────

export type PaymentListFilter = {
  clientId?: string;
  status?: PaymentStatus | "ALL";
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function listPayments(filter: PaymentListFilter = {}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const where: Prisma.PaymentWhereInput = {};
  if (filter.clientId) where.clientId = filter.clientId;
  if (filter.status && filter.status !== "ALL") where.status = filter.status;
  if (filter.from || filter.to) {
    where.paidAt = {};
    if (filter.from) where.paidAt.gte = filter.from;
    if (filter.to) where.paidAt.lte = filter.to;
  }

  return prisma.payment.findMany({
    where,
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: filter.limit ?? 200,
    include: {
      client: { select: { id: true, code: true, name: true } },
      bankTxn: {
        select: {
          id: true,
          bankName: true,
          payer: true,
          txnDate: true,
          reference: true,
        },
      },
    },
  });
}

export async function getPayment(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.payment.findUnique({
    where: { id },
    include: {
      client: true,
      bankTxn: true,
    },
  });
}

/**
 * 거래처별 수금 합계 요약 — 대시보드 / ledger 보조 용.
 */
export async function sumPaymentsByClient(
  clientId: string,
  range?: { from?: Date; to?: Date },
): Promise<number> {
  await requireRole("TENANT_OWNER", "ADMIN");
  const where: Prisma.PaymentWhereInput = {
    clientId,
    status: { not: "PENDING" }, // PENDING = 취소 또는 미확인 건 제외
  };
  if (range?.from || range?.to) {
    where.paidAt = {};
    if (range.from) where.paidAt.gte = range.from;
    if (range.to) where.paidAt.lte = range.to;
  }
  const agg = await prisma.payment.aggregate({
    where,
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

// ─── Payment 생성 ─────────────────────────────────────────

export async function recordPayment(
  input: RecordPaymentInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: data.clientId },
        select: { id: true, name: true, code: true, active: true },
      });
      if (!client) throw new PaymentError("존재하지 않는 거래처입니다.");

      // bankTxn 동시 매칭 (선택)
      if (data.bankTxnId) {
        const txn = await tx.bankTransaction.findUnique({
          where: { id: data.bankTxnId },
          select: { id: true, matched: true, amount: true },
        });
        if (!txn) throw new PaymentError("존재하지 않는 은행 거래입니다.");
        if (txn.matched)
          throw new PaymentError(
            "이미 매칭된 은행 거래입니다. 먼저 매칭 해제해주세요.",
          );
      }

      const payment = await tx.payment.create({
        data: {
          clientId: data.clientId,
          amount: new Prisma.Decimal(data.amount.toFixed(2)),
          paidAt: data.paidAt,
          method: data.method,
          status: data.status ?? "PAID",
          bankTxnId: data.bankTxnId ?? null,
          note: data.note ?? null,
          createdBy: user.id,
        },
        select: { id: true },
      });

      if (data.bankTxnId) {
        await tx.bankTransaction.update({
          where: { id: data.bankTxnId },
          data: { matched: true },
        });
      }

      return { id: payment.id, clientName: client.name };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "PAYMENT_RECORD",
      resource: `Payment:${result.id}`,
      metadata: {
        clientId: data.clientId,
        clientName: result.clientName,
        amount: data.amount,
        method: data.method,
        status: data.status ?? "PAID",
        bankTxnId: data.bankTxnId,
      },
    });

    revalidatePath("/admin/payments");
    revalidatePath(`/admin/clients/${data.clientId}`);
    return ok({ id: result.id });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    throw err;
  }
}

// ─── Payment 수정 ─────────────────────────────────────────

export async function updatePayment(
  id: string,
  input: UpdatePaymentInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = updatePaymentSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const cur = await prisma.payment.findUnique({
      where: { id },
      select: { id: true, clientId: true },
    });
    if (!cur) throw new PaymentError("존재하지 않는 수금 기록입니다.");

    const patch: Prisma.PaymentUpdateInput = {};
    if (data.amount !== undefined)
      patch.amount = new Prisma.Decimal(data.amount.toFixed(2));
    if (data.paidAt !== undefined) patch.paidAt = data.paidAt;
    if (data.method !== undefined) patch.method = data.method;
    if (data.status !== undefined) patch.status = data.status;
    if (data.note !== undefined) patch.note = data.note;

    await prisma.payment.update({ where: { id }, data: patch });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "PAYMENT_UPDATE",
      resource: `Payment:${id}`,
      metadata: { patch: data, clientId: cur.clientId },
    });

    revalidatePath("/admin/payments");
    revalidatePath(`/admin/clients/${cur.clientId}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    throw err;
  }
}

// ─── Payment 소프트 취소 ─────────────────────────────────

export async function cancelPayment(
  id: string,
  input: CancelPaymentInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = cancelPaymentSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { reason } = parsed.data;

  try {
    const cur = await prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        status: true,
        note: true,
        bankTxnId: true,
      },
    });
    if (!cur) throw new PaymentError("존재하지 않는 수금 기록입니다.");
    if (cur.status === "PENDING" && cur.note?.includes("[취소]"))
      throw new PaymentError("이미 취소된 수금 기록입니다.");

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: {
          status: "PENDING",
          note: cur.note ? `${cur.note}\n[취소] ${reason}` : `[취소] ${reason}`,
          // bankTxn 매칭은 유지 (감사 목적). unmatch 는 별도 액션.
        },
      });
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "PAYMENT_CANCEL",
      resource: `Payment:${id}`,
      metadata: {
        prevStatus: cur.status,
        clientId: cur.clientId,
        reason,
      },
    });

    revalidatePath("/admin/payments");
    revalidatePath(`/admin/clients/${cur.clientId}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    throw err;
  }
}

// ─── BankTransaction ─────────────────────────────────────

export type BankTxnListFilter = {
  matched?: boolean;
  from?: Date;
  to?: Date;
  q?: string; // payer/reference 부분검색
  limit?: number;
};

export async function listBankTxns(filter: BankTxnListFilter = {}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const where: Prisma.BankTransactionWhereInput = {};
  if (filter.matched !== undefined) where.matched = filter.matched;
  if (filter.from || filter.to) {
    where.txnDate = {};
    if (filter.from) where.txnDate.gte = filter.from;
    if (filter.to) where.txnDate.lte = filter.to;
  }
  if (filter.q && filter.q.trim()) {
    const q = filter.q.trim();
    where.OR = [
      { payer: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
      { bankName: { contains: q, mode: "insensitive" } },
    ];
  }

  return prisma.bankTransaction.findMany({
    where,
    orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
    take: filter.limit ?? 200,
    include: {
      payments: {
        select: {
          id: true,
          amount: true,
          clientId: true,
          client: { select: { code: true, name: true } },
        },
      },
    },
  });
}

export async function createBankTxn(
  input: CreateBankTxnInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = createBankTxnSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  const txn = await prisma.bankTransaction.create({
    data: {
      bankName: data.bankName,
      payer: data.payer,
      amount: new Prisma.Decimal(data.amount.toFixed(2)),
      txnDate: data.txnDate,
      reference: data.reference ?? null,
      createdBy: user.id,
    },
    select: { id: true },
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "BANKTXN_CREATE",
    resource: `BankTransaction:${txn.id}`,
    metadata: {
      bankName: data.bankName,
      payer: data.payer,
      amount: data.amount,
      txnDate: data.txnDate,
    },
  });

  revalidatePath("/admin/payments");
  return ok({ id: txn.id });
}

export async function updateBankTxn(
  id: string,
  input: UpdateBankTxnInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = updateBankTxnSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const cur = await prisma.bankTransaction.findUnique({
      where: { id },
      select: { id: true, matched: true },
    });
    if (!cur) throw new PaymentError("존재하지 않는 은행 거래입니다.");
    if (cur.matched)
      throw new PaymentError(
        "매칭된 은행 거래는 수정할 수 없습니다. 먼저 매칭 해제해주세요.",
      );

    const patch: Prisma.BankTransactionUpdateInput = {};
    if (data.bankName !== undefined) patch.bankName = data.bankName;
    if (data.payer !== undefined) patch.payer = data.payer;
    if (data.amount !== undefined)
      patch.amount = new Prisma.Decimal(data.amount.toFixed(2));
    if (data.txnDate !== undefined) patch.txnDate = data.txnDate;
    if (data.reference !== undefined) patch.reference = data.reference ?? null;

    await prisma.bankTransaction.update({ where: { id }, data: patch });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "BANKTXN_UPDATE",
      resource: `BankTransaction:${id}`,
      metadata: { patch: data },
    });

    revalidatePath("/admin/payments");
    return ok({ id });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    throw err;
  }
}

export async function deleteBankTxn(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  try {
    const cur = await prisma.bankTransaction.findUnique({
      where: { id },
      select: { id: true, matched: true, bankName: true, payer: true },
    });
    if (!cur) throw new PaymentError("존재하지 않는 은행 거래입니다.");
    if (cur.matched)
      throw new PaymentError(
        "매칭된 은행 거래는 삭제할 수 없습니다. 먼저 매칭 해제해주세요.",
      );

    await prisma.bankTransaction.delete({ where: { id } });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "BANKTXN_DELETE",
      resource: `BankTransaction:${id}`,
      metadata: { bankName: cur.bankName, payer: cur.payer },
    });

    revalidatePath("/admin/payments");
    return ok({ id });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    throw err;
  }
}

// ─── Matching ────────────────────────────────────────────

export async function matchBankTxn(
  txnId: string,
  input: MatchBankTxnInput,
): Promise<ActionResult<{ paymentId: string; bankTxnId: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = matchBankTxnSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { paymentId } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const txn = await tx.bankTransaction.findUnique({
        where: { id: txnId },
        select: { id: true, matched: true },
      });
      if (!txn) throw new PaymentError("존재하지 않는 은행 거래입니다.");
      if (txn.matched)
        throw new PaymentError(
          "이미 매칭된 은행 거래입니다. 먼저 매칭 해제해주세요.",
        );

      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { id: true, bankTxnId: true, clientId: true },
      });
      if (!payment) throw new PaymentError("존재하지 않는 수금 기록입니다.");
      if (payment.bankTxnId)
        throw new PaymentError(
          "해당 수금은 이미 다른 은행 거래에 매칭되어 있습니다.",
        );

      await tx.payment.update({
        where: { id: paymentId },
        data: { bankTxnId: txnId },
      });
      await tx.bankTransaction.update({
        where: { id: txnId },
        data: { matched: true },
      });

      return { paymentId, bankTxnId: txnId, clientId: payment.clientId };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "BANKTXN_MATCH",
      resource: `BankTransaction:${txnId}`,
      metadata: {
        paymentId: result.paymentId,
        clientId: result.clientId,
      },
    });

    revalidatePath("/admin/payments");
    return ok({ paymentId: result.paymentId, bankTxnId: result.bankTxnId });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    throw err;
  }
}

export async function unmatchBankTxn(
  txnId: string,
): Promise<ActionResult<{ bankTxnId: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const txn = await tx.bankTransaction.findUnique({
        where: { id: txnId },
        select: {
          id: true,
          matched: true,
          payments: { select: { id: true } },
        },
      });
      if (!txn) throw new PaymentError("존재하지 않는 은행 거래입니다.");
      if (!txn.matched && txn.payments.length === 0)
        throw new PaymentError("매칭되지 않은 은행 거래입니다.");

      // 연결된 Payment 들의 bankTxnId 를 null 로 재설정.
      for (const p of txn.payments) {
        await tx.payment.update({
          where: { id: p.id },
          data: { bankTxnId: null },
        });
      }
      await tx.bankTransaction.update({
        where: { id: txnId },
        data: { matched: false },
      });

      return {
        bankTxnId: txnId,
        unlinkedPayments: txn.payments.map((p) => p.id),
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "BANKTXN_UNMATCH",
      resource: `BankTransaction:${txnId}`,
      metadata: { unlinkedPayments: result.unlinkedPayments },
    });

    revalidatePath("/admin/payments");
    return ok({ bankTxnId: result.bankTxnId });
  } catch (err) {
    if (err instanceof PaymentError) return fail(err.message);
    throw err;
  }
}
