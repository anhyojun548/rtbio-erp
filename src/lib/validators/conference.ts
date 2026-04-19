/**
 * 학회 + 방명록(Conference + ConferenceVisitor) Zod 스키마 — Phase 3F-3 (R21).
 *
 * Conference: 학회 기본 정보 (이름, 위치, 일자, 메모)
 * Visitor: 학회 방문자 명단 (이름·연락처·소속·담당자 배정·접촉 상태)
 *
 * 접촉 상태: 프로토타입에선 자유문자열이었으나 여기선 4단계 리터럴 매핑.
 *   - NEW(신규) · CONTACTING(접촉중) · DEAL(계약) · LOST(실패)
 *   빈 값/null 은 미분류로 취급.
 */
import { z } from "zod";

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

/**
 * 방문자 접촉 상태 리터럴 — DB 에는 자유문자열로 저장되나
 * UI/필터링 일관성 위해 앱 레이어에서 이 셋으로 좁힘.
 */
export const VISITOR_CONTACT_STATUS = [
  "NEW",
  "CONTACTING",
  "DEAL",
  "LOST",
] as const;
export type VisitorContactStatus = (typeof VISITOR_CONTACT_STATUS)[number];
export const VISITOR_CONTACT_STATUS_LABEL: Record<VisitorContactStatus, string> =
  {
    NEW: "신규",
    CONTACTING: "접촉중",
    DEAL: "계약",
    LOST: "실패",
  };

const contactStatusSchema = z
  .enum(VISITOR_CONTACT_STATUS)
  .optional()
  .or(
    z
      .string()
      .trim()
      .transform((v) => {
        if (v === "") return undefined;
        return VISITOR_CONTACT_STATUS.includes(v as VisitorContactStatus)
          ? (v as VisitorContactStatus)
          : undefined;
      }),
  );

// ─── Conference ──────────────────────────────────────────

const dateField = z.coerce.date({
  errorMap: () => ({ message: "올바른 날짜를 입력하세요." }),
});

export const createConferenceSchema = z
  .object({
    name: trimmed(1, 100, "학회명"),
    location: optionalTrimmed(200),
    startDate: dateField,
    endDate: dateField.optional(),
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
export type CreateConferenceInput = z.input<typeof createConferenceSchema>;
export type CreateConferenceData = z.output<typeof createConferenceSchema>;

export const updateConferenceSchema = z
  .object({
    id: z.string().cuid(),
    name: trimmed(1, 100, "학회명").optional(),
    location: optionalTrimmed(200),
    startDate: dateField.optional(),
    endDate: dateField.optional().nullable(),
    note: optionalTrimmed(1000).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.startDate && v.endDate.getTime() < v.startDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "종료일은 시작일 이후여야 합니다.",
      });
    }
  });
export type UpdateConferenceInput = z.input<typeof updateConferenceSchema>;

// ─── ConferenceVisitor ───────────────────────────────────

export const createVisitorSchema = z.object({
  conferenceId: z.string().cuid(),
  name: trimmed(1, 60, "이름"),
  phone: optionalTrimmed(30),
  affiliation: optionalTrimmed(100),
  assignedRepId: z
    .string()
    .cuid()
    .optional()
    .or(
      z
        .string()
        .trim()
        .transform((v) => (v === "" ? undefined : v))
        .refine((v) => v === undefined || /^c[a-z0-9]{20,}$/i.test(v), {
          message: "올바른 사용자 ID 가 아닙니다.",
        }),
    ),
  contactStatus: contactStatusSchema,
  note: optionalTrimmed(500),
});
export type CreateVisitorInput = z.input<typeof createVisitorSchema>;
export type CreateVisitorData = z.output<typeof createVisitorSchema>;

export const updateVisitorSchema = z.object({
  id: z.string().cuid(),
  name: trimmed(1, 60, "이름").optional(),
  phone: optionalTrimmed(30).nullable(),
  affiliation: optionalTrimmed(100).nullable(),
  assignedRepId: z
    .string()
    .cuid()
    .nullable()
    .optional()
    .or(
      z
        .string()
        .trim()
        .transform((v) => (v === "" ? null : v)),
    ),
  contactStatus: contactStatusSchema,
  note: optionalTrimmed(500).nullable(),
});
export type UpdateVisitorInput = z.input<typeof updateVisitorSchema>;
