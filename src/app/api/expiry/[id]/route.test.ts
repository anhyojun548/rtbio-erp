import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/expiry", () => ({
  listExpiryLots: vi.fn(),
  listExpiringSoon: vi.fn(),
  createExpiryLot: vi.fn(),
  updateExpiryLot: vi.fn(),
  deleteExpiryLot: vi.fn(),
}));

import { PATCH, DELETE } from "./route";
import { getServerSession } from "next-auth";
import { updateExpiryLot, deleteExpiryLot } from "@/lib/actions/expiry";

const ctx = { params: { id: "lot-1" } };

beforeEach(() => vi.clearAllMocks());

describe("/api/expiry/[id]", () => {
  it("PATCH 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await PATCH(
      new Request("http://x/api/expiry/lot-1", {
        method: "PATCH",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("PATCH action 실패 시 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (updateExpiryLot as any).mockResolvedValue({
      ok: false,
      error: "잔여수량 초과",
    });
    const res = await PATCH(
      new Request("http://x/api/expiry/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ remainingQty: 9999 }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("잔여수량");
  });

  it("PATCH 성공 시 id 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (updateExpiryLot as any).mockResolvedValue({ ok: true, data: { id: "lot-1" } });
    const res = await PATCH(
      new Request("http://x/api/expiry/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ remainingQty: 50 }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "lot-1" });
  });

  it("DELETE 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://x/api/expiry/lot-1", { method: "DELETE" }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("DELETE 성공 시 id 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (deleteExpiryLot as any).mockResolvedValue({ ok: true, data: { id: "lot-1" } });
    const res = await DELETE(
      new Request("http://x/api/expiry/lot-1", { method: "DELETE" }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "lot-1" });
  });
});
