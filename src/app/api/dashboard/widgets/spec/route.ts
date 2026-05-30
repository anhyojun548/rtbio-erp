/**
 * POST /api/dashboard/widgets/spec
 *
 * windyflo(LLM) agent 의 메인 tool — full WidgetSpec JSON 을 받아 저장.
 *
 * 처리:
 *  1. validateWidgetSpec — Zod 검증, 실패 시 LLM 교정 힌트 반환 (어떤 필드가 왜 틀렸는지)
 *  2. dry-run — executeWidgetSpec 을 실제 실행해 query 가능 여부 확인 (LLM 이 잘못된 filter/field 쓰면 여기서 잡힘)
 *  3. 저장 — DashboardWidget.config 에 full spec 보존 (preset='spec:custom')
 *
 * 렌더 시: config.spec 이 있으면 executeWidgetSpec 로 실시간 데이터 계산.
 *
 * GET ?dryRun=1 형태가 아니라, body.dryRunOnly=true 면 저장 없이 검증+실행 결과만 반환
 * (windyflo 가 미리보기 시 사용).
 *
 * RBAC: 인증 사용자 (자기 대시보드)
 */
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { validateWidgetSpec } from "@/lib/widget-spec/schema";
import { executeWidgetSpec } from "@/lib/widget-spec/execute";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();
  const user = session.user as {
    id: string;
    role: string;
    clientId?: string | null;
  };

  const body = await req.json().catch(() => null);
  const dryRunOnly = body && typeof body === "object" && body.dryRunOnly === true;
  const specInput = body && typeof body === "object" && body.spec ? body.spec : body;

  // 1) Zod 검증 — 실패 시 LLM 교정 힌트
  const v = validateWidgetSpec(specInput);
  if (!v.ok) {
    return Response.json(
      {
        ok: false,
        error: "WidgetSpec 검증 실패",
        validationErrors: v.errors, // [{ path, message, hint }]
        docs: "/api/dashboard/widget-schema 와 /api/dashboard/data-catalog 참고",
      },
      { status: 400 },
    );
  }
  const spec = v.spec;

  // 2) dry-run — 실제 query 가능 여부 (잘못된 source/field/filter 잡기)
  let preview: unknown = null;
  try {
    preview = await executeWidgetSpec(spec, {
      now: new Date(),
      userId: user.id,
      role: user.role,
      clientId: user.clientId ?? undefined,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        ok: false,
        error: `위젯 데이터 조회 실패 (dry-run): ${message}`,
        hint: "data.source/field/filter 가 /api/dashboard/data-catalog 와 일치하는지 확인하세요.",
      },
      { status: 400 },
    );
  }

  // dryRunOnly = 저장 없이 미리보기만
  if (dryRunOnly) {
    return Response.json({ ok: true, dryRun: true, spec, preview });
  }

  // 3) 저장 — config 에 full spec 보존
  const last = await prisma.dashboardWidget.findFirst({
    where: { userId: user.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const created = await prisma.dashboardWidget.create({
    data: {
      userId: user.id,
      preset: "spec:custom", // spec-based 위젯 마커
      position,
      width: spec.layout?.w ?? 3,
      height: spec.layout?.h ?? 2,
      overrideDateRange: null,
      config: { spec } as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  logAudit({
    userId: user.id,
    action: "DASHBOARD_WIDGET_SPEC_CREATE",
    resource: `DashboardWidget:${created.id}`,
    metadata: {
      title: spec.title,
      kind: spec.kind,
      source: spec.data.source,
      llmPrompt: spec.llm?.userPrompt,
      llmBy: spec.llm?.createdBy,
    },
  });

  return Response.json({ ok: true, id: created.id, spec, preview }, { status: 201 });
}
