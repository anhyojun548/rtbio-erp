/**
 * POST /api/dashboard/widgets/ai — 인앱 AI 위젯 입구.
 * 자연어 메시지를 받아 위젯을 "제안"한다(생성하지 않음 — 저장은 기존
 * POST /api/dashboard/widgets/spec 가 담당).
 *  - 지금: 로컬 매처(suggestWidgets) → 가장 비슷한 prefab top-3 (mode="suggest")
 *  - 나중: env WINDYFLO_PREDICTION_URL 설정 시 windyflo 프록시 → spec (mode="spec") [후속 구현]
 * 인증: NextAuth 세션(인앱 로그인 사용자). 키/URL 은 서버 env 전용.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { suggestWidgets } from "@/lib/widget-spec/suggest";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const message =
    body && typeof body === "object" && typeof body.message === "string"
      ? body.message.trim()
      : "";
  if (!message) {
    return Response.json({ ok: false, error: "메시지를 입력하세요" }, { status: 400 });
  }
  if (message.length > 500) {
    return Response.json(
      { ok: false, error: "메시지가 너무 깁니다 (최대 500자)" },
      { status: 400 },
    );
  }

  // ── windyflo 연결 심(seam) — env 설정 시 그 챗플로우로 프록시(실제 프록시는 후속) ──
  if (process.env.WINDYFLO_PREDICTION_URL) {
    return Response.json(
      { ok: false, error: "windyflo 연동은 준비 중입니다." },
      { status: 503 },
    );
  }

  // ── 지금 엔진: 로컬 템플릿 매처 ──
  const suggestions = suggestWidgets(message, 3);
  const reply = suggestions.length
    ? "이런 위젯은 어때요? 미리보기 후 추가할 수 있어요."
    : "딱 맞는 템플릿을 못 찾았어요. 갤러리에서 고르거나 '직접 만들기'로 만들어 보세요.";
  return Response.json({ ok: true, mode: "suggest", reply, suggestions });
}
