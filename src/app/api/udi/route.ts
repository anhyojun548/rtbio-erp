import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUdiReports, getUdiMonthPreview, createUdiReportFromInvoices } from "@/lib/actions/udi";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

/**
 * GET /api/udi
 *  - ?month=YYYY-MM&preview=1  => getUdiMonthPreview
 *  - default => listUdiReports
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const preview = url.searchParams.get("preview");

  if (month && preview === "1") {
    const data = await getUdiMonthPreview(month);
    return Response.json(data);
  }

  const reports = await listUdiReports();
  return Response.json(reports);
}

/**
 * POST /api/udi
 *  - Body: { reportMonth: "YYYY-MM", note?: string }
 *  - Returns: { id, itemCount, excludedCount } | error
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await createUdiReportFromInvoices(body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 201 });
}
