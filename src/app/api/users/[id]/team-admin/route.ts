import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toggleTeamAdmin } from "@/lib/actions/user";
import { teamAdminToggleSchema } from "@/lib/validators/user";

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = teamAdminToggleSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "grant(boolean) 필요" }, { status: 400 });
  const res = await toggleTeamAdmin(params.id, parsed.data.grant);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });
  return Response.json(res.data);
}
