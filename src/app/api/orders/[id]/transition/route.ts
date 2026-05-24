import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  submitOrder,
  confirmOrder,
  cancelOrder,
  holdOrder,
  resumeOrder,
  rejectOrder,
} from "@/lib/actions/order";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { to, reason, note } = body as { to?: string; reason?: string; note?: string };

  let res;
  switch (to) {
    case "SUBMITTED":
      res = await submitOrder(params.id);
      break;
    case "CONFIRMED":
      res = await confirmOrder(params.id);
      break;
    case "CANCELLED":
      res = await cancelOrder(params.id, { reason: reason ?? "" });
      break;
    case "HELD":
      res = await holdOrder(params.id, { reason: reason ?? "" });
      break;
    case "RESUMED":
      res = await resumeOrder(params.id);
      break;
    case "REJECTED":
      res = await rejectOrder(params.id, { reason: reason ?? "" });
      break;
    default:
      return Response.json(
        { ok: false, error: `Unknown transition: ${to}` },
        { status: 400 },
      );
  }

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json(res.data);
}
