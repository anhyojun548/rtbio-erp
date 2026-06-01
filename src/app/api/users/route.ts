import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers, createUser } from "@/lib/actions/user";

const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const url = new URL(req.url);
  const rows = await listUsers({
    role: url.searchParams.get("role") ?? undefined,
    active: url.searchParams.get("active") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const res = await createUser(body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data, { status: 201 });
}
