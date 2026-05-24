import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/procurement", () => ({
  listProcurementProjects: vi.fn(),
}));

import { GET } from "./route";
import { getServerSession } from "next-auth";
import { listProcurementProjects } from "@/lib/actions/procurement";

beforeEach(() => vi.clearAllMocks());

describe("/api/procurement", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/procurement"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 배열 반환 + 쿼리 파라미터 전달", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listProcurementProjects as any).mockResolvedValue([
      { id: "p1", code: "PRJ-2601-01", title: "원단 발주", category: "FABRIC", status: "IN_PRODUCTION" },
    ]);
    const res = await GET(
      new Request("http://x/api/procurement?category=FABRIC&status=IN_PRODUCTION"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].code).toBe("PRJ-2601-01");
    expect((listProcurementProjects as any).mock.calls[0][0]).toMatchObject({
      category: "FABRIC",
      status: "IN_PRODUCTION",
    });
  });
});
