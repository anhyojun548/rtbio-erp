import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/udi", () => ({
  listUdiReports: vi.fn(),
  getUdiMonthPreview: vi.fn(),
  createUdiReportFromInvoices: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import {
  listUdiReports,
  getUdiMonthPreview,
  createUdiReportFromInvoices,
} from "@/lib/actions/udi";

beforeEach(() => vi.clearAllMocks());

describe("/api/udi", () => {
  describe("GET", () => {
    it("세션 없으면 401", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await GET(new Request("http://x/api/udi"));
      expect(res.status).toBe(401);
    });

    it("preview=1 & month 있으면 getUdiMonthPreview 호출", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (getUdiMonthPreview as any).mockResolvedValue({
        reportMonth: "2026-04",
        hospitalCount: 3,
        itemCount: 5,
        excludedItemCount: 2,
        totalQty: 50,
        totalAmount: 100000,
        hasExistingReport: false,
      });
      const res = await GET(
        new Request("http://x/api/udi?month=2026-04&preview=1")
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.reportMonth).toBe("2026-04");
      expect(data.hospitalCount).toBe(3);
      expect((getUdiMonthPreview as any).mock.calls[0][0]).toBe("2026-04");
    });

    it("preview 없으면 listUdiReports 호출", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (listUdiReports as any).mockResolvedValue([
        {
          id: "r1",
          reportMonth: "2026-04",
          status: "DRAFT",
          totalItems: 5,
        },
      ]);
      const res = await GET(new Request("http://x/api/udi"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].id).toBe("r1");
    });
  });

  describe("POST", () => {
    it("세션 없으면 401", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await POST(
        new Request("http://x/api/udi", {
          method: "POST",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(res.status).toBe(401);
    });

    it("성공 시 201 + { id, itemCount, excludedCount }", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (createUdiReportFromInvoices as any).mockResolvedValue({
        ok: true,
        data: { id: "r1", itemCount: 5, excludedCount: 2 },
      });
      const res = await POST(
        new Request("http://x/api/udi", {
          method: "POST",
          body: JSON.stringify({
            reportMonth: "2026-04",
            note: "4월 보고",
          }),
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe("r1");
      expect(data.itemCount).toBe(5);
      expect(data.excludedCount).toBe(2);
    });

    it("validation 실패 시 400 + error", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (createUdiReportFromInvoices as any).mockResolvedValue({
        ok: false,
        error: "2026-04 보고서가 이미 존재합니다",
        fieldErrors: {},
      });
      const res = await POST(
        new Request("http://x/api/udi", {
          method: "POST",
          body: JSON.stringify({ reportMonth: "2026-04" }),
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain("이미 존재");
    });

    it("body JSON parse 실패해도 graceful", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (createUdiReportFromInvoices as any).mockResolvedValue({
        ok: false,
        error: "검증 실패",
      });
      const res = await POST(
        new Request("http://x/api/udi", {
          method: "POST",
          body: "invalid json",
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
