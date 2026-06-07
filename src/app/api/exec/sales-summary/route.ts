/**
 * 영업 대시보드 매출 요약 API
 *   GET /api/exec/sales-summary[?forUserId=...]
 *     - 월/주간/일 매출, 대리점/병원 분리, 목표 대비, 최근 7일 추이
 *     - EXEC = 본인 / ADMIN·OWNER = 팀 전체(또는 forUserId 그 담당자)
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExecSalesSummary } from "@/lib/actions/exec-dashboard";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  try {
    const summary = await getExecSalesSummary({
      forUserId: url.searchParams.get("forUserId") ?? undefined,
    });
    return Response.json(summary);
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message || "조회 실패" },
      { status: 403 },
    );
  }
}
