/**
 * order-transition.ts Zod 스키마 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import { orderSubmitSchema } from "./order-transition";

describe("orderSubmitSchema", () => {
  it("빈 객체 통과 (note 선택)", () => {
    expect(orderSubmitSchema.safeParse({}).success).toBe(true);
  });

  it("note 제공 시 그대로 보존", () => {
    const res = orderSubmitSchema.safeParse({ note: "긴급 제출" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBe("긴급 제출");
  });

  it("note 빈 문자열 → undefined", () => {
    const res = orderSubmitSchema.safeParse({ note: "" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBeUndefined();
  });

  it("note 500자 초과 거부", () => {
    const res = orderSubmitSchema.safeParse({ note: "n".repeat(501) });
    expect(res.success).toBe(false);
  });

  it("note 공백만 → undefined (trim 후 빈 문자열)", () => {
    const res = orderSubmitSchema.safeParse({ note: "   " });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBeUndefined();
  });
});
