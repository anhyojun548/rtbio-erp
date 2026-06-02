import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { resolveTargetUserId } from "./forUser";
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
