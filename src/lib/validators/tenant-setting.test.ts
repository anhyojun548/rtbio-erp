import { describe, it, expect } from "vitest";
import {
  updateSettingSchema,
  bulkUpdateSettingsSchema,
  validateBusinessHours,
  TENANT_SETTING_KEYS,
} from "./tenant-setting";

describe("updateSettingSchema", () => {
  it("business_hour_start — 정상 HH:MM", () => {
    const r = updateSettingSchema.parse({
      key: "business_hour_start",
      value: "09:00",
    });
    expect(r.value).toBe("09:00");
  });

  it("business_hour_end — 24:00 거부", () => {
    const r = updateSettingSchema.safeParse({
      key: "business_hour_end",
      value: "24:00",
    });
    expect(r.success).toBe(false);
  });

  it("shipping_cutoff — 9:00 (한자리 시) 거부", () => {
    const r = updateSettingSchema.safeParse({
      key: "shipping_cutoff",
      value: "9:00",
    });
    expect(r.success).toBe(false);
  });

  it("reorder_multiplier — 양수 OK", () => {
    const r = updateSettingSchema.parse({
      key: "reorder_multiplier",
      value: "2.5",
    });
    expect(r.value).toBe("2.5");
  });

  it("reorder_multiplier — 0 거부", () => {
    const r = updateSettingSchema.safeParse({
      key: "reorder_multiplier",
      value: "0",
    });
    expect(r.success).toBe(false);
  });

  it("reorder_multiplier — 음수 거부", () => {
    const r = updateSettingSchema.safeParse({
      key: "reorder_multiplier",
      value: "-1",
    });
    expect(r.success).toBe(false);
  });

  it("vat_rate — 0.10 OK", () => {
    const r = updateSettingSchema.parse({
      key: "vat_rate",
      value: "0.10",
    });
    expect(r.value).toBe("0.10");
  });

  it("vat_rate — 1 초과 거부", () => {
    const r = updateSettingSchema.safeParse({
      key: "vat_rate",
      value: "1.5",
    });
    expect(r.success).toBe(false);
  });

  it("알려지지 않은 key 거부", () => {
    const r = updateSettingSchema.safeParse({
      key: "random_key",
      value: "x",
    });
    expect(r.success).toBe(false);
  });

  it("빈 value 거부", () => {
    const r = updateSettingSchema.safeParse({
      key: "vat_rate",
      value: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("bulkUpdateSettingsSchema", () => {
  it("정상 5개 일괄", () => {
    const r = bulkUpdateSettingsSchema.parse({
      items: [
        { key: "business_hour_start", value: "09:00" },
        { key: "business_hour_end", value: "18:00" },
        { key: "shipping_cutoff", value: "15:30" },
        { key: "reorder_multiplier", value: "2.5" },
        { key: "vat_rate", value: "0.10" },
      ],
    });
    expect(r.items.length).toBe(5);
  });

  it("key 중복 거부", () => {
    const r = bulkUpdateSettingsSchema.safeParse({
      items: [
        { key: "vat_rate", value: "0.10" },
        { key: "vat_rate", value: "0.08" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("빈 배열 거부", () => {
    const r = bulkUpdateSettingsSchema.safeParse({ items: [] });
    expect(r.success).toBe(false);
  });

  it("1개 항목이라도 invalid 면 전체 실패", () => {
    const r = bulkUpdateSettingsSchema.safeParse({
      items: [
        { key: "business_hour_start", value: "09:00" },
        { key: "vat_rate", value: "5" },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("validateBusinessHours", () => {
  it("시작 < 종료 OK", () => {
    expect(validateBusinessHours("09:00", "18:00")).toEqual({ ok: true });
  });

  it("시작 == 종료 거부", () => {
    const r = validateBusinessHours("09:00", "09:00");
    expect(r.ok).toBe(false);
  });

  it("시작 > 종료 거부", () => {
    const r = validateBusinessHours("19:00", "09:00");
    expect(r.ok).toBe(false);
  });
});

describe("TENANT_SETTING_KEYS", () => {
  it("5개 고정 키", () => {
    expect(TENANT_SETTING_KEYS).toEqual([
      "business_hour_start",
      "business_hour_end",
      "shipping_cutoff",
      "reorder_multiplier",
      "vat_rate",
    ]);
  });
});
