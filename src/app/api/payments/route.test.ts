import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/payment", () => ({
  listPayments: vi.fn(),
  recordPayment: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import { listPayments, recordPayment } from "@/lib/actions/payment";

beforeEach(() => vi.clearAllMocks());

describe("/api/payments", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/payments"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 배열 그대로", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listPayments as any).mockResolvedValue([
      { id: "pay1", amount: 1000000, status: "PARTIAL" },
    ]);
    const res = await GET(new Request("http://x/api/payments"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: "pay1", amount: 1000000, status: "PARTIAL" },
    ]);
  });

  it("GET 쿼리 파라미터 전달 (clientId, status, from, to)", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listPayments as any).mockResolvedValue([]);
    await GET(
      new Request(
        "http://x/api/payments?clientId=c1&status=PARTIAL&from=2026-01-01&to=2026-01-31",
      ),
    );
    expect((listPayments as any).mock.calls[0][0]).toMatchObject({
      clientId: "c1",
      status: "PARTIAL",
      from: new Date("2026-01-01"),
      to: new Date("2026-01-31"),
    });
  });

  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/payments", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST 성공 시 생성 데이터 201", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (recordPayment as any).mockResolvedValue({
      ok: true,
      data: { id: "pay2", amount: 500000, status: "PENDING" },
    });
    const res = await POST(
      new Request("http://x/api/payments", {
        method: "POST",
        body: JSON.stringify({ clientId: "c1", amount: 500000 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: "pay2",
      amount: 500000,
      status: "PENDING",
    });
  });

  it("POST 실패 시 400 에러", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (recordPayment as any).mockResolvedValue({
      ok: false,
      error: "clientId 필수",
      fieldErrors: { clientId: ["필수 필드"] },
    });
    const res = await POST(
      new Request("http://x/api/payments", {
        method: "POST",
        body: JSON.stringify({ amount: 500000 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "clientId 필수",
      fieldErrors: { clientId: ["필수 필드"] },
    });
  });
});
