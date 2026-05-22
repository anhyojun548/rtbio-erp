/**
 * 거래원장 엑셀/CSV 파서 (서버 또는 클라이언트 모두 사용 가능)
 *
 * 헤더 매핑 (한글 → 모델 필드):
 *   날짜 → txnDate
 *   구분 → kind (매출/매입)
 *   유형 → taxType
 *   코드 → clientCode
 *   거래처 → clientName
 *   품목코드 → productCode
 *   품목명 → productName
 *   규격 → spec
 *   단위 → unit
 *   수량 → qty
 *   단가 → unitPrice
 *   공급가 → supplyAmount
 *   부가세 → vat
 *   합계금액 → totalAmount
 *   품목비고 → itemMemo
 *   전표번호 → voucherNo
 *   거래명세표 → hasInvoice (O/X)
 *   증빙 → evidence
 *   거래범주 → category
 *   비고 → memo
 */
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  parseTxnKind,
  parseHasInvoice,
  type TransactionRow,
} from "@/lib/validators/transaction-ledger";

/** 한글 헤더 → 모델 필드 매핑 */
const HEADER_MAP: Record<string, keyof TransactionRow> = {
  "날짜":         "txnDate",
  "구분":         "kind",
  "유형":         "taxType",
  "코드":         "clientCode",
  "거래처":       "clientName",
  "품목코드":     "productCode",
  "품목명":       "productName",
  "규격":         "spec",
  "단위":         "unit",
  "수량":         "qty",
  "단가":         "unitPrice",
  "공급가":       "supplyAmount",
  "부가세":       "vat",
  "합계금액":     "totalAmount",
  "품목비고":     "itemMemo",
  "전표번호":     "voucherNo",
  "거래명세표":   "hasInvoice",
  "증빙":         "evidence",
  "거래범주":     "category",
  "비고":         "memo",
};

/** raw row(헤더 키) → TransactionRow 변환 */
function normalizeRow(raw: Record<string, unknown>): TransactionRow | null {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const field = HEADER_MAP[k.trim()] ?? null;
    if (field) r[field] = v;
  }
  // 필수 필드 누락 시 skip
  if (!r.txnDate || !r.productName) return null;

  // 변환
  const kind = parseTxnKind(r.kind);
  if (!kind) return null;
  const hasInvoice = parseHasInvoice(r.hasInvoice);

  // 날짜 — Excel 일련번호 또는 문자열
  let txnDate: Date;
  if (typeof r.txnDate === "number") {
    // Excel serial date (1900 epoch)
    const ms = (r.txnDate - 25569) * 86400 * 1000;
    txnDate = new Date(ms);
  } else {
    txnDate = new Date(String(r.txnDate));
  }
  if (isNaN(txnDate.getTime())) return null;

  const num = (v: unknown) => {
    if (v == null || v === "") return 0;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
  };
  const str = (v: unknown) => (v == null || v === "" ? null : String(v).trim());

  return {
    txnDate,
    kind,
    taxType:      str(r.taxType),
    clientCode:   str(r.clientCode),
    clientName:   str(r.clientName),
    productCode:  str(r.productCode),
    productName:  String(r.productName).trim(),
    spec:         str(r.spec),
    unit:         str(r.unit),
    qty:          num(r.qty),
    unitPrice:    num(r.unitPrice),
    supplyAmount: num(r.supplyAmount),
    vat:          num(r.vat),
    totalAmount:  num(r.totalAmount),
    itemMemo:     str(r.itemMemo),
    voucherNo:    str(r.voucherNo),
    hasInvoice,
    evidence:     str(r.evidence),
    category:     str(r.category),
    memo:         str(r.memo),
  };
}

/** 엑셀 파일 → TransactionRow[] (Buffer/ArrayBuffer 입력) */
export function parseExcelTransactions(buffer: ArrayBuffer | Buffer): {
  rows: TransactionRow[];
  total: number;
  skipped: number;
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const rows: TransactionRow[] = [];
  let skipped = 0;
  for (const r of raw) {
    const n = normalizeRow(r);
    if (n) rows.push(n);
    else skipped++;
  }
  return { rows, total: raw.length, skipped };
}

/** CSV 텍스트 → TransactionRow[] */
export function parseCsvTransactions(text: string): {
  rows: TransactionRow[];
  total: number;
  skipped: number;
} {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: TransactionRow[] = [];
  let skipped = 0;
  for (const r of result.data) {
    const n = normalizeRow(r);
    if (n) rows.push(n);
    else skipped++;
  }
  return { rows, total: result.data.length, skipped };
}

/** TransactionLedger 배열 → CSV 문자열 (BOM 포함, 한글 헤더) */
export function toCsv(
  rows: Array<{
    txnDate: Date | string;
    kind: string;
    taxType?: string | null;
    clientCode?: string | null;
    clientName?: string | null;
    productCode?: string | null;
    productName: string;
    spec?: string | null;
    unit?: string | null;
    qty: number | string;
    unitPrice: number | string;
    supplyAmount: number | string;
    vat: number | string;
    totalAmount: number | string;
    itemMemo?: string | null;
    voucherNo?: string | null;
    hasInvoice: boolean;
    evidence?: string | null;
    category?: string | null;
    memo?: string | null;
  }>,
): string {
  const header = [
    "날짜", "구분", "유형", "코드", "거래처", "품목코드", "품목명", "규격", "단위",
    "수량", "단가", "공급가", "부가세", "합계금액", "품목비고", "전표번호",
    "거래명세표", "증빙", "거래범주", "비고",
  ];
  const data = rows.map((r) => ({
    날짜:         (r.txnDate instanceof Date ? r.txnDate : new Date(r.txnDate)).toISOString().slice(0, 10),
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
  const csv = Papa.unparse({ fields: header, data });
  // UTF-8 BOM (엑셀 한글 깨짐 방지)
  return "﻿" + csv;
}
