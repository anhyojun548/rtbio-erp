import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMetaAdmin } from "@/lib/team";
import { logAudit } from "@/lib/audit";
import { getTableDef } from "@/lib/db-explorer/registry";
import { updateRow } from "@/lib/db-explorer/query";

type Ctx = { params: { table: string; id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!isMetaAdmin(session.user))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const def = getTableDef(params.table);
  if (!def) return Response.json({ ok: false, error: "Unknown table" }, { status: 404 });
  if (!def.editable)
    return Response.json({ ok: false, error: "읽기 전용 테이블입니다." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const res = await updateRow(def, params.id, body, session.user.tenantId);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });

  logAudit({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    action: "DB_EXPLORER_EDIT",
    resource: `${def.model}:${params.id}`,
    metadata: { table: def.key, fields: Object.keys(body) },
  });
  return Response.json({ ok: true });
}
