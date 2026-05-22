import { requireRole } from "@/lib/session";
import { ClientForm } from "@/components/admin/clients/ClientForm";

export default async function NewClientPage() {
  await requireRole("TENANT_OWNER", "ADMIN");
  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-display m-0">신규 거래처 등록</h1>
        <p className="text-caption text-ink-secondary mt-1">
          기본 정보 등록 후 상세 페이지에서 배송지를 추가할 수 있습니다.
        </p>
      </header>
      <ClientForm mode="create" />
    </div>
  );
}
