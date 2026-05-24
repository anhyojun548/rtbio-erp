/**
 * TransactionLedger 검증자 — Phase 5 데이터 탐색기 (2026-05-22)
 *
 * 알티바이오 2023.01 ~ 2026.05 매입매출 거래 데이터 (41,536건 시드).
 * 엑셀/CSV 업로드 + 다운로드 + 필터 조회.
 */
import { z } from "zod";

export const TXN_KINDS = ["SALE", "PURCHASE"] as const;
export type TxnKindType = (typeof TXN_KINDS)[number];

export const TXN_KIND_LABEL: Record<TxnKindType, string> = {
  SALE:     "매출",
  PURCHASE: "매입",
};

/** 한글 라벨 → enum 변환 (엑셀 import 용) */
export function parseTxnKind(v: unknown): TxnKindType | null {
  const s = String(v ?? "").trim();
  if (s === "매출" || s === "SALE") return "SALE";
  if (s === "매입" || s === "PURCHASE") return "PURCHASE";
  return null;
}

/** 거래명세표 O/X → boolean */
export function parseHasInvoice(v: unknown): boolean {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "O" || s === "Y" || s === "TRUE";
}

/** 한 행 검증 (엑셀/CSV 업로드 시) */
export const transactionRowSchema = z.object({
  txnDate:      z.coerce.date(),
  kind:         z.enum(TXN_KINDS),
  taxType:      z.string().optional().nullable(),
  clientCode:   z.string().optional().nullable(),
  clientName:   z.string().optional().nullable(),
  productCode:  z.string().optional().nullable(),
  productName:  z.string(),
  spec:         z.string().optional().nullable(),
  unit:         z.string().optional().nullable(),
  qty:          z.coerce.number().default(0),
  unitPrice:    z.coerce.number().default(0),
  supplyAmount: z.coerce.number().default(0),
  vat:          z.coerce.number().default(0),
  totalAmount:  z.coerce.number().default(0),
  itemMemo:     z.string().optional().nullable(),
  voucherNo:    z.string().optional().nullable(),
  hasInvoice:   z.boolean().default(false),
  evidence:     z.string().optional().nullable(),
  category:     z.string().optional().nullable(),
  memo:         z.string().optional().nullable(),
});

export type TransactionRow = z.infer<typeof transactionRowSchema>;

/** 조회 필터 */
export const transactionFilterSchema = z.object({
  kind:        z.enum(TXN_KINDS).optional(),
  clientCode:  z.string().optional(),
  clientName:  z.string().optional(),
  productCode: z.string().optional(),
  productName: z.string().optional(),
  voucherNo:   z.string().optional(),
  from:        z.coerce.date().optional(),
  to:          z.coerce.date().optional(),
  q:           z.string().optional(), // 거래처/품목 통합 검색
  limit:       z.coerce.number().int().positive().max(10000).default(100),
  offset:      z.coerce.number().int().nonnegative().default(0),
});

export type TransactionFilter = z.infer<typeof transactionFilterSchema>;

/** 단건 패치 스키마 — 모든 필드 optional */
export const updateTransactionSchema = z.object({
  txnDate:      z.coerce.date().optional(),
  kind:         z.enum(TXN_KINDS).optional(),
  taxType:      z.string().nullable().optional(),
  clientCode:   z.string().nullable().optional(),
  clientName:   z.string().nullable().optional(),
  productCode:  z.string().nullable().optional(),
  productName:  z.string().optional(),
  spec:         z.string().nullable().optional(),
  unit:         z.string().nullable().optional(),
  qty:          z.coerce.number().int().min(0).optional(),
  unitPrice:    z.coerce.number().min(0).optional(),
  supplyAmount: z.coerce.number().min(0).optional(),
  vat:          z.coerce.number().min(0).optional(),
  totalAmount:  z.coerce.number().min(0).optional(),
  itemMemo:     z.string().nullable().optional(),
  voucherNo:    z.string().nullable().optional(),
  hasInvoice:   z.boolean().optional(),
  evidence:     z.string().nullable().optional(),
  category:     z.string().nullable().optional(),
  memo:         z.string().nullable().optional(),
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
