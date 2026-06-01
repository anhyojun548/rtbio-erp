import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUser, updateUser, deactivateUser } from "@/lib/actions/user";

type Ctx = { params: { id: string } };
const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const u = await getUser(params.id);
  if (!u) return Response.json({ ok: false, error: "Not Found" }, { status: 404 });
  return Response.json(u);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const res = await updateUser(params.id, body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const res = await deactivateUser(params.id);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });
  return Response.json(res.data); // { id, warning?, affectedCount }
}
