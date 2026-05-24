import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/invoice", () => ({
  markInvoiceSent: vi.fn(),
}));

import { POST } from "./route";
import { getServerSession } from "next-auth";
import { markInvoiceSent } from "@/lib/actions/invoice";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/invoices/[id]/send", () => {
  it("세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(new Request("http://x/api/invoices/inv1/send"), {
      params: { id: "inv1" },
    });
    expect(res.status).toBe(401);
  });

  it("성공 시 전송 표시된 인보이스 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (markInvoiceSent as any).mockResolvedValue({
      ok: true,
      data: {
        id: "inv1",
        invoiceNumber: "INV-20260101-001",
        status: "SENT",
        sentAt: "2026-01-01T10:00:00Z",
      },
    });
    const res = await POST(new Request("http://x/api/invoices/inv1/send"), {
      params: { id: "inv1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "inv1",
      invoiceNumber: "INV-20260101-001",
      status: "SENT",
      sentAt: "2026-01-01T10:00:00Z",
    });
  });

  it("실패 시 400 에러", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (markInvoiceSent as any).mockResolvedValue({
      ok: false,
      error: "ISSUED 상태만 전송 가능",
    });
    const res = await POST(new Request("http://x/api/invoices/inv1/send"), {
      params: { id: "inv1" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "ISSUED 상태만 전송 가능",
    });
  });
});
