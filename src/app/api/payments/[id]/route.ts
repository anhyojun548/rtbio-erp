import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelPayment } from "@/lib/actions/payment";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function DELETE(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await cancelPayment(params.id, body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data);
}
