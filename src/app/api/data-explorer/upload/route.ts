/**
 * POST /api/data-explorer/upload
 *
 * multipart/form-data 로 엑셀(.xlsx)/CSV(.csv) 파일을 받아서
 * TransactionLedger 에 bulk insert.
 *
 * 권한: TENANT_OWNER / ADMIN
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import {
  parseExcelTransactions,
  parseCsvTransactions,
} from "@/lib/transaction-parser";
import { bulkInsertTransactions } from "@/lib/actions/transaction-ledger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireRole("TENANT_OWNER", "ADMIN");
  } catch {
    return NextResponse.json({ ok: false, error: "권한이 없습니다" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "파일이 첨부되지 않았습니다" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let parsed;
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    parsed = parseExcelTransactions(buf);
  } else if (name.endsWith(".csv")) {
    parsed = parseCsvTransactions(buf.toString("utf-8"));
  } else {
    return NextResponse.json(
      { ok: false, error: "지원하지 않는 파일 형식. .xlsx, .csv 만 가능합니다" },
      { status: 400 },
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `파일에서 거래 행을 찾지 못했습니다 (전체 ${parsed.total}, 건너뜀 ${parsed.skipped})`,
      },
      { status: 400 },
    );
  }

  const res = await bulkInsertTransactions(
    parsed.rows,
    `${name.endsWith(".csv") ? "csv" : "excel"}:${file.name}`,
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  return NextResponse.json({
    ok:       true,
    inserted: res.data.inserted,
    total:    parsed.total,
    skipped:  parsed.skipped,
  });
}
