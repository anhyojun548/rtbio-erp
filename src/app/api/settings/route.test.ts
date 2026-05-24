import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/tenant-setting", () => ({
  listSettings: vi.fn(),
  updateSetting: vi.fn(),
  bulkUpdateSettings: vi.fn(),
}));

import { GET, PATCH } from "./route";
import { getServerSession } from "next-auth";
import {
  listSettings,
  updateSetting,
  bulkUpdateSettings,
} from "@/lib/actions/tenant-setting";

describe("/api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("세션 없으면 401 + error", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ ok: false, error: "Unauthorized" });
    });

    it("세션 있으면 200 + listSettings 결과 반환", async () => {
      (getServerSession as any).mockResolvedValue({
        user: { id: "u1", role: "ADMIN", tenantId: "t1" },
      });
      (listSettings as any).mockResolvedValue([
        {
          key: "business_hour_start",
          value: "09:00",
          description: "업무 시작 시각",
          updatedAt: new Date("2026-05-25"),
          updatedBy: "u1",
        },
        {
          key: "vat_rate",
          value: null,
          description: "부가세율",
          updatedAt: null,
          updatedBy: null,
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].key).toBe("business_hour_start");
      expect(data[0].value).toBe("09:00");
      expect(data[1].key).toBe("vat_rate");
      expect(data[1].value).toBeNull();
    });
  });

  describe("PATCH", () => {
    it("세션 없으면 401 + error", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const req = new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({ key: "vat_rate", value: "0.08" }),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ ok: false, error: "Unauthorized" });
    });

    it("key 와 items 모두 없으면 400", async () => {
      (getServerSession as any).mockResolvedValue({
        user: { id: "u1", role: "ADMIN", tenantId: "t1" },
      });

      const req = new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({}),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        ok: false,
        error: "key 또는 items 필요",
      });
    });

    it("단일 업데이트 - 성공", async () => {
      (getServerSession as any).mockResolvedValue({
        user: { id: "u1", role: "ADMIN", tenantId: "t1" },
      });
      (updateSetting as any).mockResolvedValue({
        ok: true,
        data: { key: "vat_rate", value: "0.08" },
      });

      const req = new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({ key: "vat_rate", value: "0.08" }),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ key: "vat_rate", value: "0.08" });
      expect(updateSetting).toHaveBeenCalledWith({
        key: "vat_rate",
        value: "0.08",
      });
    });

    it("단일 업데이트 - 실패 (validator)", async () => {
      (getServerSession as any).mockResolvedValue({
        user: { id: "u1", role: "ADMIN", tenantId: "t1" },
      });
      (updateSetting as any).mockResolvedValue({
        ok: false,
        error: "Invalid value",
        fieldErrors: { value: ["must be between 0 and 1"] },
      });

      const req = new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({ key: "vat_rate", value: "99" }),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe("Invalid value");
      expect(data.fieldErrors).toEqual({ value: ["must be between 0 and 1"] });
    });

    it("일괄 업데이트 - 성공", async () => {
      (getServerSession as any).mockResolvedValue({
        user: { id: "u1", role: "ADMIN", tenantId: "t1" },
      });
      (bulkUpdateSettings as any).mockResolvedValue({
        ok: true,
        data: { count: 3 },
      });

      const req = new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({
          items: [
            { key: "business_hour_start", value: "08:00" },
            { key: "business_hour_end", value: "18:00" },
            { key: "vat_rate", value: "0.10" },
          ],
        }),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ count: 3 });
      expect(bulkUpdateSettings).toHaveBeenCalledWith({
        items: [
          { key: "business_hour_start", value: "08:00" },
          { key: "business_hour_end", value: "18:00" },
          { key: "vat_rate", value: "0.10" },
        ],
      });
    });

    it("일괄 업데이트 - 실패 (비즈니스 규칙)", async () => {
      (getServerSession as any).mockResolvedValue({
        user: { id: "u1", role: "ADMIN", tenantId: "t1" },
      });
      (bulkUpdateSettings as any).mockResolvedValue({
        ok: false,
        error: "업무 종료시간은 시작시간 이후여야 합니다",
        fieldErrors: null,
      });

      const req = new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({
          items: [
            { key: "business_hour_start", value: "18:00" },
            { key: "business_hour_end", value: "08:00" },
          ],
        }),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain("업무");
    });
  });
});
