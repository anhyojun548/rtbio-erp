/**
 * sales-history.ts 유틸 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  salesHistoryQuerySchema,
  dateRangeToWindow,
  parseYmd,
  defaultRange,
} from "./sales-history";

const CUID = "clabc123def456ghi789jkl0";

describe("salesHistoryQuerySchema", () => {
  it("정상 입력 통과", () => {
    const res = salesHistoryQuerySchema.safeParse({
      salesRepId: CUID,
      from: "2026-04-01",
      to: "2026-04-30",
    });
    expect(res.success).toBe(true);
  });

  it("from = to 같은 날 허용", () => {
    const res = salesHistoryQuerySchema.safeParse({
      salesRepId: CUID,
      from: "2026-04-10",
      to: "2026-04-10",
    });
    expect(res.success).toBe(true);
  });

  it("from > to 거부", () => {
    const res = salesHistoryQuerySchema.safeParse({
      salesRepId: CUID,
      from: "2026-04-30",
      to: "2026-04-01",
    });
    expect(res.success).toBe(false);
  });

  it("cuid 아닌 salesRepId 거부", () => {
    const res = salesHistoryQuerySchema.safeParse({
      salesRepId: "not-a-cuid",
      from: "2026-04-01",
      to: "2026-04-30",
    });
    expect(res.success).toBe(false);
  });
});

describe("dateRangeToWindow", () => {
  it("[from 00:00, to+1day 00:00) 반열림 구간 반환", () => {
    const from = new Date("2026-04-01T15:30:00");
    const to = new Date("2026-04-30T08:00:00");
    const { start, end } = dateRangeToWindow(from, to);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(3); // April
    expect(end.getHours()).toBe(0);
    expect(end.getDate()).toBe(1); // May 1
    expect(end.getMonth()).toBe(4);
  });

  it("같은 날 from==to 는 하루 창 (start, next-day-start)", () => {
    const same = new Date("2026-04-15T12:00:00");
    const { start, end } = dateRangeToWindow(same, same);
    expect(start.getDate()).toBe(15);
    expect(end.getDate()).toBe(16);
  });

  it("월 경계에서도 올바르게 넘어감", () => {
    const from = new Date("2026-04-30");
    const to = new Date("2026-04-30");
    const { start, end } = dateRangeToWindow(from, to);
    expect(start.getMonth()).toBe(3);
    expect(start.getDate()).toBe(30);
    expect(end.getMonth()).toBe(4); // May
    expect(end.getDate()).toBe(1);
  });
});

describe("parseYmd", () => {
  it("YYYY-MM-DD 파싱", () => {
    const d = parseYmd("2026-04-15");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(3);
    expect(d?.getDate()).toBe(15);
  });

  it("잘못된 포맷 null", () => {
    expect(parseYmd("2026/04/15")).toBeNull();
    expect(parseYmd("26-4-15")).toBeNull();
    expect(parseYmd("")).toBeNull();
  });
});

describe("defaultRange", () => {
  it("이번 달 1일 ~ 오늘", () => {
    const now = new Date("2026-04-15T10:00:00");
    const { from, to } = defaultRange(now);
    expect(from).toBe("2026-04-01");
    expect(to).toBe("2026-04-15");
  });

  it("월초에도 동일일 반환", () => {
    const now = new Date("2026-05-01T10:00:00");
    const { from, to } = defaultRange(now);
    expect(from).toBe("2026-05-01");
    expect(to).toBe("2026-05-01");
  });
});
