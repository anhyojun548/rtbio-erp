/**
 * Dashboard Widget — reset (전체 삭제).
 * 프로토타입의 "기본 레이아웃 초기화" 가 호출 → 서버 행 모두 삭제 후
 * 클라이언트가 다시 loadDefaultLayout() + saveDashboard() 로 채운다.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const userId = session.user.id;
  const res = await prisma.dashboardWidget.deleteMany({ where: { userId } });
  logAudit({
    userId,
    action: "DASHBOARD_WIDGET_RESET",
    resource: `DashboardWidget:user:${userId}`,
    metadata: { deleted: res.count },
  });
  return Response.json({ ok: true, deleted: res.count });
}
