/**
 * PortalShell — Sidebar + TopBar + 본문 영역을 묶은 포털 공용 셸
 *
 * 5개 포털 layout 에서 재사용. children 자리에 페이지 본문이 들어감.
 *
 * 사용 (Server Component layout):
 *   import { PortalShell } from "@/components/shared/PortalShell";
 *   import { ADMIN_MENU } from "@/components/shared/portalMenus";
 *
 *   export default async function AdminLayout({ children }) {
 *     const session = await requireRole("ADMIN", "TENANT_OWNER");
 *     return (
 *       <PortalShell
 *         menu={ADMIN_MENU}
 *         userName={session.user.name}
 *         userRole="경영지원팀"
 *         userAvatar={session.user.name?.[0] ?? "U"}
 *       >
 *         {children}
 *       </PortalShell>
 *     );
 *   }
 */

import { Sidebar, type NavSection } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { NotificationItem } from "./NotificationBell";

interface PortalShellProps {
  menu: NavSection[];
  userName: string;
  userRole: string;
  userAvatar: string;
  /** 알림 데이터 (선택, 서버에서 미리 로드 가능) */
  notifications?: NotificationItem[];
  /** 사이드바 브랜드 텍스트 */
  brandText?: string;
  brandSubText?: string;
  children: React.ReactNode;
}

export function PortalShell({
  menu,
  userName,
  userRole,
  userAvatar,
  notifications = [],
  brandText,
  brandSubText,
  children,
}: PortalShellProps) {
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        menu={menu}
        userName={userName}
        userRole={userRole}
        userAvatar={userAvatar}
        brandText={brandText}
        brandSubText={brandSubText}
      />
      <div className="md:ml-sidebar flex flex-col min-h-screen">
        <TopBar
          userName={userName}
          userRole={userRole}
          notifications={notifications}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
