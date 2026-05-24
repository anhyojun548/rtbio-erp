import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvoice } from "@/lib/actions/invoice";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const row = await getInvoice(params.id);
  if (!row) return Response.json({ ok: false, error: "Not Found" }, { status: 404 });

  return Response.json(row);
}
