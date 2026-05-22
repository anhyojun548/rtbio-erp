import { requireRole } from "@/lib/session";
import { PortalShell } from "@/components/shared/PortalShell";
import { QC_MENU } from "@/components/shared/portalMenus";

/**
 * 품질관리 포털 공통 레이아웃 — TENANT_OWNER · ADMIN · QC 접근.
 *
 * QC 역할은 재고/출고 중심:
 *   - 출고 칸반 이동 (Shipment)
 *   - 재고 조정 (입고/반품/조정)
 *   - 유통기한 로트 관리
 *   - 샘플 출고
 *   - 업무시간/택배 마감 설정
 *
 * 수금/원장/보고서는 경영지원(ADMIN) 전용.
 *
 * 2026-05-22: prototype 디자인 그대로 이식.
 */
export default async function QcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");
  return (
    <PortalShell
      menu={QC_MENU}
      userName={user.name}
      userRole="품질관리팀"
      userAvatar={user.name?.[0] ?? "Q"}
    >
      {children}
    </PortalShell>
  );
}
