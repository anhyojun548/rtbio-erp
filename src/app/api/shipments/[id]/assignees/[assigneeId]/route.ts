/**
 * 출고 단계별 담당자 — 단건 해제.
 *
 * DELETE /api/shipments/[id]/assignees/[assigneeId]
 *
 * [id] = shipmentId (소유권 검증은 action 함수가 ShipmentAssignee 조회로 처리).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { removeAssignee } from "@/lib/actions/shipment-assignee";

type Ctx = { params: { id: string; assigneeId: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await removeAssignee(params.assigneeId);
  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }
  return Response.json({ ok: true, ...res.data });
}
