/**
 * /api/orders/[id]/items/[itemId]
 *
 * 발주 라인 수정/삭제 — admin 매입매출장의 발주 수정 모달에서 호출.
 *
 * PATCH: 수량 변경 (가격 스냅샷 재계산은 server-side)
 *   body: { quantity: number, note?: string }
 *
 * DELETE: 라인 삭제
 *
 * RBAC: OWNER/ADMIN/QC (updateOrderItem/deleteOrderItem action 기준)
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateOrderItem, deleteOrderItem } from "@/lib/actions/order";

type Ctx = { params: { id: string; itemId: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  // updateOrderItem(itemId, { quantity }) — orderId 는 server 가 item.orderId 로 검증
  const res = await updateOrderItem(params.itemId, {
    quantity: body.quantity,
  });

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }
  return Response.json(res.data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await deleteOrderItem(params.itemId);

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }
  return Response.json(res.data);
}
