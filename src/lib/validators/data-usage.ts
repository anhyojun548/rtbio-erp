/**
 * 데이터 사용량(DataUsage) Zod 스키마 — Phase 3G-1 (R22).
 *
 * 도메인 규칙:
 *   - 월 · 카테고리 unique — 동일 월의 동일 카테고리는 upsert.
 *   - `amount` 는 Decimal(14,2) — 음수 금지, 0 허용(측정값 0 의미).
 *   - `unit` 은 자유 문자열 ("GB", "건", "MB", "시간" 등).
 *   - `category` 도 자유 문자열이나 프리셋 제안 목록 제공.
 *   - `month` 는 "YYYY-MM" 형식.
 */
import { z } from "zod";

/** 카테고리 프리셋 — UI 자동완성용. DB 제약은 아님. */
export const DATA_USAGE_CATEGORY_PRESETS = [
  "서버",
  "스토리지",
  "데이터베이스",
  "이메일",
  "SMS",
  "대역폭",
  "백업",
  "로그",
  "CDN",
  "기타",
] as const;

export const DATA_USAGE_UNIT_PRESETS = [
  "GB",
  "MB",
  "TB",
  "건",
  "회",
  "시간",
  "분",
  "원",
] as const;

/** "YYYY-MM" 포맷 */
export const monthField = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "월은 YYYY-MM 형식이어야 합니다.");

const categoryField = z
  .string()
  .trim()
  .min(1, "카테고리를 입력해주세요.")
  .max(50, "카테고리는 50자 이내여야 합니다.");

const unitField = z
  .string()
  .trim()
  .min(1, "단위를 입력해주세요.")
  .max(20, "단위는 20자 이내여야 합니다.");

const amountField = z.coerce
  .number({ invalid_type_error: "수량은 숫자여야 합니다." })
  .nonnegative("수량은 0 이상이어야 합니다.")
  .max(999_999_999_999.99, "수량이 너무 큽니다.");

const noteField = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const createDataUsageSchema = z.object({
  month: monthField,
  category: categoryField,
  unit: unitField,
  amount: amountField,
  note: noteField,
});
export type CreateDataUsageInput = z.input<typeof createDataUsageSchema>;
export type CreateDataUsageData = z.output<typeof createDataUsageSchema>;

export const updateDataUsageSchema = z.object({
  id: z.string().cuid(),
  category: categoryField.optional(),
  unit: unitField.optional(),
  amount: amountField.optional(),
  note: noteField.nullable(),
});
export type UpdateDataUsageInput = z.input<typeof updateDataUsageSchema>;

/**
 * upsert 입력 — month+category 가 복합 unique 이므로 둘 다 필수.
 * 동일 키 존재 시 amount/unit/note 를 덮어쓴다.
 */
export const upsertDataUsageSchema = z.object({
  month: monthField,
  category: categoryField,
  unit: unitField,
  amount: amountField,
  note: noteField,
});
export type UpsertDataUsageInput = z.input<typeof upsertDataUsageSchema>;

/**
 * 전월(YYYY-MM)을 계산 — `MonthPicker` 와 동일 규약 사용.
 */
export function prevMonthString(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`invalid month: ${month}`);
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const prev = mm === 1 ? { y: y - 1, m: 12 } : { y, m: mm - 1 };
  return `${prev.y}-${String(prev.m).padStart(2, "0")}`;
}

/**
 * 전월 대비 증감 — 양수=증가, 음수=감소, null=비교 불가.
 */
export function computeMoMDelta(
  current: number,
  previous: number | null,
): { delta: number; percent: number | null } {
  if (previous === null) return { delta: current, percent: null };
  const delta = current - previous;
  if (previous === 0) return { delta, percent: null };
  return { delta, percent: (delta / previous) * 100 };
}
