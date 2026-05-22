/**
 * 베트남 발주 라벨 상수 (서버 액션과 분리 — "use server" 호환)
 */
import type { ProcurementCategory, ProcurementStatus, ShipmentTransport } from "@prisma/client";

export const PROC_CATEGORY_LABEL: Record<ProcurementCategory, string> = {
  FABRIC:   "원단",
  MATERIAL: "부자재",
  PRODUCT:  "제품",
};

export const PROC_STATUS_LABEL: Record<ProcurementStatus, string> = {
  PENDING:       "대기",
  IN_PRODUCTION: "생산중",
  SHIPPING:      "출고중",
  PARTIAL:       "부분입고",
  COMPLETED:     "입고완료",
};

export const TRANSPORT_LABEL: Record<ShipmentTransport, string> = {
  AIR: "항공 ✈️",
  SEA: "선박 🚢",
};
