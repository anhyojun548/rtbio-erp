/**
 * 매입 수기 입력 검증자 (2026-06-08)
 *
 * 매입은 별도 도메인 테이블 없이 TransactionLedger(kind=PURCHASE)에 저장한다.
 *  - 한 번의 입력 = 하나의 전표번호(PUR-YYYYMMDD-NNN)를 공유하는 N개 라인.
 *  - 금액: 라인별 공급가 = round(수량 × 단가), VAT = 과세만 round(공급가 × vatRate), 합계 = 공급가 + VAT.
 */
import { z } from "zod";

export const TAX_TYPES = ["과세", "면세", "영세"] as const;
export type TaxType = (typeof TAX_TYPES)[number];

/** 선택 문자열 — 공백/빈문자/ null 은 undefined 로 정규화 */
const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : undefined));

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** 매입 입력 한 라인 */
export const purchaseLineSchema = z.object({
  productName: z.string().trim().min(1, "품목명을 입력하세요").max(200),
  productCode: optStr(100),
  spec: optStr(50),
  unit: optStr(30),
  qty: z.coerce.number().positive("수량은 0보다 커야 합니다").max(10_000_000),
  unitPrice: z.coerce.number().nonnegative("단가는 0 이상이어야 합니다").max(1_000_000_000),
});
export type PurchaseLineInput = z.infer<typeof purchaseLineSchema>;

/** 매입 전표(헤더 + 라인) 생성 입력 */
export const createPurchaseEntrySchema = z.object({
  date: z.string().regex(YMD, "매입일자는 YYYY-MM-DD 형식이어야 합니다"),
  supplier: z.string().trim().min(1, "공급처를 입력하세요").max(200),
  supplierCode: optStr(100),
  taxType: z.enum(TAX_TYPES).default("과세"),
  memo: optStr(500),
  lines: z.array(purchaseLineSchema).min(1, "매입 품목을 1개 이상 입력하세요").max(100),
});
export type CreatePurchaseEntryInput = z.infer<typeof createPurchaseEntrySchema>;

/** 매입장 조회 필터 */
export const purchaseJournalQuerySchema = z.object({
  from: z.string().regex(YMD).optional(),
  to: z.string().regex(YMD).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
});
export type PurchaseJournalQuery = z.infer<typeof purchaseJournalQuerySchema>;

/**
 * 라인 금액 계산 (순수함수).
 * 과세만 VAT, 면세/영세는 VAT 0.
 */
export function calcPurchaseLine(
  qty: number,
  unitPrice: number,
  taxType: TaxType,
  vatRate = 0.1,
): { supply: number; vat: number; total: number } {
  const supply = Math.round(qty * unitPrice);
  const vat = taxType === "과세" ? Math.round(supply * vatRate) : 0;
  return { supply, vat, total: supply + vat };
}
