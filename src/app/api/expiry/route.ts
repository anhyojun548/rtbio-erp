import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listExpiryLots,
  listExpiringSoon,
  createExpiryLot,
} from "@/lib/actions/expiry";
import type { ExpiryStage } from "@/lib/validators/expiry";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);

  // ?soon=1 → 만료 임박 로트 반환
  if (url.searchParams.get("soon") === "1") {
    const days = url.searchParams.get("days")
      ? Number(url.searchParams.get("days"))
      : 90;
    const rows = await listExpiringSoon(days);
    return Response.json(rows);
  }

  const rows = await listExpiryLots({
    productSizeId: url.searchParams.get("productSizeId") ?? undefined,
    productId: url.searchParams.get("productId") ?? undefined,
    stage: (url.searchParams.get("stage") as ExpiryStage | "ALL") ?? undefined,
    includeEmpty: url.searchParams.get("includeEmpty") === "1",
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const res = await createExpiryLot(body);

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 201 });
}
