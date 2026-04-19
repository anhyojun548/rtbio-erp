import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { ExecSidebar } from "@/components/exec/Sidebar";

/**
 * 영업 포털 공통 레이아웃 — TENANT_OWNER · ADMIN · EXEC 접근.
 *
 * 주의: EXEC 롤은 "본인 배정 거래처만" 보여야 한다.
 *       모든 서버 액션(`lib/actions/exec.ts`) 은 기본값으로 현재 user.id 기준
 *       row-level 필터를 적용한다. ADMIN/TENANT_OWNER 는 동일 API 를
 *       `forUserId` 옵션으로 대리 조회할 수 있다.
 */
export default async function ExecLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopBar portal="영업" userName={user.name} role={user.role} />
      <div className="flex flex-1 min-h-0">
        <ExecSidebar />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
