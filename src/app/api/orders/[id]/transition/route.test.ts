import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/order", () => ({
  submitOrder: vi.fn(),
  confirmOrder: vi.fn(),
  cancelOrder: vi.fn(),
  holdOrder: vi.fn(),
  resumeOrder: vi.fn(),
  rejectOrder: vi.fn(),
}));

import { POST } from "./route";
import { getServerSession } from "next-auth";
import {
  submitOrder,
  confirmOrder,
  cancelOrder,
  holdOrder,
  resumeOrder,
  rejectOrder,
} from "@/lib/actions/order";

beforeEach(() => vi.clearAllMocks());

describe("/api/orders/[id]/transition", () => {
  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/orders/o1/transition", {
        method: "POST",
        body: JSON.stringify({ to: "SUBMITTED" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(401);
  });

  it("POST 알 수 없는 transition 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    const res = await POST(
      new Request("http://x/api/orders/o1/transition", {
        method: "POST",
        body: JSON.stringify({ to: "INVALID" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "Unknown transition: INVALID",
    });
  });

  it("POST SUBMITTED 성공", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (submitOrder as any).mockResolvedValue({ ok: true, data: { id: "o1" } });
    const res = await POST(
      new Request("http://x/api/orders/o1/transition", {
        method: "POST",
        body: JSON.stringify({ to: "SUBMITTED" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "o1" });
    expect((submitOrder as any).mock.calls).toHaveLength(1);
  });

  it("POST CONFIRMED 성공", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (confirmOrder as any).mockResolvedValue({ ok: true, data: { id: "o1" } });
    const res = await POST(
      new Request("http://x/api/orders/o1/transition", {
        method: "POST",
        body: JSON.stringify({ to: "CONFIRMED" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "o1" });
    expect((confirmOrder as any).mock.calls).toHaveLength(1);
  });

  it("POST CANCELLED with reason 성공", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (cancelOrder as any).mockResolvedValue({
      ok: true,
      data: { id: "o1", releasedStock: true },
    });
    const res = await POST(
      new Request("http://x/api/orders/o1/transition", {
        method: "POST",
        body: JSON.stringify({ to: "CANCELLED", reason: "고객 요청" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "o1", releasedStock: true });
    expect((cancelOrder as any).mock.calls[0]).toEqual([
      "o1",
      { reason: "고객 요청" },
    ]);
  });

  it("POST HELD with reason 성공", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (holdOrder as any).mockResolvedValue({ ok: true, data: { id: "o1" } });
    const res = await POST(
      new Request("http://x/api/orders/o1/transition", {
        method: "POST",
        body: JSON.stringify({ to: "HELD", reason: "재고 부족" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "o1" });
    expect((holdOrder as any).mock.calls[0]).toEqual([
      "o1",
      { reason: "재고 부족" },
    ]);
  });

  it("POST RESUMED 성공", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (resumeOrder as any).mockResolvedValue({ ok: true, data: { id: "o1" } });
    const res = await POST(
      new Request("http://x/api/orders/o1/transition", {
        method: "POST",
        body: JSON.stringify({ to: "RESUMED" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "o1" });
    expect((resumeOrder as any).mock.calls).toHaveLength(1);
  });

  it("POST REJECTED with reason 성공", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (rejectOrder as any).mockResolvedValue({ ok: true, data: { id: "o1" } });
    const res = await POST(
      new Request("http://x/api/orders/o1/transition", {
        method: "POST",
        body: JSON.stringify({ to: "REJECTED", reason: "규격 미맞음" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "o1" });
    expect((rejectOrder as any).mock.calls[0]).toEqual([
      "o1",
      { reason: "규격 미맞음" },
    ]);
  });

  it("POST action 실패 시 400 error", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (submitOrder as any).mockResolvedValue({
      ok: false,
      error: "SUBMITTED 상태로 이미 변경됨",
    });
    const res = await POST(
      new Request("http://x/api/orders/o1/transition", {
        method: "POST",
        body: JSON.stringify({ to: "SUBMITTED" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "o1" } },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "SUBMITTED 상태로 이미 변경됨",
    });
  });
});
