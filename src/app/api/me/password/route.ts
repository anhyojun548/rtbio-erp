import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changeMyPassword } from "@/lib/actions/user";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await changeMyPassword(body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data);
}
