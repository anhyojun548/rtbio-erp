import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMetaAdmin } from "@/lib/team";
import { getTableDef } from "@/lib/db-explorer/registry";
import { queryTable } from "@/lib/db-explorer/query";

type Ctx = { params: { table: string } };

export async function GET(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!isMetaAdmin(session.user))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const def = getTableDef(params.table);
  if (!def) return Response.json({ ok: false, error: "Unknown table" }, { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const q = url.searchParams.get("q") ?? undefined;

  const result = await queryTable(def, {
    q,
    limit,
    offset,
    tenantId: session.user.tenantId,
  });
  return Response.json({
    ok: true,
    ...result,
    editable: def.editable,
    editableFields: def.editableFields ?? null,
    pkField: def.pkField,
  });
}
