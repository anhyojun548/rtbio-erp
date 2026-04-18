import { requireRole } from "@/lib/session";
import { ClientForm } from "@/components/admin/clients/ClientForm";

export default async function NewClientPage() {
  await requireRole("TENANT_OWNER", "ADMIN");
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">신규 거래처 등록</h1>
        <p className="text-sm text-slate-500 mt-1">
          기본 정보 등록 후 상세 페이지에서 배송지를 추가할 수 있습니다.
        </p>
      </header>
      <ClientForm mode="create" />
    </div>
  );
}
