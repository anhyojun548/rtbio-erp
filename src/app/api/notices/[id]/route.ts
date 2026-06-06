import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteNotice, updateNotice } from "@/lib/actions/notice";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

// 2026-06: 공지 편집 — title/body/priority/pinned/expiresAt 만 수정 가능
// (target/recipients 는 불변. updateNoticeSchema 가 강제)
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await updateNotice({ ...body, id: params.id });

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

  const res = await deleteNotice(params.id);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error },
      { status: 400 },
    );
  }

  return Response.json(res.data);
}
