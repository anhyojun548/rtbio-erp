import { requireRole } from "@/lib/session";
import { OrderCreateForm } from "@/components/admin/orders/OrderCreateForm";

export default async function NewOrderPage() {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">신규 주문</h1>
        <p className="text-sm text-slate-500 mt-1">
          거래처 · 주문일 · 초기 라인을 입력하면 DRAFT 로 저장됩니다. 배송지와
          라인 수정은 상세 페이지에서 이어가세요.
        </p>
      </header>
      <OrderCreateForm />
    </div>
  );
}
