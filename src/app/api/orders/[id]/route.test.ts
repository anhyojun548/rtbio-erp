import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/order", () => ({
  getOrder: vi.fn(),
  updateOrder: vi.fn(),
}));

import { GET, PATCH } from "./route";
import { getServerSession } from "next-auth";
import { getOrder, updateOrder } from "@/lib/actions/order";

beforeEach(() => vi.clearAllMocks());

describe("/api/orders/[id]", () => {
  // GET tests
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/orders/o1"), {
      params: { id: "o1" },
    });
    expect(res.status).toBe(401);
  });

  it("GET 주문 없으면 404", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (getOrder as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/orders/o999"), {
      params: { id: "o999" },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Not Found" });
  });

  it("GET 성공 시 주문 데이터 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (getOrder as any).mockResolvedValue({ id: "o1", orderNumber: "ORD-001" });
    const res = await GET(new Request("http://x/api/orders/o1"), {
      params: { id: "o1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "o1", orderNumber: "ORD-001" });
  });

  // PATCH tests
  it("PATCH 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await PATCH(
      new Request("http://x/api/orders/o1", {
        method: "PATCH",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(401);
  });

  it("PATCH 성공 시 수정 데이터 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (updateOrder as any).mockResolvedValue({
      ok: true,
      data: { id: "o1", orderNumber: "DRAFT-001" },
    });
    const res = await PATCH(
      new Request("http://x/api/orders/o1", {
        method: "PATCH",
        body: JSON.stringify({ note: "updated" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "o1", orderNumber: "DRAFT-001" });
  });

  it("PATCH validator 실패 시 400 envelope", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (updateOrder as any).mockResolvedValue({
      ok: false,
      error: "DRAFT 상태만 편집 가능",
      fieldErrors: {},
    });
    const res = await PATCH(
      new Request("http://x/api/orders/o1", {
        method: "PATCH",
        body: JSON.stringify({ note: "" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "DRAFT 상태만 편집 가능",
      fieldErrors: {},
    });
  });
});
