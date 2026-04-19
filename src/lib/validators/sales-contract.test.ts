/**
 * sales-contract.ts Zod 스키마 + classifyContract 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  createContractSchema,
  updateContractSchema,
  classifyContract,
} from "./sales-contract";

const CUID = "clabc123def456ghi789jkl0";

describe("createContractSchema", () => {
  it("정상 입력 통과", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "2026년 연간 공급 계약",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      pdfUrl: "https://example.com/contract.pdf",
      signed: true,
      note: "연간 자동 갱신",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.signed).toBe(true);
      expect(res.data.pdfUrl).toBe("https://example.com/contract.pdf");
    }
  });

  it("endDate 없이도 통과 (무기한)", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "무기한 계약",
      startDate: "2026-04-01",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.signed).toBe(false);
  });

  it("endDate < startDate 거부", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "잘못된 기간",
      startDate: "2026-04-01",
      endDate: "2026-03-01",
    });
    expect(res.success).toBe(false);
  });

  it("title 공백 거부", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "   ",
      startDate: "2026-04-01",
    });
    expect(res.success).toBe(false);
  });

  it("title 200자 초과 거부", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "A".repeat(201),
      startDate: "2026-04-01",
    });
    expect(res.success).toBe(false);
  });

  it("pdfUrl http/https 아닌 값 거부", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "계약",
      startDate: "2026-04-01",
      pdfUrl: "ftp://example.com/c.pdf",
    });
    expect(res.success).toBe(false);
  });

  it("pdfUrl 빈 문자열 → undefined 로 정규화", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "계약",
      startDate: "2026-04-01",
      pdfUrl: "",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.pdfUrl).toBeUndefined();
  });

  it("note 1000자 초과 거부", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "계약",
      startDate: "2026-04-01",
      note: "A".repeat(1001),
    });
    expect(res.success).toBe(false);
  });

  it("note 공백만 입력 시 undefined 로 정규화", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "계약",
      startDate: "2026-04-01",
      note: "   ",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBeUndefined();
  });

  it("잘못된 날짜 문자열 거부", () => {
    const res = createContractSchema.safeParse({
      clientId: CUID,
      title: "계약",
      startDate: "not-a-date",
    });
    expect(res.success).toBe(false);
  });
});

describe("updateContractSchema", () => {
  it("id 만 있는 부분 업데이트 허용", () => {
    const res = updateContractSchema.safeParse({ id: CUID });
    expect(res.success).toBe(true);
  });

  it("signed 토글만 허용", () => {
    const res = updateContractSchema.safeParse({ id: CUID, signed: true });
    expect(res.success).toBe(true);
  });

  it("endDate nullable (null 명시로 무기한 전환)", () => {
    const res = updateContractSchema.safeParse({ id: CUID, endDate: null });
    expect(res.success).toBe(true);
  });

  it("note nullable (null 로 삭제)", () => {
    const res = updateContractSchema.safeParse({ id: CUID, note: null });
    expect(res.success).toBe(true);
  });

  it("startDate+endDate 둘 다 있을 때 순서 검증", () => {
    const res = updateContractSchema.safeParse({
      id: CUID,
      startDate: "2026-06-01",
      endDate: "2026-05-01",
    });
    expect(res.success).toBe(false);
  });

  it("startDate 만 변경은 endDate 와 비교 안 함 (DB 값 모름)", () => {
    const res = updateContractSchema.safeParse({
      id: CUID,
      startDate: "2026-06-01",
    });
    expect(res.success).toBe(true);
  });
});

describe("classifyContract", () => {
  const NOW = new Date("2026-04-15T00:00:00");

  it("오늘 시작, 1년 후 종료 → ACTIVE (daysLeft > 30)", () => {
    const r = classifyContract(
      new Date("2026-04-15"),
      new Date("2027-04-15"),
      NOW,
    );
    expect(r.status).toBe("ACTIVE");
    expect(r.daysLeft).toBeGreaterThan(30);
  });

  it("endDate 어제 → EXPIRED (daysLeft < 0)", () => {
    const r = classifyContract(
      new Date("2026-01-01"),
      new Date("2026-04-14"),
      NOW,
    );
    expect(r.status).toBe("EXPIRED");
    expect(r.daysLeft).toBeLessThan(0);
  });

  it("오늘 종료 → ENDING_SOON (daysLeft = 0)", () => {
    const r = classifyContract(
      new Date("2026-01-01"),
      new Date("2026-04-15"),
      NOW,
    );
    expect(r.status).toBe("ENDING_SOON");
    expect(r.daysLeft).toBe(0);
  });

  it("30일 뒤 종료 → ENDING_SOON (daysLeft = 30, 경계)", () => {
    const r = classifyContract(
      new Date("2026-01-01"),
      new Date("2026-05-15"),
      NOW,
    );
    expect(r.status).toBe("ENDING_SOON");
    expect(r.daysLeft).toBe(30);
  });

  it("31일 뒤 종료 → ACTIVE (daysLeft = 31, 경계 초과)", () => {
    const r = classifyContract(
      new Date("2026-01-01"),
      new Date("2026-05-16"),
      NOW,
    );
    expect(r.status).toBe("ACTIVE");
    expect(r.daysLeft).toBe(31);
  });

  it("endDate 없음 + 과거 시작 → ACTIVE (무기한)", () => {
    const r = classifyContract(new Date("2026-01-01"), null, NOW);
    expect(r.status).toBe("ACTIVE");
    expect(r.daysLeft).toBeNull();
  });

  it("미래 시작일 → FUTURE (daysUntilStart > 0)", () => {
    const r = classifyContract(
      new Date("2026-05-01"),
      new Date("2027-05-01"),
      NOW,
    );
    expect(r.status).toBe("FUTURE");
    expect(r.daysUntilStart).toBeGreaterThan(0);
    expect(r.daysLeft).toBeNull();
  });

  it("오늘 시작 → FUTURE 아님 (daysUntilStart = 0)", () => {
    const r = classifyContract(new Date("2026-04-15"), null, NOW);
    expect(r.status).toBe("ACTIVE");
    expect(r.daysUntilStart).toBe(0);
  });

  it("endDate null + 미래 시작 → FUTURE", () => {
    const r = classifyContract(new Date("2026-05-01"), null, NOW);
    expect(r.status).toBe("FUTURE");
  });
});
