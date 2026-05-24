import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/invoice", () => ({
  cancelInvoice: vi.fn(),
}));

import { POST } from "./route";
import { getServerSession } from "next-auth";
import { cancelInvoice } from "@/lib/actions/invoice";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/invoices/[id]/cancel", () => {
  it("세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/invoices/inv1/cancel", {
        method: "POST",
        body: JSON.stringify({ reason: "고객 요청" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "inv1" } },
    );
    expect(res.status).toBe(401);
  });

  it("성공 시 취소된 인보이스 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (cancelInvoice as any).mockResolvedValue({
      ok: true,
      data: {
        id: "inv1",
        invoiceNumber: "INV-20260101-001",
        status: "CANCELLED",
        cancelledReason: "고객 요청",
      },
    });
    const res = await POST(
      new Request("http://x/api/invoices/inv1/cancel", {
        method: "POST",
        body: JSON.stringify({ reason: "고객 요청" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "inv1" } },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "inv1",
      invoiceNumber: "INV-20260101-001",
      status: "CANCELLED",
      cancelledReason: "고객 요청",
    });
  });

  it("실패 시 400 에러", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (cancelInvoice as any).mockResolvedValue({
      ok: false,
      error: "DRAFT, ISSUED, SENT 상태만 취소 가능",
    });
    const res = await POST(
      new Request("http://x/api/invoices/inv1/cancel", {
        method: "POST",
        body: JSON.stringify({ reason: "고객 요청" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "inv1" } },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "DRAFT, ISSUED, SENT 상태만 취소 가능",
    });
  });
});
