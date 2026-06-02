import { describe, it, expect } from "vitest";
import {
  createUserSchema, updateUserSchema, resetPasswordSchema, changePasswordSchema,
} from "./user";

describe("createUserSchema", () => {
  it("accepts valid input", () => {
    const r = createUserSchema.safeParse({
      name: "홍길동", email: "hong@rtbio.com", role: "QC",
      phone: "010-1234-5678", tempPassword: "altibio123!",
    });
    expect(r.success).toBe(true);
  });
  it("rejects short password", () => {
    const r = createUserSchema.safeParse({
      name: "홍길동", email: "hong@rtbio.com", role: "QC", tempPassword: "short",
    });
    expect(r.success).toBe(false);
  });
  it("rejects bad email", () => {
    const r = createUserSchema.safeParse({
      name: "홍길동", email: "not-email", role: "QC", tempPassword: "altibio123!",
    });
    expect(r.success).toBe(false);
  });
  it("rejects non-staff role at schema level (CLIENT)", () => {
    const r = createUserSchema.safeParse({
      name: "x", email: "x@rtbio.com", role: "CLIENT", tempPassword: "altibio123!",
    });
    expect(r.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("requires current and next ≥ 8", () => {
    expect(changePasswordSchema.safeParse({ current: "old12345", next: "new12345" }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ current: "old12345", next: "short" }).success).toBe(false);
  });
});
