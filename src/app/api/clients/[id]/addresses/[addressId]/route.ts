/**
 * 거래처 배송지 단건 — PATCH (수정), DELETE (소프트 삭제).
 *
 * 경로: /api/clients/:id/addresses/:addressId
 *
 * - PATCH: 부분 수정 (addressUpdateSchema). isDefault=true 전환 시 기존 기본값 자동 해제.
 * - DELETE: soft delete (active=false). 기본 배송지였다면 가장 오래된 활성 배송지 자동 승격.
 *
 * Note: clientId 경로 파라미터는 RESTful 일관성을 위해 남겨두지만,
 *       실제 권한·소유권 검증은 addressId 기준 server action 이 수행.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateAddress, deleteAddress } from "@/lib/actions/client-address";

type Ctx = { params: { id: string; addressId: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await updateAddress(params.addressId, body);

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

  const res = await deleteAddress(params.addressId);

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json(res.data);
}
