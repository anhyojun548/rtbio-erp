import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listShipmentHistory } from "@/lib/actions/shipment";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const rows = await listShipmentHistory({
    clientId: url.searchParams.get("clientId") ?? undefined,
    from: url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined,
    to: url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined,
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });

  return Response.json(rows);
}
