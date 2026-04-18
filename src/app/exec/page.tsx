import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/TopBar";

export default async function ExecHome() {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  return (
    <>
      <TopBar portal="영업" userName={user.name} role={user.role} />
      <main className="p-8 max-w-5xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">영업 포털</h1>
        <p className="text-slate-600">안녕하세요, {user.name}님.</p>
        <p className="text-sm text-slate-500">
          매출 현황·학회·거래처 관리는 Phase 6 에서 구축됩니다.
        </p>
      </main>
    </>
  );
}
