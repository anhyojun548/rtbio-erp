import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/invoice", () => ({
  listInvoices: vi.fn(),
  createInvoiceFromOrder: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import { listInvoices, createInvoiceFromOrder } from "@/lib/actions/invoice";

beforeEach(() => vi.clearAllMocks());

describe("/api/invoices", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/invoices"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 배열 그대로", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listInvoices as any).mockResolvedValue([
      { id: "inv1", invoiceNumber: "INV-001", status: "ISSUED" },
    ]);
    const res = await GET(new Request("http://x/api/invoices"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: "inv1", invoiceNumber: "INV-001", status: "ISSUED" },
    ]);
  });

  it("GET 쿼리 파라미터 전달 (clientId, status, from, to, q)", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listInvoices as any).mockResolvedValue([]);
    await GET(
      new Request(
        "http://x/api/invoices?clientId=c1&status=ISSUED&from=2026-01-01&to=2026-01-31&q=test",
      ),
    );
    expect((listInvoices as any).mock.calls[0][0]).toMatchObject({
      clientId: "c1",
      status: "ISSUED",
      from: new Date("2026-01-01"),
      to: new Date("2026-01-31"),
      q: "test",
    });
  });

  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/invoices", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST 성공 시 생성 데이터 201", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createInvoiceFromOrder as any).mockResolvedValue({
      ok: true,
      data: { id: "inv2", invoiceNumber: "INV-002", status: "DRAFT" },
    });
    const res = await POST(
      new Request("http://x/api/invoices", {
        method: "POST",
        body: JSON.stringify({ orderId: "o1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: "inv2",
      invoiceNumber: "INV-002",
      status: "DRAFT",
    });
  });
});
