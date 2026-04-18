import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/TopBar";

export default async function CeoHome() {
  const user = await requireRole("TENANT_OWNER", "SUPER_ADMIN");
  return (
    <>
      <TopBar portal="임원진" userName={user.name} role={user.role} />
      <main className="p-8 max-w-5xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">임원진 포털</h1>
        <p className="text-slate-600">안녕하세요, {user.name}님.</p>
        <p className="text-sm text-slate-500">
          KPI 대시보드·위젯 커스터마이징은 Phase 7 에서 구축됩니다.
        </p>
      </main>
    </>
  );
}
