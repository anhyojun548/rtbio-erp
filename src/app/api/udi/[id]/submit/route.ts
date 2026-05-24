import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitUdiReport } from "@/lib/actions/udi";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

/**
 * POST /api/udi/[id]/submit
 *  - No request body required
 *  - Transitions DRAFT → ACCEPTED, generates receiptNo
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await submitUdiReport(params.id);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error },
      { status: 400 }
    );
  }

  return Response.json(res.data);
}
