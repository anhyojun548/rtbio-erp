import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/sales-history", () => ({
  getSalesHistory: vi.fn(),
  listAssignableSalesReps: vi.fn(),
}));

import { GET } from "./route";
import { getServerSession } from "next-auth";
import { getSalesHistory, listAssignableSalesReps } from "@/lib/actions/sales-history";

beforeEach(() => vi.clearAllMocks());

describe("/api/sales-history", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/sales-history?salesRepId=r1&from=2026-04-01&to=2026-04-30"));
    expect(res.status).toBe(401);
  });

  it("GET ?reps=1 → 담당자 목록 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listAssignableSalesReps as any).mockResolvedValue([
      { id: "r1", name: "홍길동", role: "EXEC" },
    ]);
    const res = await GET(new Request("http://x/api/sales-history?reps=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("r1");
  });

  it("GET salesRepId/from/to 누락 시 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    const res = await GET(new Request("http://x/api/sales-history"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("필수");
  });

  it("GET 성공 시 SalesHistorySummary 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    const mockSummary = {
      salesRepId: "r1",
      from: new Date("2026-04-01"),
      to: new Date("2026-04-30"),
      totals: {
        orders: { count: 3, amount: 30000 },
        invoices: { count: 2, amount: 27500 },
        payments: { count: 2, amount: 23500 },
        visitors: { count: 2 },
      },
      byClient: [],
      events: [],
    };
    (getSalesHistory as any).mockResolvedValue(mockSummary);
    const res = await GET(
      new Request("http://x/api/sales-history?salesRepId=r1&from=2026-04-01&to=2026-04-30"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.salesRepId).toBe("r1");
    expect(data.totals.orders.count).toBe(3);
  });
});
