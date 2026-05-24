import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/transaction-ledger", () => ({
  bulkInsertTransactions:         vi.fn(),
  bulkUpdateTransactions:         vi.fn(),
  deleteTransactionsByImportSource: vi.fn(),
}));

import { POST, PATCH, DELETE } from "./route";
import { getServerSession } from "next-auth";
import {
  bulkInsertTransactions,
  bulkUpdateTransactions,
  deleteTransactionsByImportSource,
} from "@/lib/actions/transaction-ledger";

beforeEach(() => vi.clearAllMocks());

describe("/api/data-explorer/bulk", () => {
  describe("POST (대량 삽입)", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await POST(
        new Request("http://x/api/data-explorer/bulk", {
          method: "POST",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(401);
    });

    it("201 삽입 성공", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (bulkInsertTransactions as any).mockResolvedValue({
        ok: true,
        data: { inserted: 3 },
      });
      const res = await POST(
        new Request("http://x/api/data-explorer/bulk", {
          method: "POST",
          body: JSON.stringify({ rows: [{}, {}, {}], importSource: "test-batch" }),
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.inserted).toBe(3);
      expect((bulkInsertTransactions as any).mock.calls[0][1]).toBe("test-batch");
    });

    it("400 삽입 실패", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (bulkInsertTransactions as any).mockResolvedValue({
        ok: false,
        error: "전체 검증 실패",
      });
      const res = await POST(
        new Request("http://x/api/data-explorer/bulk", {
          method: "POST",
          body: JSON.stringify({ rows: [] }),
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe("전체 검증 실패");
    });
  });

  describe("PATCH (일괄 수정)", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await PATCH(
        new Request("http://x/api/data-explorer/bulk", {
          method: "PATCH",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(401);
    });

    it("200 일괄 수정 성공", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (bulkUpdateTransactions as any).mockResolvedValue({
        ok: true,
        data: { updatedCount: 5 },
      });
      const res = await PATCH(
        new Request("http://x/api/data-explorer/bulk", {
          method: "PATCH",
          body: JSON.stringify({
            filter: { clientCode: "C001" },
            patch:  { memo: "일괄" },
          }),
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.updatedCount).toBe(5);
      expect((bulkUpdateTransactions as any).mock.calls[0][0]).toMatchObject({ clientCode: "C001" });
    });

    it("400 수정 실패", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (bulkUpdateTransactions as any).mockResolvedValue({
        ok: false,
        error: "잘못된 patch 필드",
      });
      const res = await PATCH(
        new Request("http://x/api/data-explorer/bulk", {
          method: "PATCH",
          body: JSON.stringify({ filter: {}, patch: { _invalid: true } }),
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });
  });

  describe("DELETE (배치 삭제)", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await DELETE(
        new Request("http://x/api/data-explorer/bulk", {
          method: "DELETE",
          body: JSON.stringify({ importSource: "batch-01" }),
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(401);
    });

    it("200 배치 삭제 성공", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (deleteTransactionsByImportSource as any).mockResolvedValue({
        ok: true,
        data: { deleted: 42 },
      });
      const res = await DELETE(
        new Request("http://x/api/data-explorer/bulk", {
          method: "DELETE",
          body: JSON.stringify({ importSource: "batch-01" }),
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(42);
    });

    it("400 importSource 누락", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      const res = await DELETE(
        new Request("http://x/api/data-explorer/bulk", {
          method: "DELETE",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });
  });
});
