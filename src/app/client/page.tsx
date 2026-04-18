import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/TopBar";

export default async function ClientHome() {
  const user = await requireRole("CLIENT");
  return (
    <>
      <TopBar portal="거래처" userName={user.name} role={user.role} />
      <main className="p-8 max-w-5xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">거래처 포털</h1>
        <p className="text-slate-600">안녕하세요, {user.name}님.</p>
        <p className="text-sm text-slate-500">
          발주·출고 조회는 Phase 4 에서 구축됩니다.
        </p>
      </main>
    </>
  );
}
