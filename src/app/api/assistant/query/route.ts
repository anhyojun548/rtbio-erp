/**
 * POST /api/assistant/query
 *
 * 지원 챗봇 windyflo 에이전트의 query_data 툴이 호출.
 * Body: { spec: <WidgetSpec JSON> }  (spec 은 객체 또는 직렬화 문자열)
 *
 * 보안 (핵심):
 *  1) 스코프드 토큰(Bearer)으로 인증 → 토큰에 박힌 userId/role/clientId 만 신뢰.
 *  2) **행-레벨 권한을 서버가 강제 주입** — 에이전트가 보낸 spec.permissions 는 무시하고,
 *     CLIENT 면 rowLevel='ownClientOnly'(자기 거래처만), 그 외 역할은 'none'(본인 역할 권한).
 *     → 외부 에이전트가 임의 거래처 데이터를 조회하지 못한다.
 *  3) executeWidgetSpec 은 Prisma delegate + source whitelist 만 사용(raw SQL 불가).
 *  4) 읽기 전용 — 어떤 쓰기도 하지 않는다.
 */
import { verifyAssistantToken } from "@/lib/assistant/token";
import { validateWidgetSpec } from "@/lib/widget-spec/schema";
import { executeWidgetSpec } from "@/lib/widget-spec/execute";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const tok = verifyAssistantToken(req.headers.get("authorization"));
  if (!tok) {
    return Response.json(
      { ok: false, error: "Unauthorized (assistant token)" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  let specInput: unknown =
    body && typeof body === "object" && "spec" in (body as object)
      ? (body as { spec: unknown }).spec
      : body;
  if (typeof specInput === "string") {
    try {
      specInput = JSON.parse(specInput);
    } catch {
      /* 문자열이 JSON 이 아니면 그대로 검증 단계에서 실패 처리 */
    }
  }

  const v = validateWidgetSpec(specInput);
  if (!v.ok) {
    return Response.json(
      {
        ok: false,
        error: "WidgetSpec 검증 실패",
        validationErrors: v.errors,
        hint: "data.source/field 는 /api/assistant/catalog 와 일치해야 합니다.",
      },
      { status: 400 },
    );
  }

  // ★ 행-레벨 권한 서버 강제: 에이전트가 보낸 permissions 를 신뢰하지 않는다.
  const spec = {
    ...v.spec,
    permissions: {
      ...(v.spec.permissions ?? {}),
      rowLevel:
        tok.role === "CLIENT" ? ("ownClientOnly" as const) : ("none" as const),
    },
  };

  try {
    const result = await executeWidgetSpec(spec, {
      now: new Date(),
      userId: tok.sub,
      role: tok.role,
      clientId: tok.clientId ?? undefined,
    });
    return Response.json({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      { ok: false, error: `데이터 조회 실패: ${message}` },
      { status: 400 },
    );
  }
}
