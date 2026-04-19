import { describe, expect, it } from "vitest";
import {
  DASHBOARD_WIDGET_PRESETS,
  DEFAULT_LAYOUT_KEYS,
  PRESET_KEYS,
  addWidgetSchema,
  getPreset,
  isValidDateRange,
  isValidPresetKey,
  reorderWidgetsSchema,
  resetLayoutSchema,
  updateWidgetSchema,
} from "./widget-dashboard";

describe("widget-dashboard: 프리셋 카탈로그", () => {
  it("최소 10개 프리셋을 노출한다", () => {
    expect(DASHBOARD_WIDGET_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
  it("모든 key 는 고유하다", () => {
    const set = new Set(PRESET_KEYS);
    expect(set.size).toBe(PRESET_KEYS.length);
  });
  it("기본 레이아웃은 모두 유효한 key", () => {
    for (const k of DEFAULT_LAYOUT_KEYS) {
      expect(isValidPresetKey(k)).toBe(true);
    }
  });
  it("isValidPresetKey — 존재/비존재 구분", () => {
    expect(isValidPresetKey("kpi_monthly_sales")).toBe(true);
    expect(isValidPresetKey("kpi_unknown")).toBe(false);
    expect(isValidPresetKey("")).toBe(false);
  });
  it("getPreset — kind 타입 매핑", () => {
    expect(getPreset("kpi_monthly_sales")?.kind).toBe("kpi");
    expect(getPreset("list_top_clients")?.kind).toBe("list");
  });
});

describe("widget-dashboard: addWidgetSchema", () => {
  it("유효한 preset 통과", () => {
    const r = addWidgetSchema.safeParse({ preset: "kpi_monthly_sales" });
    expect(r.success).toBe(true);
  });
  it("알 수 없는 preset 거부", () => {
    const r = addWidgetSchema.safeParse({ preset: "kpi_bogus" });
    expect(r.success).toBe(false);
  });
  it("width 범위 1-12", () => {
    expect(
      addWidgetSchema.safeParse({ preset: "kpi_monthly_sales", width: 0 })
        .success,
    ).toBe(false);
    expect(
      addWidgetSchema.safeParse({ preset: "kpi_monthly_sales", width: 13 })
        .success,
    ).toBe(false);
    expect(
      addWidgetSchema.safeParse({ preset: "kpi_monthly_sales", width: 6 })
        .success,
    ).toBe(true);
  });
  it("position 음수 거부", () => {
    expect(
      addWidgetSchema.safeParse({ preset: "kpi_monthly_sales", position: -1 })
        .success,
    ).toBe(false);
  });
});

describe("widget-dashboard: updateWidgetSchema", () => {
  it("overrideDateRange null → null, '' → null, 'month' → 'month'", () => {
    const a = updateWidgetSchema.safeParse({
      id: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      overrideDateRange: null,
    });
    expect(a.success && a.data.overrideDateRange).toBeNull();
    const b = updateWidgetSchema.safeParse({
      id: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      overrideDateRange: "",
    });
    expect(b.success && b.data.overrideDateRange).toBeNull();
    const c = updateWidgetSchema.safeParse({
      id: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      overrideDateRange: "month",
    });
    expect(c.success && c.data.overrideDateRange).toBe("month");
  });
  it("id cuid 거부", () => {
    expect(
      updateWidgetSchema.safeParse({ id: "not-a-cuid", width: 4 }).success,
    ).toBe(false);
  });
});

describe("widget-dashboard: reorderWidgetsSchema", () => {
  it("최소 1, 최대 20", () => {
    expect(reorderWidgetsSchema.safeParse({ items: [] }).success).toBe(false);
    const ok = reorderWidgetsSchema.safeParse({
      items: [{ id: "ckxxxxxxxxxxxxxxxxxxxxxxx", position: 0 }],
    });
    expect(ok.success).toBe(true);
  });
  it("id 중복 거부", () => {
    const r = reorderWidgetsSchema.safeParse({
      items: [
        { id: "ckxxxxxxxxxxxxxxxxxxxxxxx", position: 0 },
        { id: "ckxxxxxxxxxxxxxxxxxxxxxxx", position: 1 },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("widget-dashboard: resetLayoutSchema", () => {
  it("생략된 presetKeys 는 undefined (=기본 레이아웃)", () => {
    const r = resetLayoutSchema.safeParse({});
    expect(r.success).toBe(true);
  });
  it("유효하지 않은 key 섞여 있으면 거부", () => {
    const r = resetLayoutSchema.safeParse({
      presetKeys: ["kpi_monthly_sales", "unknown_key"],
    });
    expect(r.success).toBe(false);
  });
});

describe("widget-dashboard: isValidDateRange", () => {
  it("프리셋 5종 통과", () => {
    for (const k of ["today", "last7", "last30", "month", "last_month"]) {
      expect(isValidDateRange(k)).toBe(true);
    }
  });
  it("비-프리셋 거부", () => {
    expect(isValidDateRange("year")).toBe(false);
    expect(isValidDateRange("")).toBe(false);
  });
});
