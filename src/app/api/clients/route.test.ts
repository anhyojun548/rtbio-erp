import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/client", () => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import { listClients, createClient } from "@/lib/actions/client";

beforeEach(() => vi.clearAllMocks());

describe("/api/clients", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/clients"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 배열 그대로", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listClients as any).mockResolvedValue([{ id: "c1", name: "X" }]);
    const res = await GET(new Request("http://x/api/clients?q=X&active=ACTIVE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "c1", name: "X" }]);
    // 쿼리 파라미터가 actions 로 전달되는지 확인
    expect((listClients as any).mock.calls[0][0]).toMatchObject({
      q: "X",
      active: "ACTIVE",
    });
  });

  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/clients", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST 성공 시 생성 데이터 201", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createClient as any).mockResolvedValue({
      ok: true,
      data: { id: "c2", code: "NEW" },
    });
    const res = await POST(
      new Request("http://x/api/clients", {
        method: "POST",
        body: JSON.stringify({ code: "NEW", name: "신규" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "c2", code: "NEW" });
  });

  it("POST validator 실패 시 400 envelope", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createClient as any).mockResolvedValue({
      ok: false,
      error: "이름 필수",
      fieldErrors: { name: ["필수"] },
    });
    const res = await POST(
      new Request("http://x/api/clients", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "이름 필수",
      fieldErrors: { name: ["필수"] },
    });
  });
});
