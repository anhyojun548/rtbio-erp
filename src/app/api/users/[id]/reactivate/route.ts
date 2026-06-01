import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reactivateUser } from "@/lib/actions/user";

type Ctx = { params: { id: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const res = await reactivateUser(params.id);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });
  return Response.json(res.data); // { id }
}
