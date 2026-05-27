/**
 * Dashboard Widget — 단건 갱신/삭제.
 * 소유권 검증(`userId == session.user.id`) 필수.
 */
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

const notFound = () =>
  Response.json({ ok: false, error: "Not Found" }, { status: 404 });

const badRequest = (error: string) =>
  Response.json({ ok: false, error }, { status: 400 });

const dimField = z.number().int().min(1).max(12);
const positionField = z.number().int().min(0).max(99);

const updateSchema = z.object({
  position: positionField.optional(),
  width: dimField.optional(),
  height: dimField.optional(),
  overrideDateRange: z.string().max(50).nullable().optional(),
  config: z
    .object({})
    .passthrough()
    .nullable()
    .optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const existing = await prisma.dashboardWidget.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      parsed.error.errors[0]?.message ?? "위젯 입력이 올바르지 않습니다.",
    );
  }
  const data = parsed.data;

  await prisma.dashboardWidget.update({
    where: { id: params.id },
    data: {
      ...(data.position !== undefined && { position: data.position }),
      ...(data.width !== undefined && { width: data.width }),
      ...(data.height !== undefined && { height: data.height }),
      ...(data.overrideDateRange !== undefined && {
        overrideDateRange: data.overrideDateRange,
      }),
      ...(data.config !== undefined && {
        config: data.config ?? undefined,
      }),
    },
  });
  logAudit({
    userId: session.user.id,
    action: "DASHBOARD_WIDGET_UPDATE",
    resource: `DashboardWidget:${params.id}`,
    metadata: data,
  });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const existing = await prisma.dashboardWidget.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, preset: true },
  });
  if (!existing) return notFound();

  await prisma.dashboardWidget.delete({ where: { id: params.id } });
  logAudit({
    userId: session.user.id,
    action: "DASHBOARD_WIDGET_DELETE",
    resource: `DashboardWidget:${params.id}`,
    metadata: { preset: existing.preset },
  });
  return Response.json({ ok: true });
}
