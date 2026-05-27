import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listDataUsage,
  createDataUsage,
  upsertDataUsage,
} from "@/lib/actions/data-usage";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const rows = await listDataUsage({
    month: url.searchParams.get("month") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    limit: url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined,
  });

  return Response.json(rows);
}

/**
 * POST /api/data-usage
 *   - Default: create — fails on month+category 중복.
 *   - ?upsert=1 : upsert — 동일 키 존재 시 덮어쓴다.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const isUpsert = url.searchParams.get("upsert") === "1";
  const body = await req.json().catch(() => ({}));

  const res = isUpsert
    ? await upsertDataUsage(body)
    : await createDataUsage(body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 201 });
}
