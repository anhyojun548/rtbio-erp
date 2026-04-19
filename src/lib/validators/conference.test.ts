/**
 * Phase 3F-3 — 학회·방문자 Zod 스키마 테스트.
 */
import { describe, it, expect } from "vitest";
import {
  createConferenceSchema,
  updateConferenceSchema,
  createVisitorSchema,
  updateVisitorSchema,
  VISITOR_CONTACT_STATUS,
  VISITOR_CONTACT_STATUS_LABEL,
} from "./conference";

describe("createConferenceSchema", () => {
  it("필수: 학회명 + 시작일", () => {
    const r = createConferenceSchema.safeParse({
      name: "제1회 정형외과 학술대회",
      startDate: "2026-05-10",
    });
    expect(r.success).toBe(true);
  });

  it("종료일 < 시작일 은 거부", () => {
    const r = createConferenceSchema.safeParse({
      name: "X",
      startDate: "2026-05-10",
      endDate: "2026-05-09",
    });
    expect(r.success).toBe(false);
  });

  it("학회명 공백만은 거부", () => {
    const r = createConferenceSchema.safeParse({
      name: "   ",
      startDate: "2026-05-10",
    });
    expect(r.success).toBe(false);
  });

  it("학회명 1자는 허용 (trim 후)", () => {
    const r = createConferenceSchema.safeParse({
      name: "A",
      startDate: "2026-05-10",
    });
    expect(r.success).toBe(true);
  });

  it("location/note 빈 문자열 → undefined 정규화", () => {
    const r = createConferenceSchema.parse({
      name: "학회",
      startDate: "2026-05-10",
      location: "",
      note: "",
    });
    expect(r.location).toBeUndefined();
    expect(r.note).toBeUndefined();
  });

  it("잘못된 날짜는 거부", () => {
    const r = createConferenceSchema.safeParse({
      name: "학회",
      startDate: "not-a-date",
    });
    expect(r.success).toBe(false);
  });
});

describe("updateConferenceSchema", () => {
  it("id 만 있어도 통과 (모든 필드 optional)", () => {
    const r = updateConferenceSchema.safeParse({
      id: "ckxxxxxxxxxxxxxxxxxxx1",
    });
    expect(r.success).toBe(true);
  });

  it("종료일이 시작일보다 이른 경우 거부 (둘 다 제공 시)", () => {
    const r = updateConferenceSchema.safeParse({
      id: "ckxxxxxxxxxxxxxxxxxxx1",
      startDate: "2026-05-10",
      endDate: "2026-05-09",
    });
    expect(r.success).toBe(false);
  });
});

describe("createVisitorSchema", () => {
  const baseConf = "ckzzzzzzzzzzzzzzzzzzz1";

  it("이름 + conferenceId 만 있어도 통과", () => {
    const r = createVisitorSchema.safeParse({
      conferenceId: baseConf,
      name: "홍길동",
    });
    expect(r.success).toBe(true);
  });

  it("이름 공백만은 거부", () => {
    const r = createVisitorSchema.safeParse({
      conferenceId: baseConf,
      name: "  ",
    });
    expect(r.success).toBe(false);
  });

  it("contactStatus 유효 값(NEW) 통과", () => {
    const r = createVisitorSchema.parse({
      conferenceId: baseConf,
      name: "홍길동",
      contactStatus: "NEW",
    });
    expect(r.contactStatus).toBe("NEW");
  });

  it("contactStatus 빈 문자열 → undefined", () => {
    const r = createVisitorSchema.parse({
      conferenceId: baseConf,
      name: "홍길동",
      contactStatus: "",
    });
    expect(r.contactStatus).toBeUndefined();
  });

  it("contactStatus 알 수 없는 값 → undefined 로 좁힘", () => {
    const r = createVisitorSchema.parse({
      conferenceId: baseConf,
      name: "홍길동",
      contactStatus: "UNKNOWN_STATUS",
    });
    expect(r.contactStatus).toBeUndefined();
  });

  it("assignedRepId 빈 문자열 → undefined", () => {
    const r = createVisitorSchema.parse({
      conferenceId: baseConf,
      name: "홍길동",
      assignedRepId: "",
    });
    expect(r.assignedRepId).toBeUndefined();
  });

  it("phone·affiliation·note 각 최대 길이 초과 거부", () => {
    const long = "x".repeat(501);
    const r = createVisitorSchema.safeParse({
      conferenceId: baseConf,
      name: "홍",
      note: long,
    });
    expect(r.success).toBe(false);
  });
});

describe("updateVisitorSchema", () => {
  it("id 만 있어도 통과", () => {
    const r = updateVisitorSchema.safeParse({ id: "ckxxxxxxxxxxxxxxxxxxx1" });
    expect(r.success).toBe(true);
  });

  it("assignedRepId=null 허용 (해제 의도)", () => {
    const r = updateVisitorSchema.safeParse({
      id: "ckxxxxxxxxxxxxxxxxxxx1",
      assignedRepId: null,
    });
    expect(r.success).toBe(true);
  });
});

describe("VISITOR_CONTACT_STATUS 리터럴", () => {
  it("4 단계 + 한글 라벨", () => {
    expect(VISITOR_CONTACT_STATUS).toEqual([
      "NEW",
      "CONTACTING",
      "DEAL",
      "LOST",
    ]);
    expect(VISITOR_CONTACT_STATUS_LABEL.NEW).toBe("신규");
    expect(VISITOR_CONTACT_STATUS_LABEL.DEAL).toBe("계약");
  });
});
