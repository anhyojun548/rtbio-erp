/**
 * 판매 계약서(SalesContract) Zod 스키마 — Phase 3G-2 (R20).
 *
 * 도메인 규칙:
 *   - `title`: 계약서 제목 (1~200).
 *   - `startDate`: 계약 시작일 (필수).
 *   - `endDate`: 계약 종료일 (선택) — 명시되면 startDate 이후여야 함.
 *   - `pdfUrl`: 업로드된 계약서 PDF URL (선택). 프로토타입 단계에선 수기 URL 입력 허용.
 *   - `signed`: 서명 완료 여부 (기본 false).
 *   - `note`: 메모 (0~1000).
 *
 * 만료 상태 분류(classifyContract):
 *   - EXPIRED: endDate < today (만료됨)
 *   - ENDING_SOON: 0 <= daysLeft <= 30 (30일 이내 만료)
 *   - ACTIVE: daysLeft > 30 또는 endDate 없음 (무기한)
 *   - FUTURE: startDate > today (미발효)
 */
import { z } from "zod";

export const CONTRACT_STATUS = [
  "ACTIVE",
  "ENDING_SOON",
  "EXPIRED",
  "FUTURE",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  ACTIVE: "활성",
  ENDING_SOON: "만료임박",
  EXPIRED: "만료",
  FUTURE: "예정",
};

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label}은(는) 최소 ${min}자 이상이어야 합니다.`)
    .max(max, `${label}은(는) 최대 ${max}자 이하여야 합니다.`);

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

const dateField = z.coerce.date({
  errorMap: () => ({ message: "올바른 날짜를 입력하세요." }),
});

/** URL 은 단순히 http/https 시작 여부만 확인 (프로토타입 단계). */
const pdfUrlField = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || /^https?:\/\//.test(v),
    "http:// 또는 https:// 로 시작해야 합니다.",
  )
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const createContractSchema = z
  .object({
    clientId: z.string().cuid(),
    title: trimmed(1, 200, "계약서 제목"),
    startDate: dateField,
    endDate: dateField.optional(),
    pdfUrl: pdfUrlField,
    signed: z.boolean().optional().default(false),
    note: optionalTrimmed(1000),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate.getTime() < v.startDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "종료일은 시작일 이후여야 합니다.",
      });
    }
  });
export type CreateContractInput = z.input<typeof createContractSchema>;
export type CreateContractData = z.output<typeof createContractSchema>;

export const updateContractSchema = z
  .object({
    id: z.string().cuid(),
    title: trimmed(1, 200, "계약서 제목").optional(),
    startDate: dateField.optional(),
    endDate: dateField.nullable().optional(),
    pdfUrl: pdfUrlField.nullable(),
    signed: z.boolean().optional(),
    note: optionalTrimmed(1000).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate.getTime() < v.startDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "종료일은 시작일 이후여야 합니다.",
      });
    }
  });
export type UpdateContractInput = z.input<typeof updateContractSchema>;

/**
 * 계약 상태 분류 + 남은 일수.
 * @param startDate 계약 시작일
 * @param endDate   계약 종료일 (null 이면 무기한)
 * @param now       기준 시각 (default = new Date())
 */
export function classifyContract(
  startDate: Date,
  endDate: Date | null,
  now: Date = new Date(),
): { status: ContractStatus; daysLeft: number | null; daysUntilStart: number } {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilStart = Math.round(
    (start.getTime() - today.getTime()) / msPerDay,
  );

  if (daysUntilStart > 0) {
    return { status: "FUTURE", daysLeft: null, daysUntilStart };
  }

  if (!endDate) {
    return { status: "ACTIVE", daysLeft: null, daysUntilStart };
  }

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((end.getTime() - today.getTime()) / msPerDay);

  if (daysLeft < 0) return { status: "EXPIRED", daysLeft, daysUntilStart };
  if (daysLeft <= 30)
    return { status: "ENDING_SOON", daysLeft, daysUntilStart };
  return { status: "ACTIVE", daysLeft, daysUntilStart };
}
