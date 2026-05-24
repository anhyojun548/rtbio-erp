import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/invoice", () => ({
  getInvoice: vi.fn(),
}));

import { GET } from "./route";
import { getServerSession } from "next-auth";
import { getInvoice } from "@/lib/actions/invoice";

beforeEach(() => vi.clearAllMocks());

describe("/api/invoices/[id]", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/invoices/inv1"), {
      params: { id: "inv1" },
    });
    expect(res.status).toBe(401);
  });

  it("GET 인보이스 없으면 404", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (getInvoice as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/invoices/inv1"), {
      params: { id: "inv1" },
    });
    expect(res.status).toBe(404);
  });

  it("GET 성공 시 인보이스 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (getInvoice as any).mockResolvedValue({
      id: "inv1",
      invoiceNumber: "INV-001",
      status: "ISSUED",
    });
    const res = await GET(new Request("http://x/api/invoices/inv1"), {
      params: { id: "inv1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "inv1",
      invoiceNumber: "INV-001",
      status: "ISSUED",
    });
  });
});
