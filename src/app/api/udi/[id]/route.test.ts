import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/udi", () => ({
  getUdiReport: vi.fn(),
  deleteUdiReport: vi.fn(),
}));

import { GET, DELETE } from "./route";
import { getServerSession } from "next-auth";
import { getUdiReport, deleteUdiReport } from "@/lib/actions/udi";

beforeEach(() => vi.clearAllMocks());

describe("/api/udi/[id]", () => {
  const mockParams = { id: "r1" };

  describe("GET", () => {
    it("세션 없으면 401", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await GET(new Request("http://x/api/udi/r1"), {
        params: mockParams,
      });
      expect(res.status).toBe(401);
    });

    it("보고서 있으면 200 + full data", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (getUdiReport as any).mockResolvedValue({
        id: "r1",
        reportMonth: "2026-04",
        status: "DRAFT",
        items: [
          {
            id: "i1",
            udiCode: "08801234567890",
            productName: "제품A",
            qty: 10,
          },
        ],
      });
      const res = await GET(new Request("http://x/api/udi/r1"), {
        params: mockParams,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("r1");
      expect(data.items.length).toBe(1);
    });

    it("보고서 없으면 404", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (getUdiReport as any).mockResolvedValue(null);
      const res = await GET(new Request("http://x/api/udi/r1"), {
        params: mockParams,
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });
  });

  describe("DELETE", () => {
    it("세션 없으면 401", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await DELETE(
        new Request("http://x/api/udi/r1", { method: "DELETE" }),
        { params: mockParams }
      );
      expect(res.status).toBe(401);
    });

    it("삭제 성공 시 200 + { id }", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (deleteUdiReport as any).mockResolvedValue({
        ok: true,
        data: { id: "r1" },
      });
      const res = await DELETE(
        new Request("http://x/api/udi/r1", { method: "DELETE" }),
        { params: mockParams }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("r1");
    });

    it("DRAFT 아닌 상태면 400", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (deleteUdiReport as any).mockResolvedValue({
        ok: false,
        error: "ACCEPTED 상태 보고서는 삭제할 수 없습니다",
      });
      const res = await DELETE(
        new Request("http://x/api/udi/r1", { method: "DELETE" }),
        { params: mockParams }
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });
  });
});
