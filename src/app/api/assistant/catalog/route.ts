/**
 * GET /api/assistant/catalog
 *
 * 지원 챗봇 windyflo 에이전트의 data_catalog 툴이 호출.
 * 스코프드 토큰(Bearer)으로 인증 → 데이터 카탈로그(메타데이터)만 반환.
 * 카탈로그는 사용자별 데이터가 아닌 정적 스키마 메타라 권한 분기 없음.
 */
import { verifyAssistantToken } from "@/lib/assistant/token";
import { buildCatalogResponse } from "@/lib/widget-spec/data-catalog";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const tok = verifyAssistantToken(req.headers.get("authorization"));
  if (!tok) {
    return Response.json(
      { ok: false, error: "Unauthorized (assistant token)" },
      { status: 401 },
    );
  }
  return Response.json(buildCatalogResponse());
}
