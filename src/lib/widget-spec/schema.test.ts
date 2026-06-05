import { describe, it, expect } from "vitest";
import { validateWidgetSpec } from "./schema";

// LLM(빌더)이 자주 보내는 형태를 관대하게 받아들이는지 검증.
// (2026-06-05: 빌더가 format.legend=true(boolean), permissions={rowLevel} 만 보내 400 나던 것 수정)
const baseBar = {
  version: "1.0",
  title: "이번 달 거래처별 매출",
  kind: "bar",
  data: {
    source: "invoice",
    aggregate: { type: "sum", field: "totalAmount" },
    groupBy: ["client.name"],
  },
};

describe("widgetSpec 관대화 (LLM-friendly)", () => {
  it("format.legend = true(boolean) → 통과 (문자열로 coerce)", () => {
    const v = validateWidgetSpec({ ...baseBar, format: { legend: true } });
    expect(v.ok).toBe(true);
    if (v.ok) expect(["top", "right", "bottom", "none"]).toContain(v.spec.format?.legend);
  });

  it("format.legend = false → 'none'", () => {
    const v = validateWidgetSpec({ ...baseBar, format: { legend: false } });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.spec.format?.legend).toBe("none");
  });

  it("format.legend = 'top'(정상 문자열) → 그대로 통과", () => {
    const v = validateWidgetSpec({ ...baseBar, format: { legend: "top" } });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.spec.format?.legend).toBe("top");
  });

  it("permissions.roles 누락 → 통과 (선택적)", () => {
    const v = validateWidgetSpec({ ...baseBar, permissions: { rowLevel: "none" } });
    expect(v.ok).toBe(true);
  });

  it("빌더가 실제 보낸 형태(legend true + permissions roles 누락) → 통과", () => {
    const v = validateWidgetSpec({
      ...baseBar,
      format: { value: { type: "currency" }, legend: true },
      permissions: { rowLevel: "none" },
    });
    expect(v.ok).toBe(true);
  });
});
