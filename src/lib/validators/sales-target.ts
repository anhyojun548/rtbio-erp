/**
 * 영업 매출 목표(SalesTarget) 검증자 (2026-06-08)
 *
 * 목표 단위: 담당자 × 월 × 거래처유형(대리점/병원). 총액 = 유형별 합.
 * 실적(actual)은 Invoice(ISSUED+SENT) 매출을 거래처 type 으로 분리 집계 → 달성률.
 */
import { z } from "zod";

/** 목표를 잡는 거래처 유형 (대리점/병원만 — PHARMACY/OTHER 는 목표 비대상) */
export const TARGET_CLIENT_TYPES = ["AGENCY", "HOSPITAL"] as const;
export type TargetClientType = (typeof TARGET_CLIENT_TYPES)[number];

export const TARGET_CLIENT_TYPE_LABEL: Record<TargetClientType, string> = {
  AGENCY: "대리점",
  HOSPITAL: "병원",
};

const YMD_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const targetMonthSchema = z.object({
  month: z.string().regex(YMD_MONTH, "월은 YYYY-MM 형식이어야 합니다"),
});

export const upsertSalesTargetSchema = z.object({
  salesRepId: z.string().min(1, "담당자를 지정하세요"),
  month: z.string().regex(YMD_MONTH, "월은 YYYY-MM 형식이어야 합니다"),
  clientType: z.enum(TARGET_CLIENT_TYPES),
  amount: z.coerce
    .number()
    .nonnegative("목표 금액은 0 이상이어야 합니다")
    .max(1_000_000_000_000),
});
export type UpsertSalesTargetInput = z.infer<typeof upsertSalesTargetSchema>;

/**
 * 달성률 % (소수 1자리). target 이 0/음수면 null (0으로 나누기 방지).
 *  예) actual=47,850,000 target=50,000,000 → 95.7
 */
export function achievementRate(actual: number, target: number): number | null {
  if (!target || target <= 0) return null;
  return Math.round((actual / target) * 1000) / 10;
}
