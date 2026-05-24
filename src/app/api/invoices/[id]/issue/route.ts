import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueInvoice } from "@/lib/actions/invoice";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function POST(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await issueInvoice(params.id);

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json(res.data);
}
