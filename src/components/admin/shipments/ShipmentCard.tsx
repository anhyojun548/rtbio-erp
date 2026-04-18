"use client";

/**
 * 출고 카드 (Phase 3D-2c).
 *
 * - 단계 이동(selectbox + 버튼) + 보류/재개.
 * - terminal 로 이동 시 서버가 자동으로 SHIP 처리.
 * - 완료된 카드(completedAt != null) 는 읽기 전용.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  moveShipmentStage,
  holdShipment,
  resumeShipment,
} from "@/lib/actions/shipment";

type ShipmentForCard = {
  id: string;
  currentStageId: string;
  enteredStageAt: Date;
  holdReason: string | null;
  completedAt: Date | null;
  currentStage: {
    id: string;
    key: string;
    label: string;
    sortOrder: number;
    isTerminal: boolean;
  };
  order: {
    id: string;
    orderNumber: string;
    orderDate: Date;
    requestedDate: Date | null;
    client: { id: string; code: string; name: string };
    _count: { items: number };
    items: Array<{ quantity: number; lineTotal: unknown }>;
  };
};

type Column = {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  isTerminal: boolean;
};

export function ShipmentCard({
  shipment,
  columns,
}: {
  shipment: ShipmentForCard;
  columns: Column[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"move" | "hold" | null>(null);

  // 기본 다음 단계 = sortOrder 가 현재보다 큰 첫 단계
  const nextDefault = columns.find(
    (c) => c.sortOrder === shipment.currentStage.sortOrder + 1,
  );
  const [toStageId, setToStageId] = useState<string>(
    nextDefault?.id ?? columns[columns.length - 1]?.id ?? "",
  );
  const [holdReason, setHoldReason] = useState("");

  const isDone = shipment.completedAt !== null;
  const isHeld = shipment.holdReason !== null;

  const totalQty = shipment.order.items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = shipment.order.items.reduce(
    (s, i) => s + Number(i.lineTotal),
    0,
  );

  function runMove() {
    if (!toStageId || toStageId === shipment.currentStageId) {
      setError("다른 단계를 선택해주세요.");
      return;
    }
    start(async () => {
      const res = await moveShipmentStage(shipment.id, { toStageId });
      if (!res.ok) return setError(res.error);
      setError(null);
      setMode(null);
      router.refresh();
    });
  }

  function runHold() {
    const trimmed = holdReason.trim();
    if (trimmed.length < 3) {
      setError("사유는 3자 이상 입력해주세요.");
      return;
    }
    start(async () => {
      const res = await holdShipment(shipment.id, { reason: trimmed });
      if (!res.ok) return setError(res.error);
      setError(null);
      setMode(null);
      setHoldReason("");
      router.refresh();
    });
  }

  function runResume() {
    start(async () => {
      const res = await resumeShipment(shipment.id, {});
      if (!res.ok) return setError(res.error);
      setError(null);
      router.refresh();
    });
  }

  const toStage = columns.find((c) => c.id === toStageId);

  return (
    <div
      className={`rounded-md border bg-white text-xs shadow-sm ${
        isDone
          ? "border-emerald-200"
          : isHeld
            ? "border-amber-300"
            : "border-slate-200"
      }`}
    >
      <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
        <Link
          href={`/admin/orders/${shipment.order.id}`}
          className="font-mono text-[11px] text-sky-700 hover:underline"
        >
          {shipment.order.orderNumber}
        </Link>
        {isDone && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
            완료
          </span>
        )}
        {!isDone && isHeld && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
            보류
          </span>
        )}
      </div>

      <div className="px-2.5 py-2 space-y-1">
        <div className="text-slate-800 font-medium truncate">
          {shipment.order.client.name}
        </div>
        <div className="flex justify-between text-slate-500">
          <span>라인 {shipment.order._count.items}건</span>
          <span className="tabular-nums">{totalQty}개</span>
        </div>
        <div className="text-right tabular-nums text-slate-700 font-medium">
          {totalAmount.toLocaleString()}원
        </div>
        <div className="text-[10px] text-slate-400">
          진입 {new Date(shipment.enteredStageAt).toLocaleString("ko-KR")}
        </div>
        {isHeld && shipment.holdReason && (
          <div className="text-[10px] text-amber-800 bg-amber-50 rounded px-1.5 py-1 border border-amber-200">
            보류: {shipment.holdReason}
          </div>
        )}
      </div>

      {!isDone && (
        <div className="px-2.5 py-1.5 border-t border-slate-100">
          {error && (
            <p className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-1 mb-1.5">
              {error}
            </p>
          )}

          {mode === null && (
            <div className="flex gap-1.5">
              {!isHeld && (
                <button
                  type="button"
                  onClick={() => setMode("move")}
                  disabled={pending}
                  className="flex-1 rounded bg-sky-600 text-white px-2 py-1 text-[11px] font-medium hover:bg-sky-700 disabled:opacity-50"
                >
                  이동
                </button>
              )}
              {!isHeld ? (
                <button
                  type="button"
                  onClick={() => setMode("hold")}
                  disabled={pending}
                  className="rounded border border-amber-300 bg-amber-50 text-amber-700 px-2 py-1 text-[11px] font-medium hover:bg-amber-100 disabled:opacity-50"
                >
                  보류
                </button>
              ) : (
                <button
                  type="button"
                  onClick={runResume}
                  disabled={pending}
                  className="flex-1 rounded bg-emerald-600 text-white px-2 py-1 text-[11px] font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pending ? "처리중…" : "재개"}
                </button>
              )}
            </div>
          )}

          {mode === "move" && (
            <div className="space-y-1.5">
              <select
                value={toStageId}
                onChange={(e) => setToStageId(e.target.value)}
                className="w-full rounded border border-slate-300 text-[11px] px-1.5 py-1"
              >
                {columns
                  .filter((c) => c.id !== shipment.currentStageId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                      {c.isTerminal ? " (terminal — SHIP 실행)" : ""}
                    </option>
                  ))}
              </select>
              {toStage?.isTerminal && (
                <p className="text-[10px] text-blue-800 bg-blue-50 rounded px-1.5 py-1 border border-blue-200">
                  terminal 이동 시 실재고 {totalQty}개 차감됩니다.
                </p>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={runMove}
                  disabled={pending}
                  className="flex-1 rounded bg-sky-600 text-white px-2 py-1 text-[11px] font-medium hover:bg-sky-700 disabled:opacity-50"
                >
                  {pending ? "이동중…" : "이동 확정"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode(null);
                    setError(null);
                  }}
                  className="rounded border border-slate-300 bg-white text-slate-700 px-2 py-1 text-[11px] hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {mode === "hold" && (
            <div className="space-y-1.5">
              <textarea
                rows={2}
                maxLength={500}
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="보류 사유 (3~500자)"
                className="w-full rounded border border-slate-300 text-[11px] px-1.5 py-1 resize-none"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={runHold}
                  disabled={pending}
                  className="flex-1 rounded bg-amber-600 text-white px-2 py-1 text-[11px] font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  {pending ? "처리중…" : "보류 확정"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode(null);
                    setHoldReason("");
                    setError(null);
                  }}
                  className="rounded border border-slate-300 bg-white text-slate-700 px-2 py-1 text-[11px] hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
