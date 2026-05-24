import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listPayments, recordPayment } from "@/lib/actions/payment";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from")!)
    : undefined;
  const to = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to")!)
    : undefined;

  const rows = await listPayments({
    clientId: url.searchParams.get("clientId") ?? undefined,
    status: (url.searchParams.get("status") as any) ?? undefined,
    from,
    to,
  });

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await recordPayment(body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 201 });
}
