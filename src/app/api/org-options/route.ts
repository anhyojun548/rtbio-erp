import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listOrgOptions, createOrgOption } from "@/lib/actions/org-option";

const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const url = new URL(req.url);
  const rows = await listOrgOptions(url.searchParams.get("kind") ?? undefined);
  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const res = await createOrgOption(body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data, { status: 201 });
}
