import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listNotices, createNotice } from "@/lib/actions/notice";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const rows = await listNotices({
    authorTeam: (url.searchParams.get("team") as any) ?? undefined,
    target: (url.searchParams.get("target") as any) ?? undefined,
    priority: (url.searchParams.get("priority") as any) ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { authorTeam, ...rest } = body;

  if (!authorTeam) {
    return Response.json(
      { ok: false, error: "authorTeam 필수" },
      { status: 400 },
    );
  }

  const res = await createNotice(authorTeam, rest);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 201 });
}
