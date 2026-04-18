/**
 * ledger.ts Zod 스키마 + 월 유틸 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  recomputeLedgerSchema,
  recomputeLedgerMonthSchema,
  closeMonthSchema,
  reopenMonthSchema,
  monthToRange,
  prevMonth,
} from "./ledger";

const CUID = "clabc123def456ghi789jkl0";

describe("recomputeLedgerSchema", () => {
  it("정상 입력 통과", () => {
    const res = recomputeLedgerSchema.safeParse({
      clientId: CUID,
      closingMonth: "2026-04",
    });
    expect(res.success).toBe(true);
  });

  it("closingMonth 포맷 오류 거부", () => {
    expect(
      recomputeLedgerSchema.safeParse({
        clientId: CUID,
        closingMonth: "2026-4",
      }).success,
    ).toBe(false);
  });

  it("월 13 거부", () => {
    expect(
      recomputeLedgerSchema.safeParse({
        clientId: CUID,
        closingMonth: "2026-13",
      }).success,
    ).toBe(false);
  });

  it("월 00 거부", () => {
    expect(
      recomputeLedgerSchema.safeParse({
        clientId: CUID,
        closingMonth: "2026-00",
      }).success,
    ).toBe(false);
  });
});

describe("recomputeLedgerMonthSchema", () => {
  it("YYYY-MM 통과", () => {
    expect(
      recomputeLedgerMonthSchema.safeParse({ closingMonth: "2026-12" }).success,
    ).toBe(true);
  });
});

describe("closeMonthSchema", () => {
  it("note 선택", () => {
    const res = closeMonthSchema.safeParse({
      clientId: CUID,
      closingMonth: "2026-04",
    });
    expect(res.success).toBe(true);
  });

  it("note 공백 → undefined", () => {
    const res = closeMonthSchema.safeParse({
      clientId: CUID,
      closingMonth: "2026-04",
      note: "   ",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBeUndefined();
  });
});

describe("reopenMonthSchema", () => {
  it("reason 필수", () => {
    expect(
      reopenMonthSchema.safeParse({
        clientId: CUID,
        closingMonth: "2026-04",
      }).success,
    ).toBe(false);
  });

  it("reason 3자 미만 거부", () => {
    expect(
      reopenMonthSchema.safeParse({
        clientId: CUID,
        closingMonth: "2026-04",
        reason: "ab",
      }).success,
    ).toBe(false);
  });

  it("정상 reason 통과", () => {
    expect(
      reopenMonthSchema.safeParse({
        clientId: CUID,
        closingMonth: "2026-04",
        reason: "정정 필요",
      }).success,
    ).toBe(true);
  });
});

describe("monthToRange", () => {
  it("2026-04 → 4/1 00:00 ~ 5/1 00:00", () => {
    const { start, end } = monthToRange("2026-04");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3); // April = 3
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(4); // May = 4
    expect(end.getDate()).toBe(1);
  });

  it("2026-12 → 12/1 00:00 ~ 다음해 1/1 00:00", () => {
    const { start, end } = monthToRange("2026-12");
    expect(start.getMonth()).toBe(11);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(0);
  });
});

describe("prevMonth", () => {
  it("2026-04 → 2026-03", () => {
    expect(prevMonth("2026-04")).toBe("2026-03");
  });

  it("2026-01 → 2025-12 (연도 경계)", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
  });

  it("2026-10 → 2026-09 (자릿수 유지)", () => {
    expect(prevMonth("2026-10")).toBe("2026-09");
  });
});
