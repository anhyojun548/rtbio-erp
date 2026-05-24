/**
 * GET  /api/data-explorer  — 목록 + 집계 통합 조회
 * POST /api/data-explorer  — 단건(또는 rows 배열) 추가
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listTransactions,
  aggregateTransactions,
  bulkInsertTransactions,
} from "@/lib/actions/transaction-ledger";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const filter = {
    q:           url.searchParams.get("q")           ?? undefined,
    kind:        (url.searchParams.get("kind") as any) ?? undefined,
    clientCode:  url.searchParams.get("clientCode")  ?? undefined,
    productCode: url.searchParams.get("productCode") ?? undefined,
    voucherNo:   url.searchParams.get("voucherNo")   ?? undefined,
    from: url.searchParams.get("from")
      ? new Date(url.searchParams.get("from")!)
      : undefined,
    to: url.searchParams.get("to")
      ? new Date(url.searchParams.get("to")!)
      : undefined,
    limit:  Number(url.searchParams.get("limit")  ?? 100),
    offset: Number(url.searchParams.get("offset") ?? 0),
  };

  const [list, agg] = await Promise.all([
    listTransactions(filter),
    aggregateTransactions(filter),
  ]);

  return Response.json({ ...list, aggregates: agg });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : [body];
  const importSource: string = body.importSource ?? "api";

  const res = await bulkInsertTransactions(rows, importSource);
  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: (res as any).fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 201 });
}
