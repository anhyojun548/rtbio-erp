/**
 * GET /api/data-explorer/download?format=csv|xlsx&kind=...&from=...&to=...
 *
 * 현재 필터된 거래원장 데이터를 CSV 또는 엑셀로 다운로드.
 *
 * 권한: TENANT_OWNER / ADMIN / EXEC / QC
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/transaction-parser";
import { transactionFilterSchema } from "@/lib/validators/transaction-ledger";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  } catch {
    return new NextResponse("권한이 없습니다", { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const format = (sp.get("format") ?? "csv").toLowerCase();

  // 필터 파싱 (limit 은 다운로드용으로 크게)
  const parsed = transactionFilterSchema.safeParse({
    kind:        sp.get("kind") ?? undefined,
    clientCode:  sp.get("clientCode") ?? undefined,
    productCode: sp.get("productCode") ?? undefined,
    voucherNo:   sp.get("voucherNo") ?? undefined,
    from:        sp.get("from") ?? undefined,
    to:          sp.get("to") ?? undefined,
    q:           sp.get("q") ?? undefined,
    limit:       10000, // 다운로드 상한 (제한 필요시 조정)
    offset:      0,
  });
  if (!parsed.success) {
    return new NextResponse("잘못된 필터", { status: 400 });
  }
  const f = parsed.data;

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

  const rows = await prisma.transactionLedger.findMany({
    where,
    orderBy: [{ txnDate: "desc" }, { id: "desc" }],
    take: f.limit,
  });

  const today = new Date().toISOString().slice(0, 10);
  const baseName = `transactions_${today}`;

  if (format === "xlsx") {
    // 엑셀 다운로드
    const aoaData = rows.map((r) => ({
      날짜:         r.txnDate.toISOString().slice(0, 10),
      구분:         r.kind === "SALE" ? "매출" : "매입",
      유형:         r.taxType ?? "",
      코드:         r.clientCode ?? "",
      거래처:       r.clientName ?? "",
      품목코드:     r.productCode ?? "",
      품목명:       r.productName,
      규격:         r.spec ?? "",
      단위:         r.unit ?? "",
      수량:         Number(r.qty),
      단가:         Number(r.unitPrice),
      공급가:       Number(r.supplyAmount),
      부가세:       Number(r.vat),
      합계금액:     Number(r.totalAmount),
      품목비고:     r.itemMemo ?? "",
      전표번호:     r.voucherNo ?? "",
      거래명세표:   r.hasInvoice ? "O" : "X",
      증빙:         r.evidence ?? "",
      거래범주:     r.category ?? "",
      비고:         r.memo ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(aoaData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "거래원장");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    });
  }

  // 기본: CSV
  const csv = toCsv(rows.map((r) => ({
    ...r,
    qty: Number(r.qty),
    unitPrice: Number(r.unitPrice),
    supplyAmount: Number(r.supplyAmount),
    vat: Number(r.vat),
    totalAmount: Number(r.totalAmount),
  })));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
    },
  });
}
