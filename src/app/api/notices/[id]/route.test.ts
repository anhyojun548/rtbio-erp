import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/notice", () => ({
  deleteNotice: vi.fn(),
}));

import { DELETE } from "./route";
import { getServerSession } from "next-auth";
import { deleteNotice } from "@/lib/actions/notice";

const ctx = { params: { id: "n1" } };

beforeEach(() => vi.clearAllMocks());

describe("/api/notices/[id]", () => {
  describe("DELETE", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await DELETE(new Request("http://x"), ctx);
      expect(res.status).toBe(401);
    });

    it("200 삭제 성공", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (deleteNotice as any).mockResolvedValue({
        ok: true,
        data: { id: "n1" },
      });
      const res = await DELETE(new Request("http://x"), ctx);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("n1");
    });

    it("400 삭제 권한 없음", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (deleteNotice as any).mockResolvedValue({
        ok: false,
        error: "삭제 권한이 없습니다",
      });
      const res = await DELETE(new Request("http://x"), ctx);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });
  });
});
