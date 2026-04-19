/**
 * 테넌트 설정 페이지 — Phase 3E-2 (R13).
 *
 * 업무시간/택배 마감시간/재고 알람 배수/부가세율을 한 화면에서 관리.
 */
import { requireRole } from "@/lib/session";
import { listSettings } from "@/lib/actions/tenant-setting";
import { TenantSettingsBoard } from "@/components/admin/settings/TenantSettingsBoard";

export default async function TenantSettingsPage() {
  await requireRole("TENANT_OWNER", "ADMIN");

  const rows = await listSettings();

  const view = rows.map((r) => ({
    key: r.key,
    value: r.value,
    description: r.description,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    updatedBy: r.updatedBy,
  }));

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">테넌트 설정</h1>
        <p className="text-sm text-slate-500 mt-1">
          업무시간 · 택배 마감시간 · 재고 알람 배수 · 부가세율을 관리합니다 (R13).
          <br />
          <strong>부가세율</strong>은 거래명세서 발행 계산에,{" "}
          <strong>재고 알람 배수</strong>는 품목별 재주문 기준에 사용됩니다.
        </p>
      </header>

      <TenantSettingsBoard rows={view} />
    </div>
  );
}
