/**
 * shipment.ts Zod 스키마 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  startShipmentSchema,
  moveShipmentStageSchema,
  holdShipmentSchema,
  resumeShipmentSchema,
} from "./shipment";

describe("startShipmentSchema", () => {
  it("빈 객체 통과 (note 선택)", () => {
    expect(startShipmentSchema.safeParse({}).success).toBe(true);
  });

  it("note 500자 초과 거부", () => {
    expect(
      startShipmentSchema.safeParse({ note: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("note 공백만 → undefined", () => {
    const res = startShipmentSchema.safeParse({ note: "   " });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBeUndefined();
  });
});

describe("moveShipmentStageSchema", () => {
  it("toStageId 정상 → 통과", () => {
    const res = moveShipmentStageSchema.safeParse({ toStageId: "stage_abc" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.toStageId).toBe("stage_abc");
  });

  it("toStageId 누락 거부", () => {
    expect(moveShipmentStageSchema.safeParse({}).success).toBe(false);
  });

  it("toStageId 빈 문자열 거부", () => {
    expect(
      moveShipmentStageSchema.safeParse({ toStageId: "" }).success,
    ).toBe(false);
  });

  it("note 함께 전달 시 보존", () => {
    const res = moveShipmentStageSchema.safeParse({
      toStageId: "stage_abc",
      note: "검수 완료",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBe("검수 완료");
  });
});

describe("holdShipmentSchema", () => {
  it("정상 사유 통과", () => {
    const res = holdShipmentSchema.safeParse({ reason: "포장 불량" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.reason).toBe("포장 불량");
  });

  it("reason 누락 거부", () => {
    expect(holdShipmentSchema.safeParse({}).success).toBe(false);
  });

  it("reason 3자 미만 거부", () => {
    expect(holdShipmentSchema.safeParse({ reason: "ab" }).success).toBe(false);
  });

  it("reason 500자 초과 거부", () => {
    expect(
      holdShipmentSchema.safeParse({ reason: "r".repeat(501) }).success,
    ).toBe(false);
  });

  it("reason 앞뒤 공백 trim", () => {
    const res = holdShipmentSchema.safeParse({ reason: "  사이즈 오류  " });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.reason).toBe("사이즈 오류");
  });
});

describe("resumeShipmentSchema", () => {
  it("빈 객체 통과", () => {
    expect(resumeShipmentSchema.safeParse({}).success).toBe(true);
  });

  it("note 보존", () => {
    const res = resumeShipmentSchema.safeParse({ note: "재포장 완료" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBe("재포장 완료");
  });

  it("note 500자 초과 거부", () => {
    expect(
      resumeShipmentSchema.safeParse({ note: "x".repeat(501) }).success,
    ).toBe(false);
  });
});
