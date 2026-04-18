"use client";

/**
 * 주문 상태 전이 버튼 패널 (Phase 3D-2b).
 *
 * 이번 커밋(3D-2b-1): SUBMIT 만 노출.
 *   이후 CONFIRM / REJECT / HOLD / CANCEL / RESUME 을 동일 패턴으로 확장.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OrderStatus } from "@prisma/client";
import { submitOrder } from "@/lib/actions/order";

export function StatusActions({
  orderId,
  status,
  itemCount,
}: {
  orderId: string;
  status: OrderStatus;
  itemCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canSubmit = status === "DRAFT" && itemCount > 0;

  function doSubmit() {
    setError(null);
    start(async () => {
      const res = await submitOrder(orderId, {});
      if (!res.ok) {
        setError(res.error);
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
      // 라우터 리프레시로 새 orderNumber + 상태 반영
      router.refresh();
    });
  }

  if (status !== "DRAFT") {
    // 3D-2b-2 에서 CONFIRM/REJECT/HOLD/CANCEL 버튼 추가 예정
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">
          현재 상태:{" "}
          <span className="font-semibold text-slate-800">{status}</span>. 추가
          상태 전이는 다음 단계에서 제공됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          이 주문을 제출하면 공식 주문번호(<code className="font-mono">
            ORD-YYYYMMDD-NNN
          </code>)가 부여되고, 라인 가격이 현시점 기준으로 잠깁니다.
        </div>
        <button
          type="button"
          disabled={!canSubmit || pending}
          onClick={() => setConfirmOpen(true)}
          className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
          title={!canSubmit ? "라인이 있는 DRAFT 에서만 제출 가능" : undefined}
        >
          {pending ? "제출중…" : "발주 제출 →"}
        </button>
      </div>

      {confirmOpen && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-sm text-amber-900">
            <strong>제출하시겠습니까?</strong>{" "}
            제출 후엔 라인/헤더를 자유 편집할 수 없고, 가격도 변경되지
            않습니다.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={doSubmit}
              disabled={pending}
              className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {pending ? "제출중…" : "제출"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
