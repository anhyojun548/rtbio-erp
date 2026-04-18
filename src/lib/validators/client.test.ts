/**
 * client.ts Zod 스키마 단위 테스트.
 * 순수 검증 로직만 — DB/세션 의존 없음.
 */
import { describe, expect, it } from "vitest";
import {
  clientCreateSchema,
  clientUpdateSchema,
  addressCreateSchema,
  addressUpdateSchema,
} from "./client";

describe("clientCreateSchema", () => {
  it("최소 필수 필드로 통과", () => {
    const res = clientCreateSchema.safeParse({
      code: "ALTI-001",
      name: "알티바이오",
      type: "AGENCY",
    });
    expect(res.success).toBe(true);
  });

  it("빈 이메일은 undefined 로 정규화", () => {
    const res = clientCreateSchema.safeParse({
      code: "ALTI-001",
      name: "알티바이오",
      type: "AGENCY",
      email: "",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.email).toBeUndefined();
  });

  it("이메일 형식 오류 시 실패", () => {
    const res = clientCreateSchema.safeParse({
      code: "ALTI-001",
      name: "알티바이오",
      type: "AGENCY",
      email: "not-an-email",
    });
    expect(res.success).toBe(false);
  });

  it("code 는 대문자/숫자/-/_ 만 허용", () => {
    const res = clientCreateSchema.safeParse({
      code: "alti 001",
      name: "알티바이오",
      type: "AGENCY",
    });
    expect(res.success).toBe(false);
  });

  it("code 길이 2~32자 검증", () => {
    const tooShort = clientCreateSchema.safeParse({
      code: "A",
      name: "X",
      type: "AGENCY",
    });
    expect(tooShort.success).toBe(false);
  });

  it("존재하지 않는 type 은 거부", () => {
    const res = clientCreateSchema.safeParse({
      code: "ALTI-001",
      name: "X",
      type: "UNKNOWN_TYPE",
    });
    expect(res.success).toBe(false);
  });

  it("PHARMACY(약국) 타입 허용", () => {
    const res = clientCreateSchema.safeParse({
      code: "ALTI-001",
      name: "X",
      type: "PHARMACY",
    });
    expect(res.success).toBe(true);
  });
});

describe("clientUpdateSchema", () => {
  it("모든 필드가 optional", () => {
    const res = clientUpdateSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it("active 필드 포함 가능", () => {
    const res = clientUpdateSchema.safeParse({ active: false });
    expect(res.success).toBe(true);
  });
});

describe("addressCreateSchema", () => {
  it("label 과 address 가 필수", () => {
    const ok = addressCreateSchema.safeParse({
      label: "본점",
      address: "서울시 강남구",
    });
    expect(ok.success).toBe(true);

    const missLabel = addressCreateSchema.safeParse({ address: "서울시" });
    expect(missLabel.success).toBe(false);

    const missAddr = addressCreateSchema.safeParse({ label: "본점" });
    expect(missAddr.success).toBe(false);
  });

  it("isDefault 기본값 false", () => {
    const res = addressCreateSchema.safeParse({
      label: "본점",
      address: "서울시",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.isDefault).toBe(false);
  });
});

describe("addressUpdateSchema", () => {
  it("빈 객체도 통과 (patch 의미)", () => {
    expect(addressUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("isDefault 만 단독 업데이트 가능", () => {
    const res = addressUpdateSchema.safeParse({ isDefault: true });
    expect(res.success).toBe(true);
  });
});
