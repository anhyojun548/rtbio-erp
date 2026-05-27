/**
 * 거래처 제품별 고정가 — GET (목록), POST (upsert).
 *
 * 경로: /api/clients/:id/fixed-prices
 *
 * - GET: ClientFixedPrice 행 목록 (제품 코드/명/basePrice include).
 * - POST: upsert (clientId + productId 복합 unique 기준).
 *         body: { productId, fixedPrice, note? } — clientFixedPriceUpsertSchema.
 *         fixedPrice=0 허용 (무상공급, 감사로그에 isFree=true 기록).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listClientFixedPrices,
  upsertClientFixedPrice,
} from "@/lib/actions/client-pricing";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const rows = await listClientFixedPrices(params.id);
  return Response.json(rows);
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await upsertClientFixedPrice(params.id, body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data);
}
