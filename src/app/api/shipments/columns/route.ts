/**
 * GET /api/shipments/columns
 *
 * KanbanColumn 6단계 (접수대기/피킹/검수/포장/출고대기/출고완료) 를 sortOrder 순으로 반환.
 *
 * 용도:
 *  - prototype qc-portal.html 의 카드 이동(moveToNextStage) 가
 *    mock stage id ('barcode' 등) 대신 DB cuid 를 server 에 전달하도록 매핑 테이블 제공.
 *  - data-loader.js admin/QC branch 가 fetch 해서 window.KANBAN_DB_COLUMNS 로 노출.
 *
 * RBAC: OWNER/ADMIN/QC (shipment.listKanbanColumns action 기준).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listKanbanColumns } from "@/lib/actions/shipment";
import { createKanbanColumn } from "@/lib/actions/kanban";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const rows = await listKanbanColumns();
  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await createKanbanColumn(body);
  if (!res.ok) {
    return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  }
  return Response.json(res.data, { status: 201 });
}
