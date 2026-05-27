/**
 * 거래처 카테고리별 할인율 — GET (목록), POST (upsert).
 *
 * 경로: /api/clients/:id/discounts
 *
 * - GET: ClientDiscount 행 목록 (category asc).
 * - POST: upsert (clientId + category 복합 unique 기준).
 *         body: { category, discountRate, note? } — clientDiscountUpsertSchema.
 *         50% 이상 할인율은 TENANT_OWNER 만 저장 가능 (server action 강제).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listClientDiscounts,
  upsertClientDiscount,
} from "@/lib/actions/client-pricing";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const rows = await listClientDiscounts(params.id);
  return Response.json(rows);
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await upsertClientDiscount(params.id, body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data);
}
