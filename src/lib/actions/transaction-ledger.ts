"use server";

/**
 * TransactionLedger 서버 액션 — 데이터 탐색기 (R-DataExplorer)
 *
 * - listTransactions: 필터 + 페이지네이션 조회
 * - aggregateTransactions: 합계 (수량/공급가/VAT/합계) 통계
 * - listClientCodes: 거래처 자동완성용
 * - listProductCodes: 품목 자동완성용
 * - bulkInsertTransactions: 업로드용 (엑셀/CSV 파싱 결과)
 * - deleteTransactionsByImportSource: 잘못 업로드한 batch 통째로 삭제
 *
 * 권한: TENANT_OWNER · ADMIN · EXEC · QC 조회 가능, ADMIN · TENANT_OWNER 만 업로드/삭제
 */
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";
import {
  transactionFilterSchema,
  transactionRowSchema,
  updateTransactionSchema,
  type TransactionFilter,
  type TransactionRow,
  type UpdateTransactionInput,
} from "@/lib/validators/transaction-ledger";
import { Prisma } from "@prisma/client";

/**
 * 필터 + 페이지네이션 조회 (기본 100건)
 */
export async function listTransactions(filter: Partial<TransactionFilter> = {}) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  const f = transactionFilterSchema.parse(filter);

  const where: Prisma.TransactionLedgerWhereInput = {};
  if (f.kind) where.kind = f.kind;
  if (f.clientCode) where.clientCode = f.clientCode;
  if (f.productCode) where.productCode = f.productCode;
  if (f.voucherNo) where.voucherNo = { contains: f.voucherNo, mode: "insensitive" };
  if (f.from || f.to) {
    where.txnDate = {};
    if (f.from) (where.txnDate as Prisma.DateTimeFilter).gte = f.from;
    if (f.to)   (where.txnDate as Prisma.DateTimeFilter).lte = f.to;
  }
  if (f.q) {
    where.OR = [
      { clientName:  { contains: f.q, mode: "insensitive" } },
      { productName: { contains: f.q, mode: "insensitive" } },
      { voucherNo:   { contains: f.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.transactionLedger.findMany({
      where,
      orderBy: [{ txnDate: "desc" }, { id: "desc" }],
      take: f.limit,
      skip: f.offset,
    }),
    prisma.transactionLedger.count({ where }),
  ]);

  return { rows, total, limit: f.limit, offset: f.offset };
}

/**
 * 필터 조건의 합계 (대시보드/요약 카드용)
 */
export async function aggregateTransactions(filter: Partial<TransactionFilter> = {}) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  const f = transactionFilterSchema.parse(filter);

  const where: Prisma.TransactionLedgerWhereInput = {};
  if (f.kind) where.kind = f.kind;
  if (f.clientCode) where.clientCode = f.clientCode;
  if (f.productCode) where.productCode = f.productCode;
  if (f.from || f.to) {
    where.txnDate = {};
    if (f.from) (where.txnDate as Prisma.DateTimeFilter).gte = f.from;
    if (f.to)   (where.txnDate as Prisma.DateTimeFilter).lte = f.to;
  }
  if (f.q) {
    where.OR = [
      { clientName:  { contains: f.q, mode: "insensitive" } },
      { productName: { contains: f.q, mode: "insensitive" } },
    ];
  }

  const [agg, byKind] = await Promise.all([
    prisma.transactionLedger.aggregate({
      where,
      _sum: { qty: true, supplyAmount: true, vat: true, totalAmount: true },
      _count: { _all: true },
    }),
    prisma.transactionLedger.groupBy({
      by: ["kind"],
      where,
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  return {
    count:        agg._count._all,
    totalQty:     Number(agg._sum.qty ?? 0),
    totalSupply:  Number(agg._sum.supplyAmount ?? 0),
    totalVat:     Number(agg._sum.vat ?? 0),
    totalAmount:  Number(agg._sum.totalAmount ?? 0),
    byKind: byKind.map((g) => ({
      kind:  g.kind,
      count: g._count._all,
      total: Number(g._sum.totalAmount ?? 0),
    })),
  };
}

/** 거래처 자동완성 (distinct, 사용량순) */
export async function listTransactionClients(limit = 200) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  const rows = await prisma.transactionLedger.groupBy({
    by: ["clientCode", "clientName"],
    where: { clientName: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    code:  r.clientCode ?? "",
    name:  r.clientName ?? "",
    count: r._count._all,
  }));
}

/** 품목 자동완성 (distinct, 사용량순) */
export async function listTransactionProducts(limit = 200) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  const rows = await prisma.transactionLedger.groupBy({
    by: ["productCode", "productName"],
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    code:  r.productCode ?? "",
    name:  r.productName ?? "",
    count: r._count._all,
  }));
}

/**
 * 엑셀/CSV 업로드 후 대량 삽입
 * - 클라이언트가 파싱한 결과를 받음 (서버측 파싱은 file route 에서)
 * - chunked 5000건씩 transaction 으로 처리
 */
export async function bulkInsertTransactions(
  rows: TransactionRow[],
  importSource: string,
): Promise<ActionResult<{ inserted: number }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  if (!rows || rows.length === 0) {
    return fail("업로드할 데이터가 없습니다");
  }
  if (rows.length > 100_000) {
    return fail("한 번에 최대 10만 건까지 업로드 가능합니다");
  }

  // 각 row 검증
  const validated: TransactionRow[] = [];
  const errors: { row: number; error: string }[] = [];
  rows.forEach((r, i) => {
    const parsed = transactionRowSchema.safeParse(r);
    if (parsed.success) validated.push(parsed.data);
    else errors.push({ row: i + 1, error: parsed.error.issues[0]?.message ?? "검증 실패" });
  });
  if (errors.length > 0 && validated.length === 0) {
    return fail(`전체 ${rows.length}건 모두 검증 실패. 첫 오류: ${errors[0]?.error}`);
  }

  // chunked insert (5000건씩)
  const CHUNK = 5000;
  let inserted = 0;
  for (let i = 0; i < validated.length; i += CHUNK) {
    const chunk = validated.slice(i, i + CHUNK).map((r) => ({
      txnDate:      r.txnDate,
      kind:         r.kind,
      taxType:      r.taxType ?? null,
      clientCode:   r.clientCode ?? null,
      clientName:   r.clientName ?? null,
      productCode:  r.productCode ?? null,
      productName:  r.productName,
      spec:         r.spec ?? null,
      unit:         r.unit ?? null,
      qty:          r.qty.toString(),
      unitPrice:    r.unitPrice.toString(),
      supplyAmount: r.supplyAmount.toString(),
      vat:          r.vat.toString(),
      totalAmount:  r.totalAmount.toString(),
      itemMemo:     r.itemMemo ?? null,
      voucherNo:    r.voucherNo ?? null,
      hasInvoice:   r.hasInvoice,
      evidence:     r.evidence ?? null,
      category:     r.category ?? null,
      memo:         r.memo ?? null,
      importSource,
      createdBy:    user.id,
    }));
    const res = await prisma.transactionLedger.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    inserted += res.count;
  }

  await logAudit({
    action:   "TRANSACTION_IMPORT",
    resource: "TransactionLedger",
    metadata: { inserted, total: rows.length, errors: errors.length, source: importSource },
  });
  revalidatePath("/admin/data-explorer");
  return ok({ inserted });
}

/**
 * 특정 import 배치를 통째로 삭제 (잘못 업로드한 경우)
 */
export async function deleteTransactionsByImportSource(importSource: string): Promise<ActionResult<{ deleted: number }>> {
  await requireRole("TENANT_OWNER", "ADMIN");
  if (!importSource) return fail("import source 가 필요합니다");

  const res = await prisma.transactionLedger.deleteMany({ where: { importSource } });
  await logAudit({
    action:   "TRANSACTION_DELETE_BATCH",
    resource: "TransactionLedger",
    metadata: { source: importSource, deleted: res.count },
  });
  revalidatePath("/admin/data-explorer");
  return ok({ deleted: res.count });
}

/**
 * 단건 조회
 */
export async function getTransaction(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  return prisma.transactionLedger.findUnique({ where: { id } });
}

/**
 * 단건 수정 (부분 패치) + 감사
 */
export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const updated = await prisma.transactionLedger.update({
      where: { id },
      data: parsed.data,
      select: { id: true },
    });
    logAudit({
      userId:   user.id,
      tenantId: user.tenantId,
      action:   "TXN_LEDGER_UPDATE",
      resource: `TransactionLedger:${id}`,
      metadata: { patch: parsed.data as Prisma.InputJsonValue },
    });
    revalidatePath("/admin/data-explorer");
    return ok(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return fail("거래를 찾을 수 없습니다");
    }
    throw err;
  }
}

/**
 * 단건 삭제 + 감사
 */
export async function deleteTransaction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  try {
    await prisma.transactionLedger.delete({ where: { id } });
    logAudit({
      userId:   user.id,
      tenantId: user.tenantId,
      action:   "TXN_LEDGER_DELETE",
      resource: `TransactionLedger:${id}`,
    });
    revalidatePath("/admin/data-explorer");
    return ok({ id });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return fail("거래를 찾을 수 없습니다");
    }
    throw err;
  }
}

/**
 * AI 친화 일괄 수정 — ids / clientCode / 날짜 범위로 필터링 후 patch 적용
 */
export async function bulkUpdateTransactions(
  filter: {
    ids?:        string[];
    clientCode?: string;
    from?:       Date;
    to?:         Date;
  },
  patch: UpdateTransactionInput,
): Promise<ActionResult<{ updatedCount: number }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = updateTransactionSchema.safeParse(patch);
  if (!parsed.success) return zodFail(parsed.error);

  const where: Prisma.TransactionLedgerWhereInput = {};
  if (filter.ids?.length) where.id = { in: filter.ids };
  if (filter.clientCode) where.clientCode = filter.clientCode;
  if (filter.from || filter.to) {
    where.txnDate = {};
    if (filter.from) (where.txnDate as Prisma.DateTimeFilter).gte = filter.from;
    if (filter.to)   (where.txnDate as Prisma.DateTimeFilter).lte = filter.to;
  }

  const res = await prisma.transactionLedger.updateMany({
    where,
    data: parsed.data,
  });
  logAudit({
    userId:   user.id,
    tenantId: user.tenantId,
    action:   "TXN_LEDGER_BULK_UPDATE",
    resource: "TransactionLedger",
    metadata: { filter: filter as Prisma.InputJsonValue, count: res.count },
  });
  revalidatePath("/admin/data-explorer");
  return ok({ updatedCount: res.count });
}
