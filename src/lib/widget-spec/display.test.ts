import { describe, it, expect } from "vitest";
import { LABEL_RESOLVERS, getDisplayColumns, getValueByPath } from "./display";

describe("LABEL_RESOLVERS", () => {
  it("clientId → client.name 해석 메타", () => {
    expect(LABEL_RESOLVERS.clientId).toEqual({ model: "client", labelField: "name" });
  });
});
describe("getDisplayColumns", () => {
  it("정의된 소스는 컬럼 배열", () => {
    const cols = getDisplayColumns("order");
    expect(cols && cols.length).toBeGreaterThan(0);
    expect(cols![0]).toHaveProperty("field");
    expect(cols![0]).toHaveProperty("label");
  });
  it("미정의 소스는 null", () => { expect(getDisplayColumns("dataUsage")).toBeNull(); });
});
describe("getValueByPath", () => {
  it("dot 경로 해석", () => {
    expect(getValueByPath({ client: { name: "메디칼" } }, "client.name")).toBe("메디칼");
    expect(getValueByPath({ status: "ISSUED" }, "status")).toBe("ISSUED");
    expect(getValueByPath({}, "client.name")).toBeUndefined();
  });
});
