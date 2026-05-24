import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/conference", () => ({
  listConferences: vi.fn(),
  createConference: vi.fn(),
  getConference: vi.fn(),
  updateConference: vi.fn(),
  deleteConference: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import { listConferences, createConference } from "@/lib/actions/conference";

beforeEach(() => vi.clearAllMocks());

describe("/api/conferences", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/conferences"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 배열 반환 + upcoming 파라미터 전달", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listConferences as any).mockResolvedValue([
      { id: "c1", name: "한국의료기기학회", startDate: new Date("2026-06-01") },
    ]);
    const res = await GET(new Request("http://x/api/conferences?upcoming=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect((listConferences as any).mock.calls[0][0]).toMatchObject({ upcoming: true });
  });

  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/conferences", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST action 실패 시 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createConference as any).mockResolvedValue({
      ok: false,
      error: "name 필수",
    });
    const res = await POST(
      new Request("http://x/api/conferences", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("name 필수");
  });

  it("POST 성공 시 201 + id", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createConference as any).mockResolvedValue({ ok: true, data: { id: "c2" } });
    const res = await POST(
      new Request("http://x/api/conferences", {
        method: "POST",
        body: JSON.stringify({ name: "테스트 학회", startDate: "2026-07-01" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "c2" });
  });
});
