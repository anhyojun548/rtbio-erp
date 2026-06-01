import { describe, it, expect } from "vitest";
import { createOrgOptionSchema, ORG_OPTION_KINDS, ORG_OPTION_KIND_LABEL } from "./org-option";

describe("createOrgOptionSchema", () => {
  it("accepts valid", () => {
    expect(createOrgOptionSchema.safeParse({ kind: "DEPARTMENT", label: "회계팀" }).success).toBe(true);
    expect(createOrgOptionSchema.safeParse({ kind: "JOB_TITLE", label: "수석" }).success).toBe(true);
  });
  it("rejects bad kind", () => {
    expect(createOrgOptionSchema.safeParse({ kind: "TEAM", label: "x" }).success).toBe(false);
  });
  it("rejects empty / too-long label", () => {
    expect(createOrgOptionSchema.safeParse({ kind: "DEPARTMENT", label: "" }).success).toBe(false);
    expect(createOrgOptionSchema.safeParse({ kind: "DEPARTMENT", label: "x".repeat(41) }).success).toBe(false);
  });
});
describe("ORG_OPTION_KINDS", () => {
  it("has 2 kinds with labels", () => {
    expect(ORG_OPTION_KINDS).toEqual(["DEPARTMENT", "JOB_TITLE"]);
    expect(ORG_OPTION_KIND_LABEL.DEPARTMENT).toBe("부서");
    expect(ORG_OPTION_KIND_LABEL.JOB_TITLE).toBe("직급");
  });
});
