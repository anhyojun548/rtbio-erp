/**
 * 테넌트 설정(TenantSetting) Zod 스키마 — Phase 3E-2 (R13).
 *
 * 알려진 키:
 *   - business_hour_start / business_hour_end  "HH:MM"
 *   - shipping_cutoff                          "HH:MM"
 *   - reorder_multiplier                       양수 소수 (재고 알람 배수)
 *   - vat_rate                                 0~1 사이 소수 (부가세율)
 *
 * 스키마 철학:
 *   - DB 스키마는 key/value 공용 문자열 — 모든 값은 string 으로 저장.
 *   - 검증은 "알려진 키" 별 별도 스키마로 분기 + 알려지지 않은 키는 reject.
 *   - UI 는 일괄(bulk) 업데이트로 한번에 저장하되, 각 키별 파싱을 독립 수행.
 */
import { z } from "zod";

/** HH:MM 24시간제. 00:00 ~ 23:59. */
const hhmmField = z
  .string()
  .trim()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "HH:MM 24시간제 형식이어야 합니다 (예: 09:00, 18:30).",
  );

const positiveDecimalField = z
  .string()
  .trim()
  .regex(
    /^\d+(\.\d+)?$/,
    "양수(소수 허용)여야 합니다.",
  )
  .refine((s) => Number(s) > 0, "0 보다 커야 합니다.");

const ratioField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "0~1 사이 소수여야 합니다.")
  .refine((s) => {
    const n = Number(s);
    return n >= 0 && n <= 1;
  }, "0 이상 1 이하여야 합니다.");

/** 알려진 키 리터럴 — 추후 확장 시 여기만 늘리면 됨. */
export const TENANT_SETTING_KEYS = [
  "business_hour_start",
  "business_hour_end",
  "shipping_cutoff",
  "reorder_multiplier",
  "vat_rate",
] as const;
export type TenantSettingKey = (typeof TENANT_SETTING_KEYS)[number];

/** 키별 값 스키마 — value 는 항상 string. */
export const settingValueSchemaByKey: Record<
  TenantSettingKey,
  z.ZodString | z.ZodEffects<z.ZodString, string, string>
> = {
  business_hour_start: hhmmField,
  business_hour_end: hhmmField,
  shipping_cutoff: hhmmField,
  reorder_multiplier: positiveDecimalField,
  vat_rate: ratioField,
};

/** 단일 키 업데이트 입력. */
export const updateSettingSchema = z
  .object({
    key: z.enum(TENANT_SETTING_KEYS, {
      errorMap: () => ({ message: "알려지지 않은 설정 키입니다." }),
    }),
    value: z.string().trim().min(1, "값이 비어있습니다."),
  })
  .superRefine((v, ctx) => {
    const keySchema = settingValueSchemaByKey[v.key];
    const r = keySchema.safeParse(v.value);
    if (!r.success) {
      for (const issue of r.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: ["value"],
        });
      }
    }
  });
export type UpdateSettingInput = z.input<typeof updateSettingSchema>;

/** 복수 키 업데이트 입력(설정 페이지 "저장" 버튼 용). */
export const bulkUpdateSettingsSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.enum(TENANT_SETTING_KEYS),
        value: z.string().trim().min(1),
      }),
    )
    .min(1, "변경할 항목이 없습니다.")
    .max(TENANT_SETTING_KEYS.length, "중복된 키가 포함되어 있습니다.")
    .refine(
      (arr) => new Set(arr.map((i) => i.key)).size === arr.length,
      "중복된 키가 포함되어 있습니다.",
    )
    .superRefine((items, ctx) => {
      items.forEach((it, idx) => {
        const keySchema = settingValueSchemaByKey[it.key];
        const r = keySchema.safeParse(it.value);
        if (!r.success) {
          for (const issue of r.error.issues) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `[${it.key}] ${issue.message}`,
              path: [idx, "value"],
            });
          }
        }
      });
    }),
});
export type BulkUpdateSettingsInput = z.input<typeof bulkUpdateSettingsSchema>;

/** 업무 시작 ≤ 종료 비즈니스 규칙 검증. */
export function validateBusinessHours(
  start: string,
  end: string,
): { ok: true } | { ok: false; message: string } {
  const [sh, sm] = start.split(":").map(Number) as [number, number];
  const [eh, em] = end.split(":").map(Number) as [number, number];
  const sMin = sh * 60 + sm;
  const eMin = eh * 60 + em;
  if (sMin >= eMin)
    return {
      ok: false,
      message: `업무 종료(${end})는 시작(${start}) 보다 늦어야 합니다.`,
    };
  return { ok: true };
}
