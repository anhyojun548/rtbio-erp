/**
 * 영업 매출 목표 + 담당자별 지표 API (영업 포털 「직원별 지표」)
 *
 *   GET  /api/exec/targets?month=YYYY-MM  — 담당자별 목표·실적·달성률
 *   POST /api/exec/targets                — 목표 업서트 {salesRepId, month, clientType, amount}
 *
 * 권한은 액션 내부 requireRole(TENANT_OWNER/ADMIN/EXEC).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listRepMetrics, upsertTarget } from "@/lib/actions/sales-target";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

const forbidden = (e: unknown) =>
  Response.json(
    { ok: false, error: (e as Error).message || "권한이 없습니다" },
    { status: 403 },
  );

/** YYYY-MM 기본값 = KST 이번 달 */
function kstThisMonth(): string {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || kstThisMonth();
  try {
    const rows = await listRepMetrics(month);
    return Response.json({ month, rows });
  } catch (e) {
    return forbidden(e);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  try {
    const res = await upsertTarget(body);
    if (!res.ok) {
      return Response.json(
        { ok: false, error: res.error, fieldErrors: (res as { fieldErrors?: unknown }).fieldErrors },
        { status: 400 },
      );
    }
    return Response.json(res.data, { status: 201 });
  } catch (e) {
    return forbidden(e);
  }
}
