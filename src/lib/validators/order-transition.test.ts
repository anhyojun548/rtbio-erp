/**
 * order-transition.ts Zod 스키마 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  orderSubmitSchema,
  orderRejectSchema,
  orderHoldSchema,
  orderResumeSchema,
  orderCancelSchema,
  orderConfirmSchema,
} from "./order-transition";

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

describe("orderRejectSchema", () => {
  it("정상 사유 통과", () => {
    const res = orderRejectSchema.safeParse({ reason: "재고 부족" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.reason).toBe("재고 부족");
  });

  it("reason 누락 거부", () => {
    expect(orderRejectSchema.safeParse({}).success).toBe(false);
  });

  it("reason 빈 문자열 거부", () => {
    expect(orderRejectSchema.safeParse({ reason: "" }).success).toBe(false);
  });

  it("reason 공백만 → trim 후 빈 문자열, 최소 길이 실패", () => {
    expect(orderRejectSchema.safeParse({ reason: "   " }).success).toBe(false);
  });

  it("reason 3자 미만 거부", () => {
    expect(orderRejectSchema.safeParse({ reason: "ab" }).success).toBe(false);
  });

  it("reason 500자 초과 거부", () => {
    expect(
      orderRejectSchema.safeParse({ reason: "r".repeat(501) }).success,
    ).toBe(false);
  });

  it("reason 전후 공백 trim", () => {
    const res = orderRejectSchema.safeParse({ reason: "  불량 확인  " });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.reason).toBe("불량 확인");
  });
});

describe("orderHoldSchema", () => {
  it("정상 사유 통과", () => {
    const res = orderHoldSchema.safeParse({ reason: "거래처 확인 필요" });
    expect(res.success).toBe(true);
  });

  it("reason 누락 거부", () => {
    expect(orderHoldSchema.safeParse({}).success).toBe(false);
  });

  it("reason 3자 미만 거부", () => {
    expect(orderHoldSchema.safeParse({ reason: "왜" }).success).toBe(false);
  });
});

describe("orderResumeSchema", () => {
  it("빈 객체 통과", () => {
    expect(orderResumeSchema.safeParse({}).success).toBe(true);
  });

  it("note 보존", () => {
    const res = orderResumeSchema.safeParse({ note: "재고 확보됨" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBe("재고 확보됨");
  });

  it("note 500자 초과 거부", () => {
    expect(
      orderResumeSchema.safeParse({ note: "n".repeat(501) }).success,
    ).toBe(false);
  });
});

describe("orderCancelSchema", () => {
  it("정상 사유 통과", () => {
    const res = orderCancelSchema.safeParse({ reason: "거래처 요청" });
    expect(res.success).toBe(true);
  });

  it("reason 누락 거부", () => {
    expect(orderCancelSchema.safeParse({}).success).toBe(false);
  });

  it("reason 3자 미만 거부", () => {
    expect(orderCancelSchema.safeParse({ reason: "ab" }).success).toBe(false);
  });
});

describe("orderConfirmSchema", () => {
  it("빈 객체 통과 (note 선택)", () => {
    expect(orderConfirmSchema.safeParse({}).success).toBe(true);
  });

  it("note 제공 시 보존", () => {
    const res = orderConfirmSchema.safeParse({ note: "재고 확보 확인" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBe("재고 확보 확인");
  });

  it("note 500자 초과 거부", () => {
    expect(
      orderConfirmSchema.safeParse({ note: "n".repeat(501) }).success,
    ).toBe(false);
  });
});
