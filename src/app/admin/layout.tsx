import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { AdminSidebar } from "@/components/admin/Sidebar";

/**
 * 경영지원 포털 공통 레이아웃 — TENANT_OWNER · ADMIN 만 접근.
 * 상단 TopBar + 좌측 사이드바 고정, 우측 메인 영역 가변.
 *
 * NOTE: 미들웨어가 1차 RBAC 필터링하지만, 레이아웃에서도 `requireRole` 로
 *       2중 방어 (특정 role 만 닿는 data 로딩 누락 방지).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopBar portal="경영지원" userName={user.name} role={user.role} />
      <div className="flex flex-1 min-h-0">
        <AdminSidebar />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
