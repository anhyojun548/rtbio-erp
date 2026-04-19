/**
 * CEO 대시보드 위젯(R24) validators + preset 카탈로그.
 *
 * 프리셋은 10종:
 *   - KPI 6종 (단일 숫자)
 *   - LIST 4종 (5행 테이블)
 *
 * 모든 preset key 는 소문자 + 언더스코어. DB 의 `DashboardWidget.preset` 컬럼에
 * 그대로 저장된다 (스키마 column 명 그대로).
 */
import { z } from "zod";

export type WidgetKind = "kpi" | "list";

export type WidgetPreset = {
  key: string;
  label: string;
  description: string;
  kind: WidgetKind;
  defaultWidth: number; // 12-col grid
  defaultHeight: number;
  icon: string;
};

// ─── 프리셋 카탈로그 ──────────────────────────────────
export const DASHBOARD_WIDGET_PRESETS: WidgetPreset[] = [
  // KPI (6종)
  {
    key: "kpi_monthly_sales",
    label: "이번 달 매출",
    description: "ISSUED+SENT 거래명세서 합계",
    kind: "kpi",
    defaultWidth: 3,
    defaultHeight: 2,
    icon: "💰",
  },
  {
    key: "kpi_total_ar",
    label: "미수금 합계",
    description: "이번 달 원장 balance 합",
    kind: "kpi",
    defaultWidth: 3,
    defaultHeight: 2,
    icon: "📒",
  },
  {
    key: "kpi_open_orders",
    label: "진행 중 주문",
    description: "DRAFT + SUBMITTED + CONFIRMED + SHIPPING",
    kind: "kpi",
    defaultWidth: 3,
    defaultHeight: 2,
    icon: "📝",
  },
  {
    key: "kpi_active_clients",
    label: "활성 거래처",
    description: "active = true 거래처 수",
    kind: "kpi",
    defaultWidth: 3,
    defaultHeight: 2,
    icon: "🏢",
  },
  {
    key: "kpi_low_stock",
    label: "재고 임계치 알림",
    description: "OUT + LOW 사이즈 수",
    kind: "kpi",
    defaultWidth: 3,
    defaultHeight: 2,
    icon: "🚨",
  },
  {
    key: "kpi_expiring_contracts",
    label: "만료 임박 계약",
    description: "30일 이내 종료 예정 계약 수",
    kind: "kpi",
    defaultWidth: 3,
    defaultHeight: 2,
    icon: "📝",
  },
  // LIST (4종)
  {
    key: "list_top_clients",
    label: "Top 5 거래처 (이달 매출)",
    description: "ISSUED+SENT 매출 desc Top 5",
    kind: "list",
    defaultWidth: 6,
    defaultHeight: 4,
    icon: "🏆",
  },
  {
    key: "list_low_stock",
    label: "재고 부족 품목 Top 5",
    description: "OUT → LOW, 부족분 desc",
    kind: "list",
    defaultWidth: 6,
    defaultHeight: 4,
    icon: "📦",
  },
  {
    key: "list_ending_contracts",
    label: "만료 임박 계약 Top 5",
    description: "endDate asc, 30일 이내",
    kind: "list",
    defaultWidth: 6,
    defaultHeight: 4,
    icon: "🗓️",
  },
  {
    key: "list_recent_orders",
    label: "최근 주문 5건",
    description: "createdAt desc Top 5",
    kind: "list",
    defaultWidth: 6,
    defaultHeight: 4,
    icon: "📋",
  },
];

export const PRESET_KEYS = DASHBOARD_WIDGET_PRESETS.map((p) => p.key);
export const PRESET_BY_KEY: Record<string, WidgetPreset> = Object.fromEntries(
  DASHBOARD_WIDGET_PRESETS.map((p) => [p.key, p]),
);

export function isValidPresetKey(key: string): boolean {
  return PRESET_BY_KEY[key] !== undefined;
}

export function getPreset(key: string): WidgetPreset | undefined {
  return PRESET_BY_KEY[key];
}

// ─── 기본 레이아웃 (새 사용자용 4 KPI) ────────────────
export const DEFAULT_LAYOUT_KEYS: string[] = [
  "kpi_monthly_sales",
  "kpi_total_ar",
  "kpi_open_orders",
  "kpi_active_clients",
];

// ─── 스키마 ───────────────────────────────────────────
const presetKeySchema = z
  .string()
  .refine(isValidPresetKey, { message: "알 수 없는 위젯 프리셋입니다." });

export const addWidgetSchema = z.object({
  preset: presetKeySchema,
  // position 생략 시 actions 에서 max+1 로 append
  position: z.number().int().min(0).optional(),
  width: z.number().int().min(1).max(12).optional(),
  height: z.number().int().min(1).max(12).optional(),
});
export type AddWidgetInput = z.infer<typeof addWidgetSchema>;

export const updateWidgetSchema = z.object({
  id: z.string().cuid(),
  width: z.number().int().min(1).max(12).optional(),
  height: z.number().int().min(1).max(12).optional(),
  overrideDateRange: z
    .string()
    .max(50)
    .nullable()
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === null || v === "" ? null : v,
    ),
});
export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;

export const reorderWidgetsSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.string().cuid(),
          position: z.number().int().min(0),
        }),
      )
      .min(1)
      .max(20),
  })
  .superRefine((v, ctx) => {
    const ids = new Set<string>();
    for (const item of v.items) {
      if (ids.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "동일한 위젯 id 가 중복되었습니다.",
          path: ["items"],
        });
        return;
      }
      ids.add(item.id);
    }
  });
export type ReorderWidgetsInput = z.infer<typeof reorderWidgetsSchema>;

export const resetLayoutSchema = z.object({
  presetKeys: z
    .array(presetKeySchema)
    .min(0)
    .max(10)
    .optional(), // 생략 시 DEFAULT_LAYOUT_KEYS 사용
});
export type ResetLayoutInput = z.infer<typeof resetLayoutSchema>;

// ─── 일자 범위 override 지원 식별자 ───────────────────
export const DATE_RANGE_PRESETS = [
  "today",
  "last7",
  "last30",
  "month",
  "last_month",
] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];
export const DATE_RANGE_LABEL: Record<DateRangePreset, string> = {
  today: "오늘",
  last7: "최근 7일",
  last30: "최근 30일",
  month: "이번 달",
  last_month: "지난 달",
};
export function isValidDateRange(key: string): key is DateRangePreset {
  return (DATE_RANGE_PRESETS as readonly string[]).includes(key);
}
