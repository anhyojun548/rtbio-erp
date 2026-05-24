import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import * as ledgerActions from "@/lib/actions/ledger";

// Mock getServerSession
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

const { getServerSession } = await import("next-auth");

describe("GET /api/ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = new Request("http://localhost/api/ledger");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("returns ledgers for the given month", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", tenantId: "tenant1" },
    } as any);

    vi.spyOn(ledgerActions, "listLedgers").mockResolvedValue([
      {
        id: "ledger1",
        clientId: "client1",
        closingMonth: "2026-05",
        carryOver: 1000,
        monthlySales: 5000,
        received: 3000,
        balance: 3000,
        closedAt: null,
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "user1",
        client: { id: "client1", code: "C1", name: "Client 1" },
      },
    ] as any);

    const req = new Request("http://localhost/api/ledger?closingMonth=2026-05");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].closingMonth).toBe("2026-05");
  });

  it("passes clientId filter to listLedgers", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", tenantId: "tenant1" },
    } as any);

    const listSpy = vi.spyOn(ledgerActions, "listLedgers").mockResolvedValue([]);

    const req = new Request("http://localhost/api/ledger?clientId=client1&closingMonth=2026-05");
    await GET(req);

    expect(listSpy).toHaveBeenCalledWith({
      clientId: "client1",
      closingMonth: "2026-05",
    });
  });
});

describe("POST /api/ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = new Request("http://localhost/api/ledger", {
      method: "POST",
      body: JSON.stringify({ action: "recompute" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 for unknown action", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", tenantId: "tenant1" },
    } as any);

    const req = new Request("http://localhost/api/ledger", {
      method: "POST",
      body: JSON.stringify({ action: "unknown_action" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("handles recompute action", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", tenantId: "tenant1" },
    } as any);

    const recomputeSpy = vi.spyOn(ledgerActions, "recomputeLedger").mockResolvedValue({
      ok: true,
      data: {
        clientId: "client1",
        closingMonth: "2026-05",
        carryOver: 1000,
        monthlySales: 5000,
        received: 3000,
        balance: 3000,
      },
    });

    const req = new Request("http://localhost/api/ledger", {
      method: "POST",
      body: JSON.stringify({
        action: "recompute",
        month: "2026-05",
        clientId: "client1",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(recomputeSpy).toHaveBeenCalledWith({
      clientId: "client1",
      closingMonth: "2026-05",
    });
  });

  it("handles recompute_month action", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", tenantId: "tenant1" },
    } as any);

    const recomputeMonthSpy = vi.spyOn(ledgerActions, "recomputeLedgerMonth").mockResolvedValue({
      ok: true,
      data: {
        closingMonth: "2026-05",
        updated: 5,
        skipped: 0,
      },
    });

    const req = new Request("http://localhost/api/ledger", {
      method: "POST",
      body: JSON.stringify({
        action: "recompute_month",
        month: "2026-05",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(recomputeMonthSpy).toHaveBeenCalledWith({ closingMonth: "2026-05" });
  });

  it("handles close action", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", tenantId: "tenant1" },
    } as any);

    const closeSpy = vi.spyOn(ledgerActions, "closeMonth").mockResolvedValue({
      ok: true,
      data: {
        clientId: "client1",
        closingMonth: "2026-05",
      },
    });

    const req = new Request("http://localhost/api/ledger", {
      method: "POST",
      body: JSON.stringify({
        action: "close",
        month: "2026-05",
        clientId: "client1",
        reason: "end of month",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(closeSpy).toHaveBeenCalledWith({
      clientId: "client1",
      closingMonth: "2026-05",
      note: "end of month",
    });
  });

  it("handles reopen action", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", tenantId: "tenant1" },
    } as any);

    const reopenSpy = vi.spyOn(ledgerActions, "reopenMonth").mockResolvedValue({
      ok: true,
      data: {
        clientId: "client1",
        closingMonth: "2026-05",
      },
    });

    const req = new Request("http://localhost/api/ledger", {
      method: "POST",
      body: JSON.stringify({
        action: "reopen",
        month: "2026-05",
        clientId: "client1",
        reason: "correction needed",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(reopenSpy).toHaveBeenCalledWith({
      clientId: "client1",
      closingMonth: "2026-05",
      reason: "correction needed",
    });
  });

  it("returns error response when action fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user1", tenantId: "tenant1" },
    } as any);

    vi.spyOn(ledgerActions, "recomputeLedger").mockResolvedValue({
      ok: false,
      error: "Ledger not found",
      fieldErrors: {},
    });

    const req = new Request("http://localhost/api/ledger", {
      method: "POST",
      body: JSON.stringify({
        action: "recompute",
        month: "2026-05",
        clientId: "client1",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Ledger not found");
  });
});
