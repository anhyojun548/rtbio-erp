import { requireRole } from "@/lib/session";
import { PortalShell } from "@/components/shared/PortalShell";
import { CEO_MENU } from "@/components/shared/portalMenus";

/**
 * 임원 포털 공통 레이아웃 — TENANT_OWNER · SUPER_ADMIN 접근.
 *
 * 임원진은:
 *   - 통합 KPI 위젯 대시보드 (자유 배치)
 *   - 직원별 매출/실적
 *   - 베트남 발주 현황 모니터링
 *   - 거래처 공지 발송 (정책·인사 안내)
 *
 * 2026-05-22: 신규 layout (prototype ceo-portal 디자인 그대로 이식).
 */
export default async function CeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("TENANT_OWNER", "SUPER_ADMIN");
  return (
    <PortalShell
      menu={CEO_MENU}
      userName={user.name}
      userRole="임원진"
      userAvatar={user.name?.[0] ?? "C"}
    >
      {children}
    </PortalShell>
  );
}
