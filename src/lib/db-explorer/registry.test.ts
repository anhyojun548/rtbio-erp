import { describe, it, expect } from "vitest";
import { DB_TABLES, getTableDef, EDITABLE_KEYS } from "./registry";

describe("DB_TABLES registry", () => {
  it("has ~20 tables, all with pkField", () => {
    expect(DB_TABLES.length).toBeGreaterThanOrEqual(18);
    DB_TABLES.forEach((t) => {
      expect(t.pkField).toBeTruthy();
      expect(t.model).toBeTruthy();
    });
  });
  it("getTableDef looks up by key, undefined for unknown", () => {
    expect(getTableDef("order")?.label).toBeTruthy();
    expect(getTableDef("__nope__")).toBeUndefined();
  });
  it("User table excludes password via sensitiveFields", () => {
    expect(getTableDef("user")?.sensitiveFields).toContain("password");
    expect(getTableDef("user")?.tenantScoped).toBe(true);
  });
  it("only the 4 config tables are editable, each with editableFields", () => {
    const editable = DB_TABLES.filter((t) => t.editable)
      .map((t) => t.key)
      .sort();
    expect(editable).toEqual(["kanbanColumn", "notice", "orgOption", "tenantSetting"].sort());
    DB_TABLES.filter((t) => t.editable).forEach((t) => {
      expect(Object.keys(t.editableFields ?? {}).length).toBeGreaterThan(0);
    });
  });
  it("TenantSetting pk is key (not id)", () => {
    expect(getTableDef("tenantSetting")?.pkField).toBe("key");
  });
  it("non-editable tables have no editableFields", () => {
    DB_TABLES.filter((t) => !t.editable).forEach((t) => expect(t.editableFields).toBeUndefined());
  });
  it("EDITABLE_KEYS mirrors the editable table keys", () => {
    expect([...EDITABLE_KEYS].sort()).toEqual(
      DB_TABLES.filter((t) => t.editable)
        .map((t) => t.key)
        .sort(),
    );
  });
});
