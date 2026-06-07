/**
 * GET /api/dashboard/data-catalog
 *
 * windyflo(LLM) agent 의 tool — "어떤 데이터·필드·집계가 가능한가" 를 알려준다.
 * 카탈로그 본문은 `@/lib/widget-spec/data-catalog` 에서 단일 관리(지원 챗봇과 공유).
 *
 * RBAC: 인증된 사용자 (위젯 만들 수 있는 역할)
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildCatalogResponse } from "@/lib/widget-spec/data-catalog";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  return Response.json(buildCatalogResponse());
}
