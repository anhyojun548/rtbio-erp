/**
 * 칸반 단계 관리 (Phase 3E-1, R05).
 *
 * - 현재 단계 목록(사용량 포함) 조회
 * - 신규 단계 생성 · 수정 · 삭제 · 재정렬
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listKanbanColumnsWithUsage } from "@/lib/actions/kanban";
import { KanbanColumnAdminBoard } from "@/components/admin/shipments/KanbanColumnAdminBoard";

export default async function KanbanColumnsAdminPage() {
  await requireRole("TENANT_OWNER", "ADMIN");

  const columns = await listKanbanColumnsWithUsage();

  const rows = columns.map((c) => ({
    id: c.id,
    key: c.key,
    label: c.label,
    sortOrder: c.sortOrder,
    isTerminal: c.isTerminal,
    color: c.color,
    shipmentCount: c._count.shipments,
  }));

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">칸반 단계 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            출고 칸반에 표시되는 단계(열)를 관리합니다 (R05).
            <br />
            terminal 단계 진입 시 <strong>physicalStock 이 차감</strong>되고 자동 완료됩니다.
          </p>
        </div>
        <Link
          href="/admin/shipments"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          ← 칸반 보드
        </Link>
      </header>

      <KanbanColumnAdminBoard rows={rows} />
    </div>
  );
}
