import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/order", () => ({
  listOrders: vi.fn(),
  createOrder: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import { listOrders, createOrder } from "@/lib/actions/order";

beforeEach(() => vi.clearAllMocks());

describe("/api/orders", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/orders"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 배열 그대로", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listOrders as any).mockResolvedValue([{ id: "o1", orderNumber: "ORD-001" }]);
    const res = await GET(new Request("http://x/api/orders"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "o1", orderNumber: "ORD-001" }]);
  });

  it("GET 쿼리 파라미터 전달 (q, status, clientId)", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listOrders as any).mockResolvedValue([]);
    await GET(
      new Request(
        "http://x/api/orders?q=test&status=DRAFT&clientId=c1&from=2026-01-01&to=2026-01-31",
      ),
    );
    expect((listOrders as any).mock.calls[0][0]).toMatchObject({
      q: "test",
      status: "DRAFT",
      clientId: "c1",
      from: new Date("2026-01-01"),
      to: new Date("2026-01-31"),
    });
  });

  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/orders", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST 성공 시 생성 데이터 201", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createOrder as any).mockResolvedValue({
      ok: true,
      data: { id: "o2", orderNumber: "DRAFT-001" },
    });
    const res = await POST(
      new Request("http://x/api/orders", {
        method: "POST",
        body: JSON.stringify({ clientId: "c1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "o2", orderNumber: "DRAFT-001" });
  });

  it("POST validator 실패 시 400 envelope", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createOrder as any).mockResolvedValue({
      ok: false,
      error: "거래처 필수",
      fieldErrors: { clientId: ["필수"] },
    });
    const res = await POST(
      new Request("http://x/api/orders", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "거래처 필수",
      fieldErrors: { clientId: ["필수"] },
    });
  });
});
