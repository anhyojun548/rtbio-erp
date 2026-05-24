import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/transaction-ledger", () => ({
  listTransactions:       vi.fn(),
  aggregateTransactions:  vi.fn(),
  bulkInsertTransactions: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import {
  listTransactions,
  aggregateTransactions,
  bulkInsertTransactions,
} from "@/lib/actions/transaction-ledger";

beforeEach(() => vi.clearAllMocks());

describe("/api/data-explorer", () => {
  describe("GET", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await GET(new Request("http://x/api/data-explorer"));
      expect(res.status).toBe(401);
    });

    it("200 rows + aggregates 합산 반환", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (listTransactions as any).mockResolvedValue({
        rows: [{ id: "t1" }],
        total: 1,
        limit: 100,
        offset: 0,
      });
      (aggregateTransactions as any).mockResolvedValue({
        count: 1,
        totalQty: 5,
        totalSupply: 1000,
        totalVat: 100,
        totalAmount: 1100,
        byKind: [],
      });

      const res = await GET(
        new Request("http://x/api/data-explorer?q=test&kind=SALE&limit=50&offset=0"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rows).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.aggregates.totalAmount).toBe(1100);
      // filter 전달 확인
      expect((listTransactions as any).mock.calls[0][0]).toMatchObject({
        q: "test",
        kind: "SALE",
        limit: 50,
        offset: 0,
      });
    });
  });

  describe("POST", () => {
    it("401 세션 없음", async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await POST(
        new Request("http://x/api/data-explorer", {
          method: "POST",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(401);
    });

    it("201 단건 삽입 성공", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (bulkInsertTransactions as any).mockResolvedValue({
        ok: true,
        data: { inserted: 1 },
      });
      const res = await POST(
        new Request("http://x/api/data-explorer", {
          method: "POST",
          body: JSON.stringify({ txnDate: "2026-01-01", kind: "SALE", productName: "X", qty: 1, unitPrice: 100, supplyAmount: 100, vat: 10, totalAmount: 110 }),
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.inserted).toBe(1);
    });

    it("400 삽입 실패", async () => {
      (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
      (bulkInsertTransactions as any).mockResolvedValue({
        ok: false,
        error: "검증 실패",
      });
      const res = await POST(
        new Request("http://x/api/data-explorer", {
          method: "POST",
          body: "{}",
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe("검증 실패");
    });
  });
});
