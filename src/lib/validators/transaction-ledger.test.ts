import { describe, expect, it } from "vitest";
import { updateTransactionSchema } from "./transaction-ledger";

describe("updateTransactionSchema", () => {
  it("부분 패치 허용 (memo 만)", () => {
    expect(updateTransactionSchema.safeParse({ memo: "수정" }).success).toBe(true);
  });
  it("qty 음수 거부", () => {
    expect(updateTransactionSchema.safeParse({ qty: -1 }).success).toBe(false);
  });
  it("빈 객체 통과 (no-op patch)", () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(true);
  });
  it("kind 알 수 없는 값 거부", () => {
    expect(updateTransactionSchema.safeParse({ kind: "X" }).success).toBe(false);
  });
});
