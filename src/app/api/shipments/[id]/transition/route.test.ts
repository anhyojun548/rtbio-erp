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

import { POST } from "./route";
import { getServerSession } from "next-auth";
import {
  startShipment,
  moveShipmentStage,
  holdShipment,
  resumeShipment,
} from "@/lib/actions/shipment";

const ctx = { params: { id: "sh-1" } };

beforeEach(() => vi.clearAllMocks());

const makePost = (body: object) =>
  new Request("http://x/api/shipments/sh-1/transition", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("/api/shipments/[id]/transition", () => {
  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(makePost({ to: "START" }), ctx);
    expect(res.status).toBe(401);
  });

  it("POST 알 수 없는 to → 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    const res = await POST(makePost({ to: "UNKNOWN" }), ctx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unknown transition");
  });

  it("POST START → startShipment 호출", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (startShipment as any).mockResolvedValue({
      ok: true,
      data: { shipmentId: "sh-1", stageId: "stage-1" },
    });
    const res = await POST(makePost({ to: "START" }), ctx);
    expect(res.status).toBe(200);
    expect((startShipment as any).mock.calls[0][0]).toBe("sh-1");
  });

  it("POST MOVE stageId 누락 시 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    const res = await POST(makePost({ to: "MOVE" }), ctx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("stageId");
  });

  it("POST MOVE → moveShipmentStage 호출", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (moveShipmentStage as any).mockResolvedValue({
      ok: true,
      data: { shipmentId: "sh-1", toStageId: "stage-2", completed: false },
    });
    const res = await POST(makePost({ to: "MOVE", stageId: "stage-2" }), ctx);
    expect(res.status).toBe(200);
    expect((moveShipmentStage as any).mock.calls[0][0]).toBe("sh-1");
    expect((moveShipmentStage as any).mock.calls[0][1]).toMatchObject({
      toStageId: "stage-2",
    });
  });

  it("POST HOLD → holdShipment 호출", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (holdShipment as any).mockResolvedValue({
      ok: true,
      data: { shipmentId: "sh-1" },
    });
    const res = await POST(
      makePost({ to: "HOLD", reason: "재고 부족" }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect((holdShipment as any).mock.calls[0][1]).toMatchObject({
      reason: "재고 부족",
    });
  });

  it("POST RESUME → resumeShipment 호출", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (resumeShipment as any).mockResolvedValue({
      ok: true,
      data: { shipmentId: "sh-1" },
    });
    const res = await POST(makePost({ to: "RESUME" }), ctx);
    expect(res.status).toBe(200);
    expect((resumeShipment as any).mock.calls[0][0]).toBe("sh-1");
  });
});
