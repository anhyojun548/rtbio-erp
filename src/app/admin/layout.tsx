import { requireRole } from "@/lib/session";
import { PortalShell } from "@/components/shared/PortalShell";
import { ADMIN_MENU } from "@/components/shared/portalMenus";

/**
 * 경영지원 포털 공통 레이아웃 — TENANT_OWNER · ADMIN 만 접근.
 *
 * 2026-05-22: prototype 디자인 그대로 이식 (다크 사이드바 + 5개 메뉴 섹션).
 * 미들웨어가 1차 RBAC 필터링하지만, 레이아웃에서도 `requireRole` 로 2중 방어.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  return (
    <PortalShell
      menu={ADMIN_MENU}
      userName={user.name}
      userRole="경영지원팀"
      userAvatar={user.name?.[0] ?? "A"}
    >
      {children}
    </PortalShell>
  );
}
