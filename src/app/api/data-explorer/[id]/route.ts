/**
 * GET    /api/data-explorer/[id] — 단건 조회
 * PATCH  /api/data-explorer/[id] — 부분 패치
 * DELETE /api/data-explorer/[id] — 단건 삭제
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/lib/actions/transaction-ledger";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const row = await getTransaction(params.id);
  if (!row) return Response.json({ ok: false, error: "Not Found" }, { status: 404 });

  return Response.json(row);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await updateTransaction(params.id, body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: (res as any).fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await deleteTransaction(params.id);

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json(res.data);
}
