import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
import { getServerSession } from "next-auth";
import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://t/api/dashboard/widgets/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dashboard/widgets/ai", () => {
  beforeEach(() => vi.clearAllMocks());

  it("세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await POST(req({ message: "매출" }))).status).toBe(401);
  });
  it("빈 메시지 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    expect((await POST(req({ message: "   " }))).status).toBe(400);
  });
  it("정상 메시지 → 200 mode=suggest + suggestions", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const res = await POST(req({ message: "이번 달 거래처별 매출" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.mode).toBe("suggest");
    expect(j.suggestions[0].key).toBe("list_top_clients");
  });
});
