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

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import {
  listExpiryLots,
  listExpiringSoon,
  createExpiryLot,
} from "@/lib/actions/expiry";

beforeEach(() => vi.clearAllMocks());

describe("/api/expiry", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/expiry"));
    expect(res.status).toBe(401);
  });

  it("GET ?soon=1 → listExpiringSoon 호출", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listExpiringSoon as any).mockResolvedValue([
      { id: "lot1", lotNumber: "L001", expiryDate: new Date("2026-06-01") },
    ]);
    const res = await GET(new Request("http://x/api/expiry?soon=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect((listExpiringSoon as any).mock.calls[0][0]).toBe(90);
  });

  it("GET 기본 → listExpiryLots 호출 + stage 파라미터 전달", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listExpiryLots as any).mockResolvedValue([]);
    const res = await GET(new Request("http://x/api/expiry?stage=EXPIRED"));
    expect(res.status).toBe(200);
    expect((listExpiryLots as any).mock.calls[0][0]).toMatchObject({
      stage: "EXPIRED",
    });
  });

  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/expiry", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST action 실패 시 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createExpiryLot as any).mockResolvedValue({
      ok: false,
      error: "이미 등록된 로트 번호입니다",
    });
    const res = await POST(
      new Request("http://x/api/expiry", {
        method: "POST",
        body: JSON.stringify({ productSizeId: "sz1", lotNumber: "L001" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("로트 번호");
  });

  it("POST 성공 시 201 + id, lotNumber", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createExpiryLot as any).mockResolvedValue({
      ok: true,
      data: { id: "lot2", lotNumber: "L002" },
    });
    const res = await POST(
      new Request("http://x/api/expiry", {
        method: "POST",
        body: JSON.stringify({
          productSizeId: "sz1",
          lotNumber: "L002",
          expiryDate: "2027-01-01",
          quantity: 100,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "lot2", lotNumber: "L002" });
  });
});
