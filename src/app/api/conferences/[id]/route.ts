import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getConference,
  updateConference,
  deleteConference,
} from "@/lib/actions/conference";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const row = await getConference(params.id);
  if (!row) {
    return Response.json({ ok: false, error: "학회를 찾을 수 없습니다." }, { status: 404 });
  }
  return Response.json(row);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await updateConference({ id: params.id, ...body });

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await deleteConference(params.id);

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json({ ok: true });
}
