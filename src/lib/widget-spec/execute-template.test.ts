import { describe, it, expect } from "vitest";
import { resolveTemplate } from "./execute";

/** 템플릿 토큰 해석 — 특히 주(week) 관련 신규 토큰 회귀 */
describe("resolveTemplate — week 토큰", () => {
  // 2026-06-05 은 금요일 (그 주 월요일 = 2026-06-01)
  const now = new Date(2026, 5, 5, 14, 30, 0);

  it("{{now.startOfWeek}} → 그 주 월요일 00:00", () => {
    const r = resolveTemplate("{{now.startOfWeek}}", now) as Date;
    expect(r instanceof Date).toBe(true);
    expect(r.getDay()).toBe(1); // 월요일
    expect(r.getHours()).toBe(0);
    expect(r.getMinutes()).toBe(0);
    expect(r.getSeconds()).toBe(0);
    // now 이전이고 7일 이내
    expect(r.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(now.getTime() - r.getTime()).toBeLessThan(7 * 86_400_000);
  });

  it("{{now.endOfWeek}} → 그 주 일요일 23:59:59.999", () => {
    const r = resolveTemplate("{{now.endOfWeek}}", now) as Date;
    expect(r.getDay()).toBe(0); // 일요일
    expect(r.getHours()).toBe(23);
    expect(r.getMinutes()).toBe(59);
    expect(r.getSeconds()).toBe(59);
  });

  it("일요일 입력도 같은 주 월요일을 반환 (경계)", () => {
    const sun = new Date(2026, 5, 7, 9, 0, 0); // 2026-06-07 (일)
    const r = resolveTemplate("{{now.startOfWeek}}", sun) as Date;
    expect(r.getDay()).toBe(1);
    expect(r.getDate()).toBe(1); // 2026-06-01
  });

  it("체이닝: {{now.startOfWeek.plus(7,'day')}} → 다음 주 월요일", () => {
    const r = resolveTemplate("{{now.startOfWeek.plus(7,'day')}}", now) as Date;
    expect(r.getDay()).toBe(1);
    expect(r.getDate()).toBe(8); // 2026-06-08
  });

  it("기존 토큰 회귀: startOfMonth / today / thisMonth", () => {
    const m = resolveTemplate("{{now.startOfMonth}}", now) as Date;
    expect(m.getDate()).toBe(1);
    expect(m.getMonth()).toBe(5);
    expect(resolveTemplate("{{today}}", now)).toBe("2026-06-05");
    expect(resolveTemplate("{{thisMonth}}", now)).toBe("2026-06");
  });
});
