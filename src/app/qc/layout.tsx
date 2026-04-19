import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { QcSidebar } from "@/components/qc/Sidebar";

/**
 * 품질관리 포털 공통 레이아웃 — TENANT_OWNER · ADMIN · QC 접근.
 *
 * QC 역할은 재고/출고 중심의 업무를 수행한다.
 *   - 출고 칸반 이동 (Shipment)
 *   - 재고 조정 (입고/반품/조정)
 *   - 유통기한 로트 관리
 *   - 샘플 출고
 *   - 업무시간/택배 마감 설정
 *
 * 수금/원장/보고서는 경영지원(ADMIN) 전용.
 */
export default async function QcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopBar portal="품질관리" userName={user.name} role={user.role} />
      <div className="flex flex-1 min-h-0">
        <QcSidebar />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
