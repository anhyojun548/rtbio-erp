/**
 * 거래처 배송지 컬렉션 — GET (목록), POST (생성).
 *
 * 경로: /api/clients/:id/addresses
 *
 * - GET: 활성 배송지 목록 (isDefault desc → createdAt asc)
 * - POST: 새 배송지 생성. body 는 addressCreateSchema 와 일치.
 *         첫 배송지이거나 isDefault=true 면 자동으로 기본 지정 (server action 위임).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listAddresses, createAddress } from "@/lib/actions/client-address";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const rows = await listAddresses(params.id);
  return Response.json(rows);
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await createAddress(params.id, body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 201 });
}
