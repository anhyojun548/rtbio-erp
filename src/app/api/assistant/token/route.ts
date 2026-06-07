/**
 * POST /api/assistant/token
 *
 * 로그인 세션 → 지원 챗봇용 "스코프드 토큰"(본인 권한, 10분) 발급.
 * 포털 우하단 버블이 windyflo prediction 호출 직전 호출해 overrideConfig.vars.token 으로 전달.
 *
 * 보안: 세션 사용자 본인의 userId/role/clientId 만 박는다. 다른 사용자 사칭 불가
 * (요청 본문으로 대상 지정 불가 — 항상 세션 주체).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { signAssistantToken } from "@/lib/assistant/token";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const u = session.user as {
    id: string;
    role: string;
    clientId?: string | null;
    tenantCode?: string | null;
  };
  const issued = signAssistantToken({
    userId: u.id,
    role: u.role,
    clientId: u.clientId ?? null,
    tenantCode: u.tenantCode ?? null,
  });
  if (!issued) {
    return Response.json(
      { ok: false, error: "서버 인증 시크릿 미설정" },
      { status: 500 },
    );
  }
  return Response.json({
    ok: true,
    token: issued.token,
    expiresIn: issued.expiresIn,
  });
}
