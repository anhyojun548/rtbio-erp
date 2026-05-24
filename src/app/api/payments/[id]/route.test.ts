import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/payment", () => ({
  cancelPayment: vi.fn(),
}));

import { DELETE } from "./route";
import { getServerSession } from "next-auth";
import { cancelPayment } from "@/lib/actions/payment";

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/payments/[id]", () => {
  it("세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://x/api/payments/pay1", {
        method: "DELETE",
        body: JSON.stringify({ reason: "취소" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "pay1" } },
    );
    expect(res.status).toBe(401);
  });

  it("성공 시 취소된 수금 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (cancelPayment as any).mockResolvedValue({
      ok: true,
      data: {
        id: "pay1",
        amount: 1000000,
        status: "PENDING",
        cancelReason: "취소 요청",
      },
    });
    const res = await DELETE(
      new Request("http://x/api/payments/pay1", {
        method: "DELETE",
        body: JSON.stringify({ reason: "취소 요청" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "pay1" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "pay1",
      amount: 1000000,
      status: "PENDING",
      cancelReason: "취소 요청",
    });
  });

  it("실패 시 400 에러", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (cancelPayment as any).mockResolvedValue({
      ok: false,
      error: "PENDING, PARTIAL, PAID 상태만 취소 가능",
    });
    const res = await DELETE(
      new Request("http://x/api/payments/pay1", {
        method: "DELETE",
        body: JSON.stringify({ reason: "취소 요청" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "pay1" } },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "PENDING, PARTIAL, PAID 상태만 취소 가능",
    });
  });
});
