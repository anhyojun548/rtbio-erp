import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listLedgers,
  recomputeLedger,
  recomputeLedgerMonth,
  closeMonth,
  reopenMonth,
} from "@/lib/actions/ledger";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const closingMonth = url.searchParams.get("closingMonth") ?? undefined;

  const rows = await listLedgers({
    clientId,
    closingMonth,
  });

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { action, month, clientId, reason } = body;

  if (!action) {
    return Response.json(
      { ok: false, error: "Missing action parameter" },
      { status: 400 },
    );
  }

  let res;

  switch (action) {
    case "recompute":
      if (!clientId || !month) {
        return Response.json(
          { ok: false, error: "Missing clientId or month" },
          { status: 400 },
        );
      }
      res = await recomputeLedger({ clientId, closingMonth: month });
      break;

    case "recompute_month":
      if (!month) {
        return Response.json(
          { ok: false, error: "Missing month" },
          { status: 400 },
        );
      }
      res = await recomputeLedgerMonth({ closingMonth: month });
      break;

    case "close":
      if (!clientId || !month) {
        return Response.json(
          { ok: false, error: "Missing clientId or month" },
          { status: 400 },
        );
      }
      res = await closeMonth({
        clientId,
        closingMonth: month,
        note: reason,
      });
      break;

    case "reopen":
      if (!clientId || !month) {
        return Response.json(
          { ok: false, error: "Missing clientId or month" },
          { status: 400 },
        );
      }
      if (!reason) {
        return Response.json(
          { ok: false, error: "Missing reason" },
          { status: 400 },
        );
      }
      res = await reopenMonth({
        clientId,
        closingMonth: month,
        reason,
      });
      break;

    default:
      return Response.json(
        { ok: false, error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 200 });
}
