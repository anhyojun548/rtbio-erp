/**
 * assertInvariant / InventoryError 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import { InventoryError, assertInvariant } from "./invariant";

describe("assertInvariant", () => {
  it("정상 값 통과 (physical >= available >= 0)", () => {
    expect(() => assertInvariant(10, 10)).not.toThrow();
    expect(() => assertInvariant(10, 5)).not.toThrow();
    expect(() => assertInvariant(0, 0)).not.toThrow();
  });

  it("physical 음수 거부", () => {
    expect(() => assertInvariant(-1, 0)).toThrow(InventoryError);
  });

  it("available 음수 거부", () => {
    expect(() => assertInvariant(5, -1)).toThrow(InventoryError);
  });

  it("physical < available 거부", () => {
    expect(() => assertInvariant(3, 5)).toThrow(InventoryError);
    expect(() => assertInvariant(3, 5)).toThrow(/불변식 위반/);
  });

  it("에러 메시지 한국어", () => {
    try {
      assertInvariant(-5, 0);
      throw new Error("unreachable");
    } catch (e) {
      expect(e).toBeInstanceOf(InventoryError);
      if (e instanceof InventoryError) {
        expect(e.message).toContain("실재고");
      }
    }
  });

  it("InventoryError 는 name 이 올바르게 설정됨", () => {
    const e = new InventoryError("test");
    expect(e.name).toBe("InventoryError");
  });
});
