import { describe, it, expect } from "vitest";
import {
  createDataUsageSchema,
  updateDataUsageSchema,
  upsertDataUsageSchema,
  monthField,
  prevMonthString,
  computeMoMDelta,
  DATA_USAGE_CATEGORY_PRESETS,
} from "./data-usage";

describe("monthField", () => {
  it("accepts YYYY-MM", () => {
    expect(monthField.parse("2026-04")).toBe("2026-04");
    expect(monthField.parse("2026-12")).toBe("2026-12");
    expect(monthField.parse("2026-01")).toBe("2026-01");
  });
  it("rejects invalid formats", () => {
    expect(() => monthField.parse("2026-4")).toThrow();
    expect(() => monthField.parse("202604")).toThrow();
    expect(() => monthField.parse("2026-13")).toThrow();
    expect(() => monthField.parse("2026-00")).toThrow();
  });
});

describe("createDataUsageSchema", () => {
  it("parses valid input", () => {
    const r = createDataUsageSchema.parse({
      month: "2026-04",
      category: "서버",
      unit: "GB",
      amount: "128.5",
      note: "월 피크",
    });
    expect(r.amount).toBe(128.5);
    expect(r.note).toBe("월 피크");
  });

  it("coerces number from string", () => {
    const r = createDataUsageSchema.parse({
      month: "2026-04",
      category: "이메일",
      unit: "건",
      amount: 1200,
    });
    expect(r.amount).toBe(1200);
    expect(r.note).toBeUndefined();
  });

  it("rejects negative amount", () => {
    expect(() =>
      createDataUsageSchema.parse({
        month: "2026-04",
        category: "서버",
        unit: "GB",
        amount: -1,
      }),
    ).toThrow();
  });

  it("allows amount=0", () => {
    const r = createDataUsageSchema.parse({
      month: "2026-04",
      category: "SMS",
      unit: "건",
      amount: 0,
    });
    expect(r.amount).toBe(0);
  });

  it("rejects empty category", () => {
    expect(() =>
      createDataUsageSchema.parse({
        month: "2026-04",
        category: "",
        unit: "GB",
        amount: 10,
      }),
    ).toThrow();
  });

  it("treats empty note as undefined", () => {
    const r = createDataUsageSchema.parse({
      month: "2026-04",
      category: "서버",
      unit: "GB",
      amount: 10,
      note: "",
    });
    expect(r.note).toBeUndefined();
  });
});

describe("updateDataUsageSchema", () => {
  it("accepts partial patch", () => {
    const r = updateDataUsageSchema.parse({
      id: "c" + "a".repeat(24),
      amount: 200,
    });
    expect(r.amount).toBe(200);
    expect(r.category).toBeUndefined();
  });

  it("allows nullable note to clear", () => {
    const r = updateDataUsageSchema.parse({
      id: "c" + "a".repeat(24),
      note: null,
    });
    expect(r.note).toBeNull();
  });
});

describe("upsertDataUsageSchema", () => {
  it("requires month+category together", () => {
    const r = upsertDataUsageSchema.parse({
      month: "2026-04",
      category: "서버",
      unit: "GB",
      amount: 100,
    });
    expect(r.month).toBe("2026-04");
    expect(r.category).toBe("서버");
  });
});

describe("prevMonthString", () => {
  it("rolls back within year", () => {
    expect(prevMonthString("2026-04")).toBe("2026-03");
    expect(prevMonthString("2026-12")).toBe("2026-11");
  });
  it("rolls back across year", () => {
    expect(prevMonthString("2026-01")).toBe("2025-12");
  });
  it("throws on invalid", () => {
    expect(() => prevMonthString("2026")).toThrow();
    expect(() => prevMonthString("")).toThrow();
  });
});

describe("computeMoMDelta", () => {
  it("returns delta+percent when previous>0", () => {
    expect(computeMoMDelta(150, 100)).toEqual({ delta: 50, percent: 50 });
    expect(computeMoMDelta(80, 100)).toEqual({ delta: -20, percent: -20 });
  });
  it("returns null percent when previous is 0", () => {
    const r = computeMoMDelta(100, 0);
    expect(r.delta).toBe(100);
    expect(r.percent).toBeNull();
  });
  it("returns null percent when previous is null", () => {
    const r = computeMoMDelta(100, null);
    expect(r.delta).toBe(100);
    expect(r.percent).toBeNull();
  });
});

describe("category presets", () => {
  it("contains key categories", () => {
    expect(DATA_USAGE_CATEGORY_PRESETS).toContain("서버");
    expect(DATA_USAGE_CATEGORY_PRESETS).toContain("이메일");
    expect(DATA_USAGE_CATEGORY_PRESETS).toContain("기타");
  });
});
