import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/udi", () => ({
  submitUdiReport: vi.fn(),
}));

import { POST } from "./route";
import { getServerSession } from "next-auth";
import { submitUdiReport } from "@/lib/actions/udi";

beforeEach(() => vi.clearAllMocks());

describe("/api/udi/[id]/submit", () => {
  const mockParams = { id: "r1" };

  describe("POST", () => {
    it("세션 없으면 401", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await POST(
        new Request("http://x/api/udi/r1/submit", { method: "POST" }),
        { params: mockParams }
      );
      expect(res.status).toBe(401);
    });

    it("전송 성공 시 200 + { receiptNo }", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (submitUdiReport as any).mockResolvedValue({
        ok: true,
        data: { receiptNo: "UDI-260524-1234" },
      });
      const res = await POST(
        new Request("http://x/api/udi/r1/submit", { method: "POST" }),
        { params: mockParams }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.receiptNo).toContain("UDI-");
    });

    it("DRAFT 아닌 상태면 400", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (submitUdiReport as any).mockResolvedValue({
        ok: false,
        error: "ACCEPTED 상태만 전송 가능",
      });
      const res = await POST(
        new Request("http://x/api/udi/r1/submit", { method: "POST" }),
        { params: mockParams }
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });
  });
});
