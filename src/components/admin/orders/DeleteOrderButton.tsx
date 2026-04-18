"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteOrder } from "@/lib/actions/order";

export function DeleteOrderButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    if (
      !confirm(
        `${orderNumber} 을 삭제하시겠습니까?\nDRAFT 하드 삭제 — 복구 불가, 라인도 함께 삭제됩니다.`,
      )
    ) {
      return;
    }
    start(async () => {
      const res = await deleteOrder(orderId);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      router.push("/admin/orders");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-md border border-red-300 bg-white text-red-600 px-3 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "삭제중…" : "DRAFT 삭제"}
    </button>
  );
}
