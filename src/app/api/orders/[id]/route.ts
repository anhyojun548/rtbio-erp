import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrder, updateOrder } from "@/lib/actions/order";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const row = await getOrder(params.id);
  if (!row) return Response.json({ ok: false, error: "Not Found" }, { status: 404 });

  return Response.json(row);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await updateOrder(params.id, body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data);
}
