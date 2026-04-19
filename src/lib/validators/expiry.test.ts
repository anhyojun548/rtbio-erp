/**
 * expiry.ts Zod 스키마 + classifyExpiry 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  createExpiryLotSchema,
  updateExpiryLotSchema,
  classifyExpiry,
} from "./expiry";

const CUID = "clabc123def456ghi789jkl0";

describe("createExpiryLotSchema", () => {
  it("정상 입력 통과", () => {
    const res = createExpiryLotSchema.safeParse({
      productSizeId: CUID,
      lotNumber: "LOT-2026-001",
      expiryDate: "2027-04-15",
      quantity: 100,
    });
    expect(res.success).toBe(true);
  });

  it("quantity 0 거부", () => {
    expect(
      createExpiryLotSchema.safeParse({
        productSizeId: CUID,
        lotNumber: "L1",
        expiryDate: "2027-04-15",
        quantity: 0,
      }).success,
    ).toBe(false);
  });

  it("quantity 음수 거부", () => {
    expect(
      createExpiryLotSchema.safeParse({
        productSizeId: CUID,
        lotNumber: "L1",
        expiryDate: "2027-04-15",
        quantity: -1,
      }).success,
    ).toBe(false);
  });

  it("quantity 소수점 거부", () => {
    expect(
      createExpiryLotSchema.safeParse({
        productSizeId: CUID,
        lotNumber: "L1",
        expiryDate: "2027-04-15",
        quantity: 1.5,
      }).success,
    ).toBe(false);
  });

  it("lotNumber 공백 거부", () => {
    expect(
      createExpiryLotSchema.safeParse({
        productSizeId: CUID,
        lotNumber: "   ",
        expiryDate: "2027-04-15",
        quantity: 10,
      }).success,
    ).toBe(false);
  });

  it("note 공백만 입력 시 undefined 로 정규화", () => {
    const res = createExpiryLotSchema.safeParse({
      productSizeId: CUID,
      lotNumber: "L1",
      expiryDate: "2027-04-15",
      quantity: 10,
      note: "   ",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBeUndefined();
  });

  it("과거 일자도 허용 (이미 만료된 로트 수기 등록)", () => {
    const res = createExpiryLotSchema.safeParse({
      productSizeId: CUID,
      lotNumber: "L-OLD",
      expiryDate: "2020-01-01",
      quantity: 5,
    });
    expect(res.success).toBe(true);
  });
});

describe("updateExpiryLotSchema", () => {
  it("빈 객체도 허용 (부분 업데이트)", () => {
    const res = updateExpiryLotSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it("remainingQty 0 허용 (모두 소진)", () => {
    const res = updateExpiryLotSchema.safeParse({ remainingQty: 0 });
    expect(res.success).toBe(true);
  });

  it("remainingQty 음수 거부", () => {
    expect(
      updateExpiryLotSchema.safeParse({ remainingQty: -1 }).success,
    ).toBe(false);
  });
});

describe("classifyExpiry", () => {
  const NOW = new Date("2026-04-15T00:00:00Z");

  it("이미 지난 일자 → EXPIRED", () => {
    const r = classifyExpiry(new Date("2026-04-01T00:00:00Z"), NOW);
    expect(r.stage).toBe("EXPIRED");
    expect(r.daysLeft).toBeLessThan(0);
  });

  it("30일 이내 → URGENT", () => {
    const r = classifyExpiry(new Date("2026-05-10T00:00:00Z"), NOW);
    expect(r.stage).toBe("URGENT");
  });

  it("30일 경계 → URGENT", () => {
    const r = classifyExpiry(new Date("2026-05-15T00:00:00Z"), NOW);
    expect(r.stage).toBe("URGENT");
    expect(r.daysLeft).toBe(30);
  });

  it("90일 이내 → SOON", () => {
    const r = classifyExpiry(new Date("2026-07-01T00:00:00Z"), NOW);
    expect(r.stage).toBe("SOON");
  });

  it("90일 초과 → SAFE", () => {
    const r = classifyExpiry(new Date("2026-12-31T00:00:00Z"), NOW);
    expect(r.stage).toBe("SAFE");
  });

  it("오늘 자정 → URGENT (daysLeft=0)", () => {
    const r = classifyExpiry(NOW, NOW);
    expect(r.stage).toBe("URGENT");
    expect(r.daysLeft).toBe(0);
  });
});
