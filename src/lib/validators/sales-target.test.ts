import { describe, it, expect } from "vitest";
import {
  achievementRate,
  upsertSalesTargetSchema,
  targetMonthSchema,
  TARGET_CLIENT_TYPES,
} from "./sales-target";

describe("achievementRate", () => {
  it("95.7% 케이스 (47,850,000 / 50,000,000)", () => {
    expect(achievementRate(47_850_000, 50_000_000)).toBe(95.7);
  });
  it("정확히 100%", () => {
    expect(achievementRate(50_000_000, 50_000_000)).toBe(100);
  });
  it("초과 달성 120%", () => {
    expect(achievementRate(60_000_000, 50_000_000)).toBe(120);
  });
  it("target 0 → null (0으로 나누기 방지)", () => {
    expect(achievementRate(1000, 0)).toBeNull();
  });
  it("target 음수 → null", () => {
    expect(achievementRate(1000, -5)).toBeNull();
  });
  it("실적 0 → 0%", () => {
    expect(achievementRate(0, 50_000_000)).toBe(0);
  });
});

describe("upsertSalesTargetSchema", () => {
  const base = { salesRepId: "rep_1", month: "2026-06", clientType: "AGENCY", amount: 50_000_000 };

  it("정상 파싱", () => {
    const r = upsertSalesTargetSchema.parse(base);
    expect(r.clientType).toBe("AGENCY");
    expect(r.amount).toBe(50_000_000);
  });
  it("amount 문자열 coerce", () => {
    expect(upsertSalesTargetSchema.parse({ ...base, amount: "30000000" }).amount).toBe(30_000_000);
  });
  it("월 형식 검증 (YYYY-MM)", () => {
    expect(upsertSalesTargetSchema.safeParse({ ...base, month: "2026-6" }).success).toBe(false);
    expect(upsertSalesTargetSchema.safeParse({ ...base, month: "2026-13" }).success).toBe(false);
    expect(upsertSalesTargetSchema.safeParse({ ...base, month: "2026/06" }).success).toBe(false);
  });
  it("clientType 은 AGENCY/HOSPITAL 만 (PHARMACY/OTHER 거부)", () => {
    expect(upsertSalesTargetSchema.safeParse({ ...base, clientType: "PHARMACY" }).success).toBe(false);
    expect(upsertSalesTargetSchema.safeParse({ ...base, clientType: "OTHER" }).success).toBe(false);
    expect(TARGET_CLIENT_TYPES).toEqual(["AGENCY", "HOSPITAL"]);
  });
  it("음수 금액 거부, 0 허용", () => {
    expect(upsertSalesTargetSchema.safeParse({ ...base, amount: -1 }).success).toBe(false);
    expect(upsertSalesTargetSchema.safeParse({ ...base, amount: 0 }).success).toBe(true);
  });
  it("담당자 필수", () => {
    expect(upsertSalesTargetSchema.safeParse({ ...base, salesRepId: "" }).success).toBe(false);
  });
});

describe("targetMonthSchema", () => {
  it("정상/오류 월", () => {
    expect(targetMonthSchema.safeParse({ month: "2026-06" }).success).toBe(true);
    expect(targetMonthSchema.safeParse({ month: "bad" }).success).toBe(false);
  });
});
