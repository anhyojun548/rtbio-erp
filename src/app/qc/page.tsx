import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/TopBar";

export default async function QcHome() {
  const user = await requireRole("TENANT_OWNER", "QC");
  return (
    <>
      <TopBar portal="품질관리" userName={user.name} role={user.role} />
      <main className="p-8 max-w-5xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">품질관리 포털</h1>
        <p className="text-slate-600">안녕하세요, {user.name}님.</p>
        <p className="text-sm text-slate-500">
          발주 확정/출고 칸반·재고 조정은 Phase 3~4 에서 구축됩니다.
        </p>
      </main>
    </>
  );
}
