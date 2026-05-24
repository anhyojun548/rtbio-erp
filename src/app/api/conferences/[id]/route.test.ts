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

import { GET, PATCH, DELETE } from "./route";
import { getServerSession } from "next-auth";
import {
  getConference,
  updateConference,
  deleteConference,
} from "@/lib/actions/conference";

const ctx = { params: { id: "conf-1" } };

beforeEach(() => vi.clearAllMocks());

describe("/api/conferences/[id]", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/conferences/conf-1"), ctx);
    expect(res.status).toBe(401);
  });

  it("GET 없는 ID → 404", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (getConference as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/conferences/conf-1"), ctx);
    expect(res.status).toBe(404);
  });

  it("GET 성공 시 학회 데이터 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (getConference as any).mockResolvedValue({
      id: "conf-1",
      name: "한국의료기기학회",
      visitors: [],
    });
    const res = await GET(new Request("http://x/api/conferences/conf-1"), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("conf-1");
  });

  it("PATCH 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await PATCH(
      new Request("http://x/api/conferences/conf-1", {
        method: "PATCH",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("PATCH 성공 시 데이터 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (updateConference as any).mockResolvedValue({
      ok: true,
      data: { id: "conf-1" },
    });
    const res = await PATCH(
      new Request("http://x/api/conferences/conf-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "업데이트 학회" }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "conf-1" });
  });

  it("DELETE 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://x/api/conferences/conf-1", { method: "DELETE" }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("DELETE 성공 시 ok:true", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (deleteConference as any).mockResolvedValue({ ok: true, data: null });
    const res = await DELETE(
      new Request("http://x/api/conferences/conf-1", { method: "DELETE" }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
