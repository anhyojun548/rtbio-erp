import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSalesJournal } from "@/lib/actions/sales-journal";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  try {
    const res = await getSalesJournal({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      clientId: url.searchParams.get("clientId") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return Response.json(res);
  } catch (e) {
    // requireRole 권한 거부 등
    return Response.json(
      { ok: false, error: (e as Error).message || "조회 실패" },
      { status: 403 },
    );
  }
}
