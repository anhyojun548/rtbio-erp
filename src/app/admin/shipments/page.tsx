/**
 * 출고 칸반 보드 (Phase 3D-2c).
 *
 * 열(Column) = KanbanColumn (sortOrder 순). 카드 = Shipment.
 * 카드 클릭/버튼으로 다음 단계 이동. terminal 진입 시 자동 완료 처리 → SHIP.
 *
 * 보여주는 shipment:
 *  - completedAt != null → terminal 열에 남음 (시각화).
 *  - completedAt == null → currentStageId 열.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  listKanbanColumns,
  listShipmentsForBoard,
} from "@/lib/actions/shipment";
import { ShipmentCard } from "@/components/admin/shipments/ShipmentCard";

type Column = Awaited<ReturnType<typeof listKanbanColumns>>[number];
type ShipmentForBoard = Awaited<
  ReturnType<typeof listShipmentsForBoard>
>[number];

export default async function ShipmentBoardPage() {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const [columns, shipments] = await Promise.all([
    listKanbanColumns(),
    listShipmentsForBoard(),
  ]);

  // 컬럼별 그룹핑
  const byColumn = new Map<string, ShipmentForBoard[]>();
  for (const c of columns) byColumn.set(c.id, []);
  for (const sh of shipments) {
    const arr = byColumn.get(sh.currentStageId);
    if (arr) arr.push(sh);
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">출고 칸반</h1>
          <p className="text-sm text-slate-500 mt-1">
            CONFIRMED 주문에서 <strong>출고 시작</strong> 하면 이 보드에 진입합니다.
            terminal 단계(마지막 열) 도달 시 실재고가 차감됩니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">
            진행중 {shipments.filter((s) => !s.completedAt).length}건 · 완료{" "}
            {shipments.filter((s) => s.completedAt).length}건
          </div>
          <Link
            href="/admin/shipments/columns"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            ⚙ 단계 관리
          </Link>
        </div>
      </header>

      {columns.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
          칸반 단계가 아직 설정되어 있지 않습니다.
        </div>
      ) : (
        <div
          className="grid gap-3 overflow-x-auto pb-4"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`,
          }}
        >
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              columns={columns}
              cards={byColumn.get(col.id) ?? []}
            />
          ))}
        </div>
      )}

      <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600 flex flex-wrap gap-4">
        <span>
          <strong className="text-slate-800">이동 규칙:</strong> 현재 단계와
          다른 단계로만 이동 가능. terminal 도달 시 자동 완료 & SHIP.
        </span>
        <Link
          href="/admin/orders?status=CONFIRMED"
          className="text-sky-700 hover:underline"
        >
          CONFIRMED 주문 보기 →
        </Link>
      </div>
    </div>
  );
}

function BoardColumn({
  column,
  columns,
  cards,
}: {
  column: Column;
  columns: Column[];
  cards: ShipmentForBoard[];
}) {
  const isTerminal = column.isTerminal;
  const activeCount = cards.filter((c) => !c.completedAt).length;

  return (
    <div
      className={`rounded-lg border flex flex-col min-h-[200px] ${
        isTerminal
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-slate-200 bg-slate-50/60"
      }`}
    >
      <div
        className={`px-3 py-2 border-b flex items-center justify-between ${
          isTerminal
            ? "border-emerald-200 bg-emerald-100/60"
            : "border-slate-200 bg-white"
        }`}
      >
        <div>
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            {column.label}
            {isTerminal && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800 font-medium">
                terminal
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-slate-400">
            {column.key}
          </div>
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          {activeCount}/{cards.length}
        </span>
      </div>

      <div className="flex-1 p-2 space-y-2">
        {cards.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-6">
            {isTerminal ? "완료된 출고 없음" : "진행중 출고 없음"}
          </p>
        ) : (
          cards.map((sh) => (
            <ShipmentCard key={sh.id} shipment={sh} columns={columns} />
          ))
        )}
      </div>
    </div>
  );
}
