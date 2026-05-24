import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/notice", () => ({
  listNotices: vi.fn(),
  createNotice: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import { listNotices, createNotice } from "@/lib/actions/notice";

beforeEach(() => vi.clearAllMocks());

describe("/api/notices", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/notices"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 배열 그대로", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listNotices as any).mockResolvedValue([
      { id: "n1", title: "공지1", createdByTeam: "경영지원팀" },
    ]);
    const res = await GET(new Request("http://x/api/notices?team=경영지원팀"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: "n1", title: "공지1", createdByTeam: "경영지원팀" },
    ]);
    // 쿼리 파라미터가 actions 로 전달되는지 확인
    expect((listNotices as any).mock.calls[0][0]).toMatchObject({
      authorTeam: "경영지원팀",
    });
  });

  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/notices", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST authorTeam 누락 시 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    const res = await POST(
      new Request("http://x/api/notices", {
        method: "POST",
        body: JSON.stringify({ title: "테스트" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("authorTeam 필수");
  });

  it("POST 성공 시 생성 데이터 201", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createNotice as any).mockResolvedValue({
      ok: true,
      data: { id: "n2" },
    });
    const res = await POST(
      new Request("http://x/api/notices", {
        method: "POST",
        body: JSON.stringify({
          authorTeam: "경영지원팀",
          title: "신규 공지",
          body: "내용",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "n2" });
  });

  it("POST validator 실패 시 400 envelope", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createNotice as any).mockResolvedValue({
      ok: false,
      error: "제목 필수",
      fieldErrors: { title: ["필수"] },
    });
    const res = await POST(
      new Request("http://x/api/notices", {
        method: "POST",
        body: JSON.stringify({
          authorTeam: "경영지원팀",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "제목 필수",
      fieldErrors: { title: ["필수"] },
    });
  });
});
