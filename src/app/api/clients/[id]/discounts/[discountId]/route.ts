/**
 * 거래처 카테고리별 할인율 단건 — DELETE.
 *
 * 경로: /api/clients/:id/discounts/:discountId
 *
 * 하드 삭제 (진행 주문은 확정 시점 스냅샷으로 보호됨).
 * clientId 경로 파라미터는 RESTful 일관성 — 검증은 discountId 기준 server action.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteClientDiscount } from "@/lib/actions/client-pricing";

type Ctx = { params: { id: string; discountId: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await deleteClientDiscount(params.discountId);

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json(res.data);
}
