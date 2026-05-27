/**
 * Dashboard Widget — bulk replace (전체 deleteMany + createMany).
 *
 * GridStack onChange 가 잦으므로 prototype 측에서 3초 debounce 후 호출한다.
 * 단일 트랜잭션 안에서 기존 행 삭제 → 신규 행 일괄 생성으로 무결성 보장.
 *
 * Body: { items: [{ preset, position, width, height, overrideDateRange?, config? }, ...] }
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

const itemSchema = z.object({
  preset: z.string().trim().min(1).max(100),
  position: z.number().int().min(0).max(99),
  width: z.number().int().min(1).max(12),
  height: z.number().int().min(1).max(12),
  overrideDateRange: z.string().max(50).nullable().optional(),
  config: z
    .object({
      x: z.number().int().min(0).max(99).optional(),
      y: z.number().int().min(0).max(99).optional(),
      title: z.string().max(200).optional(),
      type: z.string().max(50).optional(),
    })
    .passthrough()
    .optional(),
});

const bulkSchema = z.object({
  items: z.array(itemSchema).min(0).max(50),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      parsed.error.errors[0]?.message ?? "입력이 올바르지 않습니다.",
    );
  }
  const { items } = parsed.data;
  const userId = session.user.id;

  await prisma.$transaction(async (tx) => {
    await tx.dashboardWidget.deleteMany({ where: { userId } });
    if (items.length > 0) {
      // createMany 는 Json 타입에 대해 일부 환경에서 제약이 있을 수 있어
      // 안전하게 per-row create.
      for (const it of items) {
        await tx.dashboardWidget.create({
          data: {
            userId,
            preset: it.preset,
            position: it.position,
            width: it.width,
            height: it.height,
            overrideDateRange: it.overrideDateRange ?? null,
            config: (it.config ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
          },
        });
      }
    }
  });

  logAudit({
    userId,
    action: "DASHBOARD_WIDGET_BULK_REPLACE",
    resource: `DashboardWidget:user:${userId}`,
    metadata: { count: items.length },
  });
  return Response.json({ ok: true, count: items.length });
}
