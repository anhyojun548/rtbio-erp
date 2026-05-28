/**
 * GET /api/dashboard/widgets/[id]/data
 *
 * spec-based 위젯의 실시간 데이터 조회.
 *  1. 소유권 검증 (userId == session.user.id)
 *  2. config.spec 추출 → 없으면 "not a spec widget" (prototype 단순 위젯)
 *  3. validateWidgetSpec → executeWidgetSpec(spec, ctx) → WidgetResult 반환
 *
 * ctx = { now, userId, role, clientId } (session 기반).
 * 렌더러(widget-dashboard.js)가 spec 위젯마다 이 endpoint 를 polling/refresh 한다.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateWidgetSpec } from "@/lib/widget-spec/schema";
import { executeWidgetSpec } from "@/lib/widget-spec/execute";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

const notFound = (error: string) =>
  Response.json({ ok: false, error }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();
  const user = session.user as {
    id: string;
    role: string;
    clientId?: string | null;
  };

  // 소유권 검증 — 본인 위젯만
  const widget = await prisma.dashboardWidget.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, config: true },
  });
  if (!widget) return notFound("Not Found");

  // config.spec 추출 (prototype 단순 위젯은 spec 없음)
  const config = widget.config as { spec?: unknown } | null;
  const specInput = config?.spec;
  if (!specInput) {
    return notFound("not a spec widget");
  }

  // spec 검증 (저장 후 schema 가 바뀌었을 수도 있어 방어적으로 재검증)
  const v = validateWidgetSpec(specInput);
  if (!v.ok) {
    return Response.json(
      { ok: false, error: "WidgetSpec 검증 실패", validationErrors: v.errors },
      { status: 400 },
    );
  }

  try {
    const result = await executeWidgetSpec(v.spec, {
      now: new Date(),
      userId: user.id,
      role: user.role,
      clientId: user.clientId ?? undefined,
    });
    return Response.json({
      ok: true,
      kind: v.spec.kind,
      title: v.spec.title,
      subtitle: v.spec.subtitle ?? null,
      format: v.spec.format ?? null,
      style: v.spec.style ?? null,
      comparison: v.spec.comparison ?? null,
      action: v.spec.action ?? null,
      result,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      { ok: false, error: `위젯 데이터 조회 실패: ${message}` },
      { status: 400 },
    );
  }
}
