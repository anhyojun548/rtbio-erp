import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/shipment", () => ({
  listShipmentHistory: vi.fn(),
  startShipment: vi.fn(),
  moveShipmentStage: vi.fn(),
  holdShipment: vi.fn(),
  resumeShipment: vi.fn(),
}));

import { GET } from "./route";
import { getServerSession } from "next-auth";
import { listShipmentHistory } from "@/lib/actions/shipment";

beforeEach(() => vi.clearAllMocks());

describe("/api/shipments", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/shipments"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 완료 출고 목록 반환 + 필터 파라미터 전달", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listShipmentHistory as any).mockResolvedValue([
      { id: "sh1", completedAt: new Date("2026-04-20") },
    ]);
    const res = await GET(
      new Request("http://x/api/shipments?clientId=c1&from=2026-04-01&to=2026-04-30"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect((listShipmentHistory as any).mock.calls[0][0]).toMatchObject({
      clientId: "c1",
    });
  });
});
