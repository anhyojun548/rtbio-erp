import { describe, it, expect } from "vitest";
import { suggestWidgets } from "./suggest";

describe("suggestWidgets", () => {
  it("'이번 달 거래처별 매출' → list_top_clients 최상위", () => {
    const r = suggestWidgets("이번 달 거래처별 매출 보여줘");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]?.key).toBe("list_top_clients");
    expect(r[0]?.source).toBe("invoice");
    expect(r[0]?.spec.title).toContain("Top 5 거래처");
  });
  it("'재고 부족 품목' → list_low_stock 포함", () => {
    const keys = suggestWidgets("재고 부족 품목").map((s) => s.key);
    expect(keys).toContain("list_low_stock");
  });
  it("'미수금 얼마야' → kpi_total_ar 최상위", () => {
    expect(suggestWidgets("미수금 얼마야")[0]?.key).toBe("kpi_total_ar");
  });
  it("'오늘 매출' → kpi_daily_sales 최상위(monthly보다 우선)", () => {
    expect(suggestWidgets("오늘 매출")[0]?.key).toBe("kpi_daily_sales");
  });
  it("'수금' → kpi_received 포함", () => {
    expect(suggestWidgets("이번 달 수금 현황").map((s) => s.key)).toContain("kpi_received");
  });
  it("매칭 0건 → 빈 배열", () => {
    expect(suggestWidgets("점심 뭐 먹지")).toEqual([]);
  });
  it("빈/공백 입력 → 빈 배열", () => {
    expect(suggestWidgets("")).toEqual([]);
    expect(suggestWidgets("   ")).toEqual([]);
  });
  it("limit 준수 (기본 3)", () => {
    expect(suggestWidgets("매출").length).toBeLessThanOrEqual(3);
  });
});
