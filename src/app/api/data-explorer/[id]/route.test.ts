import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/transaction-ledger", () => ({
  getTransaction:    vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));

import { GET, PATCH, DELETE } from "./route";
import { getServerSession } from "next-auth";
import {
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/lib/actions/transaction-ledger";

const ctx = { params: { id: "txn1" } };

beforeEach(() => vi.clearAllMocks());

describe("/api/data-explorer/[id]", () => {
  describe("GET", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await GET(new Request("http://x"), ctx);
      expect(res.status).toBe(401);
    });

    it("404 없는 id", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (getTransaction as any).mockResolvedValue(null);
      const res = await GET(new Request("http://x"), ctx);
      expect(res.status).toBe(404);
    });

    it("200 거래 반환", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (getTransaction as any).mockResolvedValue({ id: "txn1", productName: "제품A" });
      const res = await GET(new Request("http://x"), ctx);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("txn1");
      expect(data.productName).toBe("제품A");
    });
  });

  describe("PATCH", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await PATCH(
        new Request("http://x", { method: "PATCH", body: "{}", headers: { "Content-Type": "application/json" } }),
        ctx,
      );
      expect(res.status).toBe(401);
    });

    it("200 수정 성공", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (updateTransaction as any).mockResolvedValue({ ok: true, data: { id: "txn1" } });
      const res = await PATCH(
        new Request("http://x", {
          method: "PATCH",
          body: JSON.stringify({ memo: "수정됨" }),
          headers: { "Content-Type": "application/json" },
        }),
        ctx,
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("txn1");
    });

    it("400 수정 실패", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (updateTransaction as any).mockResolvedValue({
        ok: false,
        error: "거래를 찾을 수 없습니다",
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
    });
  });

  describe("DELETE", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await DELETE(new Request("http://x"), ctx);
      expect(res.status).toBe(401);
    });

    it("200 삭제 성공", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (deleteTransaction as any).mockResolvedValue({ ok: true, data: { id: "txn1" } });
      const res = await DELETE(new Request("http://x"), ctx);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("txn1");
    });

    it("400 삭제 실패", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (deleteTransaction as any).mockResolvedValue({
        ok: false,
        error: "거래를 찾을 수 없습니다",
      });
      const res = await DELETE(new Request("http://x"), ctx);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
    });
  });
});
