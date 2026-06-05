import { describe, it, expect } from "vitest";
import {
  LABEL_RESOLVERS,
  getDisplayColumns,
  getValueByPath,
  normalizeGroupBy,
} from "./display";

describe("LABEL_RESOLVERS", () => {
  it("clientId → client.name 해석 메타", () => {
    expect(LABEL_RESOLVERS.clientId).toEqual({ model: "client", labelField: "name" });
  });
});

describe("normalizeGroupBy (LLM 별칭 보정)", () => {
  it("scalarFields 미제공(레거시): clientName / client.name / client → clientId", () => {
    expect(normalizeGroupBy(["clientName"])).toEqual(["clientId"]);
    expect(normalizeGroupBy(["client.name"])).toEqual(["clientId"]);
    expect(normalizeGroupBy(["client"])).toEqual(["clientId"]);
  });
  it("scalarFields 미제공(레거시): productName / product.name → productId", () => {
    expect(normalizeGroupBy(["productName"])).toEqual(["productId"]);
    expect(normalizeGroupBy(["product.name"])).toEqual(["productId"]);
  });
  it("이미 FK(clientId) 거나 일반 필드(status)는 그대로", () => {
    expect(normalizeGroupBy(["clientId"])).toEqual(["clientId"]);
    expect(normalizeGroupBy(["status"])).toEqual(["status"]);
  });
  it("대소문자 무시", () => {
    expect(normalizeGroupBy(["ClientName"])).toEqual(["clientId"]);
  });
  it("소스 인지: 실제 clientName 스칼라 보유 소스(transaction)는 보정하지 않음", () => {
    const tx = new Set(["clientName", "clientCode", "totalAmount"]);
    expect(normalizeGroupBy(["clientName"], tx)).toEqual(["clientName"]);
  });
  it("소스 인지: clientId FK 보유 소스(invoice)는 clientName/client.name → clientId", () => {
    const inv = new Set(["clientId", "totalAmount", "issueDate"]);
    expect(normalizeGroupBy(["clientName"], inv)).toEqual(["clientId"]);
    expect(normalizeGroupBy(["client.name"], inv)).toEqual(["clientId"]);
  });
  it("소스 인지: 별칭도 FK도 스칼라에 없으면 원본 유지(Prisma 가 명확히 에러내도록)", () => {
    const tx = new Set(["clientName", "totalAmount"]); // clientId 없음
    expect(normalizeGroupBy(["client.name"], tx)).toEqual(["client.name"]);
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
