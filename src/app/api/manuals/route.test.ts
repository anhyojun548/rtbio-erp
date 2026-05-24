import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/quality-document", () => ({
  listQualityDocuments: vi.fn(),
}));

import { GET } from "./route";
import { getServerSession } from "next-auth";
import { listQualityDocuments } from "@/lib/actions/quality-document";

beforeEach(() => vi.clearAllMocks());

describe("/api/manuals", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/manuals"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 배열 반환 + 쿼리 파라미터 전달", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listQualityDocuments as any).mockResolvedValue([
      { id: "d1", code: "QP-001", title: "품질 매뉴얼", kind: "MANUAL" },
    ]);
    const res = await GET(
      new Request("http://x/api/manuals?kind=MANUAL&q=품질"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].code).toBe("QP-001");
    expect((listQualityDocuments as any).mock.calls[0][0]).toMatchObject({
      kind: "MANUAL",
      q: "품질",
    });
  });
});
