/**
 * 재고 변동 이력 (Phase 3C).
 * 필터: 타입 · 기간 · 제품명/코드 키워드
 */
import Link from "next/link";
import type { InventoryLogType } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { listInventoryLogs } from "@/lib/actions/inventory";
import { LogFilterBar } from "@/components/admin/inventory/LogFilterBar";

type SearchParams = {
  q?: string;
  type?: string;
  from?: string;
  to?: string;
};

const TYPE_LABEL: Record<InventoryLogType, string> = {
  RECEIVE: "입고",
  RESERVE: "예약",
  RELEASE: "예약해제",
  SHIP: "출고",
  RETURN: "반품",
  ADJUST_IN: "조정(+)",
  ADJUST_OUT: "조정(-)",
};

const TYPE_TONE: Record<InventoryLogType, string> = {
  RECEIVE: "bg-emerald-50 text-emerald-700",
  RESERVE: "bg-blue-50 text-blue-700",
  RELEASE: "bg-slate-100 text-slate-600",
  SHIP: "bg-indigo-50 text-indigo-700",
  RETURN: "bg-purple-50 text-purple-700",
  ADJUST_IN: "bg-amber-50 text-amber-700",
  ADJUST_OUT: "bg-red-50 text-red-700",
};

const ALLOWED_TYPES: InventoryLogType[] = [
  "RECEIVE",
  "RESERVE",
  "RELEASE",
  "SHIP",
  "RETURN",
  "ADJUST_IN",
  "ADJUST_OUT",
];

export default async function InventoryLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const typeParam = searchParams.type;
  const type: InventoryLogType | "ALL" =
    typeParam && (ALLOWED_TYPES as string[]).includes(typeParam)
      ? (typeParam as InventoryLogType)
      : "ALL";

  const from = searchParams.from ? new Date(searchParams.from) : undefined;
  const to = searchParams.to ? new Date(searchParams.to) : undefined;
  if (to) to.setHours(23, 59, 59, 999); // 하루 끝까지 포함

  const rows = await listInventoryLogs({
    type,
    from,
    to,
    limit: 500,
  });

  const needle = searchParams.q?.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) => {
        const hay =
          `${r.productSize.product.name} ${r.productSize.product.code} ${r.productSize.sizeCode}`.toLowerCase();
        return hay.includes(needle);
      })
    : rows;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">재고 변동 이력</h1>
          <p className="text-sm text-slate-500 mt-1">
            입고 · 출고 · 반품 · 조정의 모든 변동이 기록됩니다. (최대 500건)
          </p>
        </div>
        <Link
          href="/admin/inventory"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          재고 현황
        </Link>
      </header>

      <LogFilterBar />

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium">일시</th>
              <th className="px-4 py-3 text-left font-medium">제품</th>
              <th className="px-4 py-3 text-left font-medium">사이즈</th>
              <th className="px-4 py-3 text-left font-medium">타입</th>
              <th className="px-4 py-3 text-right font-medium">변동</th>
              <th className="px-4 py-3 text-right font-medium">실재고 후</th>
              <th className="px-4 py-3 text-right font-medium">가용재고 후</th>
              <th className="px-4 py-3 text-left font-medium">비고</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  조건에 맞는 이력이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 text-slate-700 text-xs tabular-nums whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString("ko-KR", {
                      year: "2-digit",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    <div className="font-medium">
                      {r.productSize.product.name}
                    </div>
                    <div className="font-mono text-xs text-slate-500">
                      {r.productSize.product.code}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-800">
                    {r.productSize.sizeCode}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_TONE[r.type]}`}
                    >
                      {TYPE_LABEL[r.type]}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${
                      r.qtyDelta > 0
                        ? "text-emerald-700"
                        : r.qtyDelta < 0
                          ? "text-red-700"
                          : "text-slate-500"
                    }`}
                  >
                    {r.qtyDelta > 0 ? "+" : ""}
                    {r.qtyDelta.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.physicalAfter.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {r.availableAfter.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs max-w-[240px] truncate">
                    {r.note ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        총 {filtered.length}건 (서버 조회 {rows.length}건)
      </p>
    </div>
  );
}
