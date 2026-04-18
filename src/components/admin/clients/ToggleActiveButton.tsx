"use client";

import { useTransition } from "react";
import { toggleClientActive } from "@/lib/actions/client";

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const verb = active ? "비활성화" : "활성화";
        if (!confirm(`이 거래처를 ${verb}하시겠습니까?`)) return;
        start(async () => {
          const res = await toggleClientActive(id);
          if (!res.ok) alert(res.error);
        });
      }}
      className={`text-xs hover:underline disabled:opacity-50 ${
        active ? "text-red-600 hover:text-red-700" : "text-emerald-700 hover:text-emerald-800"
      }`}
    >
      {pending ? "처리중…" : active ? "비활성화" : "활성화"}
    </button>
  );
}
