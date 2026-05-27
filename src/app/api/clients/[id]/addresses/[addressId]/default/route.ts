/**
 * 거래처 배송지 기본 지정 — POST.
 *
 * 경로: /api/clients/:id/addresses/:addressId/default
 *
 * 같은 거래처의 기존 기본 배송지는 자동 해제 (server action 트랜잭션).
 * 비활성(soft-deleted) 배송지에는 적용 불가.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setDefaultAddress } from "@/lib/actions/client-address";

type Ctx = { params: { id: string; addressId: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function POST(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await setDefaultAddress(params.addressId);

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json(res.data);
}
