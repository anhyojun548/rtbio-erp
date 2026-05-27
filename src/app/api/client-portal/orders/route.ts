/**
 * /api/client-portal/orders
 *
 * CLIENT 발주 등록 — prototype client-portal.html 의 submitOrder() 가 호출.
 *
 * POST body: {
 *   items: [{ productId, productSizeId, qty }],
 *   shipTo: { addressId?, label?, recipient?, phone?, postalCode?, address, addressDetail?, memo? },
 *   shippingMethod?: '택배' | '방문수령' | '퀵',
 *   notes?: string,
 * }
 *
 * 반환: { ok: true, order }  (Order + items 포함)
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClientOrder } from "@/lib/actions/client-portal";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const u = session.user as { role: string; clientId: string | null };
  if (u.role !== "CLIENT" || !u.clientId) {
    return Response.json(
      { ok: false, error: "CLIENT role + clientId required" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const order = await createClientOrder(body as Parameters<typeof createClientOrder>[0]);
    return Response.json({ ok: true, order }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "발주 등록 실패";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
