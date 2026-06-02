import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMetaAdmin } from "@/lib/team";
import { DB_TABLES } from "@/lib/db-explorer/registry";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!isMetaAdmin(session.user))
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return Response.json(
    DB_TABLES.map((t) => ({ key: t.key, label: t.label, group: t.group, editable: t.editable })),
  );
}
