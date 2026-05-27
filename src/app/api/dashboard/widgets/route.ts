/**
 * Dashboard Widget Sync — prototype (`public/portals/js/widget-dashboard.js`) ↔ DB.
 *
 * 프로토타입은 자체 preset 키 집합(`monthly_sales`, `weekly_sales`, ...)을 쓰므로
 * 여기서는 strict preset validator (kpi_, list_ 류) 를 강제하지 않는다.
 * 기본 인증만 통과하면 자신의 layout 을 자유롭게 저장/조회한다.
 *
 * 모델 매핑:
 *  - preset           : prototype.preset (예: "monthly_sales")
 *  - position         : 화면 인덱스 (saveDashboard idx)
 *  - width / height   : GridStack w / h
 *  - overrideDateRange: prototype.dateOverride (예: "today" / null)
 *  - config (Json?)   : { x, y, title, type } GridStack 좌표 + 표시 메타
 */
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

const badRequest = (error: string) =>
  Response.json({ ok: false, error }, { status: 400 });

// 프로토타입 호환 — preset 은 자유 문자열(1~100자), 검증은 길이만.
const presetField = z.string().trim().min(1).max(100);
const dimField = z.number().int().min(1).max(12);
const positionField = z.number().int().min(0).max(99);

const configField = z
  .object({
    x: z.number().int().min(0).max(99).optional(),
    y: z.number().int().min(0).max(99).optional(),
    title: z.string().max(200).optional(),
    type: z.string().max(50).optional(),
  })
  .passthrough()
  .optional();

const addWidgetSchema = z.object({
  preset: presetField,
  position: positionField.optional(),
  width: dimField.optional(),
  height: dimField.optional(),
  overrideDateRange: z.string().max(50).nullable().optional(),
  config: configField,
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const rows = await prisma.dashboardWidget.findMany({
    where: { userId: session.user.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return Response.json(
    rows.map((w) => ({
      id: w.id,
      preset: w.preset,
      position: w.position,
      width: w.width,
      height: w.height,
      overrideDateRange: w.overrideDateRange,
      config: w.config ?? null,
    })),
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = addWidgetSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      parsed.error.errors[0]?.message ?? "위젯 입력이 올바르지 않습니다.",
    );
  }
  const { preset, position, width, height, overrideDateRange, config } =
    parsed.data;

  // position 생략 → 끝에 append
  let finalPosition = position;
  if (finalPosition === undefined) {
    const last = await prisma.dashboardWidget.findFirst({
      where: { userId: session.user.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    finalPosition = (last?.position ?? -1) + 1;
  }

  const created = await prisma.dashboardWidget.create({
    data: {
      userId: session.user.id,
      preset,
      position: finalPosition,
      width: width ?? 6,
      height: height ?? 4,
      overrideDateRange: overrideDateRange ?? null,
      config: (config ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true },
  });
  logAudit({
    userId: session.user.id,
    action: "DASHBOARD_WIDGET_CREATE",
    resource: `DashboardWidget:${created.id}`,
    metadata: { preset, position: finalPosition },
  });
  return Response.json({ ok: true, id: created.id }, { status: 201 });
}
