import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUdiReport, deleteUdiReport } from "@/lib/actions/udi";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

/**
 * GET /api/udi/[id]
 *  - Returns full UdiReport with items
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const report = await getUdiReport(params.id);
  if (!report) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return Response.json(report);
}

/**
 * DELETE /api/udi/[id]
 *  - DRAFT 상태만 삭제 가능
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const res = await deleteUdiReport(params.id);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error },
      { status: 400 }
    );
  }

  return Response.json(res.data);
}
