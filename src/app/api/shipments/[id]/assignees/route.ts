/**
 * 출고 단계별 담당자 — 목록 / 추가 엔드포인트.
 *
 * GET  /api/shipments/[id]/assignees           → 해당 출고의 전체 단계 담당자 목록
 * POST /api/shipments/[id]/assignees           → body: { stage, userId } 로 배정 추가
 *
 * [id] = shipmentId (Order 가 아님 — qc-portal 에서 order.shipmentId 사용).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  assignToShipment,
  listShipmentAssignees,
} from "@/lib/actions/shipment-assignee";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  try {
    const list = await listShipmentAssignees(params.id);
    return Response.json({ ok: true, data: list });
  } catch (err) {
    return Response.json(
      { ok: false, error: (err as Error).message ?? "조회 실패" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { stage, userId } = body as { stage?: string; userId?: string };

  if (!stage || !userId) {
    return Response.json(
      { ok: false, error: "stage와 userId가 필요합니다." },
      { status: 400 },
    );
  }

  const res = await assignToShipment(params.id, stage, userId);
  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }
  return Response.json(res.data);
}
