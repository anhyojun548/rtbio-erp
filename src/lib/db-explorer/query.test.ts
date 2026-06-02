import { describe, it, expect } from "vitest";
import { getScalarColumns } from "./query";

describe("getScalarColumns (DMMF)", () => {
  it("returns scalar fields for a model, excludes sensitive + relations", () => {
    const cols = getScalarColumns("user", ["password"]);
    const names = cols.map((c) => c.name);
    expect(names).toContain("email");
    expect(names).toContain("role"); // ★ enum 컬럼 포함되어야 함 (가장 중요한 컬럼)
    expect(names).not.toContain("password"); // 민감 제외
    expect(names).not.toContain("tenant"); // relation 제외
  });
  it("includes enum columns (status/type) — not just String scalars", () => {
    expect(getScalarColumns("order", []).map((c) => c.name)).toContain("status");
    expect(getScalarColumns("client", []).map((c) => c.name)).toContain("type");
  });
  it("empty for unknown model", () => {
    expect(getScalarColumns("__nope__", [])).toEqual([]);
  });
});
