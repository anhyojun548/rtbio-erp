"use client";

/**
 * COMPLETED 주문 상세에 노출되는 "거래명세서 발급" 버튼.
 *   - 기존 활성 invoice 가 있으면 "거래명세서 보기" 로 링크.
 *   - 없으면 createInvoiceFromOrder 호출 후 상세로 이동.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createInvoiceFromOrder } from "@/lib/actions/invoice";

export function IssueInvoiceButton({
  orderId,
  existingInvoice,
}: {
  orderId: string;
  existingInvoice:
    | {
        id: string;
        invoiceNumber: string;
        status: string;
      }
    | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    start(async () => {
      const res = await createInvoiceFromOrder(orderId, {});
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/admin/invoices/${res.data.id}`);
    });
  }

  if (existingInvoice) {
    const label =
      existingInvoice.status === "DRAFT"
        ? "DRAFT"
        : existingInvoice.invoiceNumber;
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-emerald-900">
          <strong>거래명세서 발급됨</strong>{" "}
          <span className="font-mono text-xs">({label})</span> ·{" "}
          {existingInvoice.status}
        </div>
        <Link
          href={`/admin/invoices/${existingInvoice.id}`}
          className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-700"
        >
          거래명세서 보기 →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
      <div className="text-sm text-slate-700">
        <strong>거래명세서를 발급</strong>하면 주문 라인이 스냅샷되어 DRAFT
        거래명세서가 생성됩니다. 이후 발행(ISSUED) 시 공식 번호(INV-...)가
        부여됩니다.
      </div>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "생성 중…" : "🧾 거래명세서 발급"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
