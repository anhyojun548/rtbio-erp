"use server";

/**
 * 매입 수기 입력 + 매입장 조회 서버 액션 (2026-06-08)
 *
 * 매입은 별도 도메인 테이블 없이 TransactionLedger(kind=PURCHASE)에 저장한다.
 *  - createPurchaseEntry: 전표(PUR-YYYYMMDD-NNN) 단위로 N개 라인 일괄 저장
 *  - listPurchaseEntries: 전표 그룹핑된 매입 이력
 *  - deletePurchaseEntry: 수기 입력 전표만 삭제(시드/임포트 데이터 보호)
 *  - getPurchaseJournal: 매입장 뷰용 flat lines (매출장 getSalesJournal 대칭, KST 기간 경계)
 *
 * 권한: 입력/삭제는 TENANT_OWNER·ADMIN, 조회는 TENANT_OWNER·ADMIN·EXEC·QC.
 */
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";
import { Prisma } from "@prisma/client";
import {
  createPurchaseEntrySchema,
  calcPurchaseLine,
  type CreatePurchaseEntryInput,
} from "@/lib/validators/purchase";

const MANUAL_SOURCE = "manual:purchase-entry";

/** UTC 저장 Date → KST(UTC+9) 달력 날짜 YYYY-MM-DD */
function kstYmd(d: Date): string {
  return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
/** YYYY-MM-DD → 해당 KST 자정의 절대 시각 */
function kstMidnight(ymd: string): Date {
  return new Date(ymd + "T00:00:00+09:00");
}

/** vat_rate 설정 (invoice.ts 와 동일 소스) — 없으면 0.1 */
async function getVatRate(): Promise<number> {
  const s = await prisma.tenantSetting.findUnique({
    where: { key: "vat_rate" },
    select: { value: true },
  });
  const r = s?.value ? Number(s.value) : 0.1;
  return Number.isFinite(r) && r >= 0 && r <= 1 ? r : 0.1;
}

/** 전표번호 PUR-YYYYMMDD-NNN 채번 — 당일 매입 전표 max(NNN)+1 (트랜잭션 내 호출) */
async function nextPurchaseVoucher(
  tx: Prisma.TransactionClient,
  ymd: string,
): Promise<string> {
  const prefix = "PUR-" + ymd.replace(/-/g, "") + "-";
  const rows = await tx.transactionLedger.findMany({
    where: { kind: "PURCHASE", voucherNo: { startsWith: prefix } },
    select: { voucherNo: true },
    distinct: ["voucherNo"],
  });
  const max = rows.reduce((m, r) => {
    const n = parseInt((r.voucherNo || "").slice(prefix.length), 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return prefix + String(max + 1).padStart(3, "0");
}

export type PurchaseEntryResult = {
  voucherNo: string;
  lineCount: number;
  totalSupply: number;
  totalVat: number;
  totalAmount: number;
};

/**
 * 매입 전표 생성 — 라인을 TransactionLedger(kind=PURCHASE) 로 일괄 저장.
 */
export async function createPurchaseEntry(
  input: CreatePurchaseEntryInput,
): Promise<ActionResult<PurchaseEntryResult>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = createPurchaseEntrySchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  const vatRate = await getVatRate();
  const txnDate = kstMidnight(data.date);

  const result = await prisma.$transaction(async (tx) => {
    const voucherNo = await nextPurchaseVoucher(tx, data.date);
    let totalSupply = 0;
    let totalVat = 0;
    const rows = data.lines.map((l) => {
      const { supply, vat, total } = calcPurchaseLine(
        l.qty,
        l.unitPrice,
        data.taxType,
        vatRate,
      );
      totalSupply += supply;
      totalVat += vat;
      return {
        txnDate,
        kind: "PURCHASE" as const,
        taxType: data.taxType,
        clientCode: data.supplierCode ?? null,
        clientName: data.supplier,
        productCode: l.productCode ?? null,
        productName: l.productName,
        spec: l.spec ?? null,
        unit: l.unit ?? null,
        qty: l.qty.toString(),
        unitPrice: l.unitPrice.toString(),
        supplyAmount: supply.toString(),
        vat: vat.toString(),
        totalAmount: total.toString(),
        voucherNo,
        hasInvoice: false,
        memo: data.memo ?? null,
        importSource: MANUAL_SOURCE,
        createdBy: user.id,
      };
    });
    await tx.transactionLedger.createMany({ data: rows });
    return {
      voucherNo,
      lineCount: rows.length,
      totalSupply,
      totalVat,
      totalAmount: totalSupply + totalVat,
    };
  });

  await logAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "PURCHASE_ENTRY_CREATE",
    resource: `TransactionLedger:voucher:${result.voucherNo}`,
    metadata: {
      supplier: data.supplier,
      date: data.date,
      ...result,
    } as Prisma.InputJsonValue,
  });
  revalidatePath("/admin/data-explorer");
  return ok(result);
}

export type PurchaseEntrySummary = {
  voucherNo: string;
  date: string; // KST YYYY-MM-DD
  supplier: string;
  taxType: string | null;
  itemCount: number;
  totalSupply: number;
  totalVat: number;
  totalAmount: number;
  manual: boolean; // 수기 입력 전표 여부(삭제 가능)
};

/**
 * 매입 이력 — PURCHASE 행을 전표번호 기준 그룹핑(최근순).
 */
export async function listPurchaseEntries(
  opts: { limit?: number } = {},
): Promise<PurchaseEntrySummary[]> {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 200);

  // 최근 매입 행을 넉넉히 가져와 전표 단위로 집계 (전표당 라인 수가 적어 2000행이면 충분)
  const rows = await prisma.transactionLedger.findMany({
    where: { kind: "PURCHASE" },
    orderBy: [{ txnDate: "desc" }, { id: "desc" }],
    take: 2000,
    select: {
      voucherNo: true,
      txnDate: true,
      clientName: true,
      taxType: true,
      supplyAmount: true,
      vat: true,
      totalAmount: true,
      importSource: true,
    },
  });

  const map = new Map<string, PurchaseEntrySummary>();
  for (const r of rows) {
    const key = r.voucherNo || `${kstYmd(r.txnDate)}|${r.clientName || ""}`;
    let e = map.get(key);
    if (!e) {
      e = {
        voucherNo: r.voucherNo || "-",
        date: kstYmd(r.txnDate),
        supplier: r.clientName || "-",
        taxType: r.taxType,
        itemCount: 0,
        totalSupply: 0,
        totalVat: 0,
        totalAmount: 0,
        manual: (r.importSource || "").startsWith("manual"),
      };
      map.set(key, e);
    }
    e.itemCount += 1;
    e.totalSupply += Number(r.supplyAmount);
    e.totalVat += Number(r.vat);
    e.totalAmount += Number(r.totalAmount);
  }
  // rows 가 날짜 desc 이므로 insertion order ≈ 최근순
  return Array.from(map.values()).slice(0, limit);
}

/**
 * 수기 입력 전표 삭제 — importSource 가 manual 인 전표만 허용(시드/임포트 보호).
 */
export async function deletePurchaseEntry(
  voucherNo: string,
): Promise<ActionResult<{ deleted: number }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  if (!voucherNo) return fail("전표번호가 필요합니다");

  const res = await prisma.transactionLedger.deleteMany({
    where: { kind: "PURCHASE", voucherNo, importSource: MANUAL_SOURCE },
  });
  if (res.count === 0) {
    return fail("삭제할 수기 매입 전표를 찾을 수 없습니다");
  }

  await logAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "PURCHASE_ENTRY_DELETE",
    resource: `TransactionLedger:voucher:${voucherNo}`,
    metadata: { deleted: res.count } as Prisma.InputJsonValue,
  });
  revalidatePath("/admin/data-explorer");
  return ok({ deleted: res.count });
}

export type PurchaseJournalLine = {
  date: string; // KST YYYY-MM-DD
  voucherNo: string;
  supplier: string;
  item: string;
  spec: string;
  qty: number;
  unitPrice: number;
  supply: number;
  vat: number;
  total: number;
};

export type PurchaseJournalResult = {
  lines: PurchaseJournalLine[];
  count: number;
  truncated: boolean;
};

/**
 * 매입장 뷰 — kind=PURCHASE flat lines (KST 기간 경계, 매출장과 대칭).
 */
export async function getPurchaseJournal(input: {
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
}): Promise<PurchaseJournalResult> {
  await requireRole("TENANT_OWNER", "ADMIN");

  const limit = Math.min(Math.max(input.limit ?? 3000, 1), 5000);
  const from = input.from ? kstMidnight(input.from) : undefined;
  const toEx = input.to
    ? new Date(kstMidnight(input.to).getTime() + 86400000) // 종료일 포함(다음날 00:00 KST 미만)
    : undefined;

  const where: Prisma.TransactionLedgerWhereInput = { kind: "PURCHASE" };
  if (from || toEx) {
    where.txnDate = {
      ...(from ? { gte: from } : {}),
      ...(toEx ? { lt: toEx } : {}),
    };
  }
  const q = (input.q || "").trim();
  if (q) {
    where.OR = [
      { clientName: { contains: q, mode: "insensitive" } },
      { productName: { contains: q, mode: "insensitive" } },
      { voucherNo: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.transactionLedger.findMany({
    where,
    orderBy: [{ txnDate: "desc" }, { id: "desc" }],
    take: limit,
  });
  const truncated = rows.length === limit;

  const lines: PurchaseJournalLine[] = rows.map((r) => ({
    date: kstYmd(r.txnDate),
    voucherNo: r.voucherNo || "-",
    supplier: r.clientName || "-",
    item: r.productName,
    spec: r.spec || "",
    qty: Number(r.qty),
    unitPrice: Number(r.unitPrice),
    supply: Number(r.supplyAmount),
    vat: Number(r.vat),
    total: Number(r.totalAmount),
  }));

  return { lines, count: rows.length, truncated };
}
