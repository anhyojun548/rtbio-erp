import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listInvoices, createInvoiceFromOrder } from "@/lib/actions/invoice";

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

  const rows = await listInvoices({
    clientId: url.searchParams.get("clientId") ?? undefined,
    status: (url.searchParams.get("status") as any) ?? undefined,
    from,
    to,
    q: url.searchParams.get("q") ?? undefined,
  });

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  // createInvoiceFromOrder(orderId: string, input) — body.orderId 를 첫 인자로 전달.
  // (이전: createInvoiceFromOrder(body) 로 객체 전체를 orderId 자리에 넘겨 Prisma where 오류 → 500)
  const res = await createInvoiceFromOrder(body?.orderId, body ?? {});

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 201 });
}
