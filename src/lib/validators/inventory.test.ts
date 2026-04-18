/**
 * inventory.ts Zod 스키마 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import { receiveSchema, adjustmentSchema } from "./inventory";

describe("receiveSchema", () => {
  it("최소 필드로 통과", () => {
    const res = receiveSchema.safeParse({
      productSizeId: "size-1",
      qty: 10,
    });
    expect(res.success).toBe(true);
  });

  it("qty 문자열 입력을 숫자로 변환", () => {
    const res = receiveSchema.safeParse({
      productSizeId: "size-1",
      qty: "25",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.qty).toBe(25);
  });

  it("qty 0 거부", () => {
    const res = receiveSchema.safeParse({
      productSizeId: "size-1",
      qty: 0,
    });
    expect(res.success).toBe(false);
  });

  it("qty 음수 거부", () => {
    const res = receiveSchema.safeParse({
      productSizeId: "size-1",
      qty: -3,
    });
    expect(res.success).toBe(false);
  });

  it("qty 소수점 거부", () => {
    const res = receiveSchema.safeParse({
      productSizeId: "size-1",
      qty: 1.5,
    });
    expect(res.success).toBe(false);
  });

  it("productSizeId 빈 문자열 거부", () => {
    const res = receiveSchema.safeParse({
      productSizeId: "",
      qty: 10,
    });
    expect(res.success).toBe(false);
  });

  it("note 빈 문자열은 undefined 로 정규화", () => {
    const res = receiveSchema.safeParse({
      productSizeId: "size-1",
      qty: 10,
      note: "",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBeUndefined();
  });
});

describe("adjustmentSchema", () => {
  it("실사조정 양수 허용", () => {
    const res = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: 5,
      reason: "실사조정",
    });
    expect(res.success).toBe(true);
  });

  it("실사조정 음수 허용", () => {
    const res = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: -2,
      reason: "실사조정",
    });
    expect(res.success).toBe(true);
  });

  it("qty 0 거부", () => {
    const res = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: 0,
      reason: "실사조정",
    });
    expect(res.success).toBe(false);
  });

  it("반품은 양수만 허용", () => {
    const neg = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: -3,
      reason: "반품",
    });
    expect(neg.success).toBe(false);

    const pos = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: 3,
      reason: "반품",
    });
    expect(pos.success).toBe(true);
  });

  it("입고보정은 양수만 허용", () => {
    const neg = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: -1,
      reason: "입고보정",
    });
    expect(neg.success).toBe(false);

    const pos = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: 1,
      reason: "입고보정",
    });
    expect(pos.success).toBe(true);
  });

  it("폐기는 음수만 허용", () => {
    const pos = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: 3,
      reason: "폐기",
    });
    expect(pos.success).toBe(false);

    const neg = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: -3,
      reason: "폐기",
    });
    expect(neg.success).toBe(true);
  });

  it("알 수 없는 reason 거부", () => {
    const res = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: 1,
      reason: "기타사유",
    });
    expect(res.success).toBe(false);
  });

  it("approvedBy 빈 문자열은 undefined 로 정규화", () => {
    const res = adjustmentSchema.safeParse({
      productSizeId: "size-1",
      qty: 1,
      reason: "실사조정",
      approvedBy: "",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.approvedBy).toBeUndefined();
  });
});
