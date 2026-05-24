import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/product", () => ({
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  toggleProductActive: vi.fn(),
}));

import { GET, PATCH, DELETE } from "./route";
import { getServerSession } from "next-auth";
import { getProduct, updateProduct, toggleProductActive } from "@/lib/actions/product";

const ctx = { params: { id: "p1" } };

beforeEach(() => vi.clearAllMocks());

describe("/api/products/[id]", () => {
  describe("GET", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await GET(new Request("http://x"), ctx);
      expect(res.status).toBe(401);
    });

    it("404 없는 id", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (getProduct as any).mockResolvedValue(null);
      const res = await GET(new Request("http://x"), ctx);
      expect(res.status).toBe(404);
    });

    it("200 product 반환", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (getProduct as any).mockResolvedValue({ id: "p1", name: "의약품A" });
      const res = await GET(new Request("http://x"), ctx);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("p1");
      expect(data.name).toBe("의약품A");
    });
  });

  describe("PATCH", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await PATCH(
        new Request("http://x", {
          method: "PATCH",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        }),
        ctx,
      );
      expect(res.status).toBe(401);
    });

    it("200 success", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (updateProduct as any).mockResolvedValue({ ok: true, data: { id: "p1" } });
      const res = await PATCH(
        new Request("http://x", {
          method: "PATCH",
          body: JSON.stringify({ name: "갱신된명" }),
          headers: { "Content-Type": "application/json" },
        }),
        ctx,
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("p1");
    });

    it("400 validation 실패", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (updateProduct as any).mockResolvedValue({
        ok: false,
        error: "Invalid input",
        fieldErrors: { name: ["필수"] },
      });
      const res = await PATCH(
        new Request("http://x", {
          method: "PATCH",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        }),
        ctx,
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe("Invalid input");
    });
  });

  describe("DELETE", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await DELETE(new Request("http://x"), ctx);
      expect(res.status).toBe(401);
    });

    it("200 toggle 성공", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (toggleProductActive as any).mockResolvedValue({
        ok: true,
        data: { active: false },
      });
      const res = await DELETE(new Request("http://x"), ctx);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.active).toBe(false);
    });

    it("400 toggle 실패", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (toggleProductActive as any).mockResolvedValue({
        ok: false,
        error: "제품을 찾을 수 없습니다.",
      });
      const res = await DELETE(new Request("http://x"), ctx);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });
  });
});
