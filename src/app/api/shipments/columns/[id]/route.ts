/**
 * /api/shipments/columns/[id]
 *
 * KanbanColumn 단건 수정/삭제.
 *
 * PATCH body: { label?, sortOrder?, isTerminal?, color? }
 * DELETE: 사용 중인 컬럼(연결된 Shipment 존재)은 server 가 거부.
 *
 * RBAC: OWNER/ADMIN (kanban actions 기준)
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateKanbanColumn, deleteKanbanColumn } from "@/lib/actions/kanban";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await updateKanbanColumn(params.id, body);
  if (!res.ok) {
    return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  }
  return Response.json(res.data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await deleteKanbanColumn(params.id);
  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }
  return Response.json(res.data);
}
