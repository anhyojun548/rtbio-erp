import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { resolveTargetUserId, pickForUserEmail } from "./forUser";
import { prisma } from "@/lib/prisma";

describe("resolveTargetUserId", () => {
  it("forUser 없으면 세션 id", async () =>
    expect(await resolveTargetUserId("u-session", undefined)).toBe("u-session"));
  it("forUser email → 해당 유저 id", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u-target" });
    expect(await resolveTargetUserId("u-session", "ceo@rtbio.com")).toBe("u-target");
  });
  it("forUser 없는 유저 → throw", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    await expect(resolveTargetUserId("u-session", "ghost@rtbio.com")).rejects.toThrow();
  });
});

describe("pickForUserEmail", () => {
  it("헤더 이메일을 본문보다 우선", () => {
    expect(pickForUserEmail("admin@rtbio.local", "other@rtbio.local")).toBe(
      "admin@rtbio.local",
    );
  });
  it("헤더가 미치환 템플릿({{...}}) 이면 본문으로 폴백", () => {
    expect(pickForUserEmail("{{$vars.forUser}}", "body@rtbio.local")).toBe(
      "body@rtbio.local",
    );
  });
  it("헤더 앞뒤 공백 트림", () => {
    expect(pickForUserEmail("  admin@rtbio.local  ", null)).toBe(
      "admin@rtbio.local",
    );
  });
  it("이메일 형식 아니면 무시", () => {
    expect(pickForUserEmail("not-an-email", null)).toBeUndefined();
  });
  it("헤더 없음 + 본문 유효 → 본문", () => {
    expect(pickForUserEmail(null, "body@rtbio.local")).toBe("body@rtbio.local");
  });
  it("둘 다 무효 → undefined", () => {
    expect(pickForUserEmail(null, undefined)).toBeUndefined();
    expect(pickForUserEmail("", "")).toBeUndefined();
  });
  it("본문이 문자열이 아니면 무시", () => {
    expect(pickForUserEmail(null, 123 as unknown)).toBeUndefined();
  });
});
