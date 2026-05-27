/**
 * 거래처 제품별 고정가 단건 — DELETE.
 *
 * 경로: /api/clients/:id/fixed-prices/:priceId
 *
 * 하드 삭제 (진행 주문은 확정 시점 스냅샷으로 보호됨).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteClientFixedPrice } from "@/lib/actions/client-pricing";

type Ctx = { params: { id: string; priceId: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await deleteClientFixedPrice(params.priceId);

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json(res.data);
}
