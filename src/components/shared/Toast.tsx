"use client";

/**
 * Toast — 상단 중앙 알림 메시지 (3초 자동 닫힘)
 *
 * 사용법:
 *   import { toast } from "@/components/shared/Toast";
 *   toast.success("저장되었습니다");
 *   toast.error("저장 실패");
 *   toast.info("처리 중...");
 *
 * Provider 는 Root layout 에 한 번 마운트:
 *   <ToastProvider />
 *
 * prototype/js/shared.js 의 showToast() 를 React + Zustand 로 변환.
 */

import { create } from "zustand";
import { useEffect } from "react";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; message: string; type: ToastType };

interface ToastStore {
  items: ToastItem[];
  push: (message: string, type: ToastType) => void;
  remove: (id: number) => void;
}

let _nextId = 1;
const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (message, type) => {
    const id = _nextId++;
    set((s) => ({ items: [...s.items, { id, message, type }] }));
    // 자동 제거 (3초)
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 3000);
  },
  remove: (id) =>
    set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

// ── 외부 API ──────────────────────────────────────────────
export const toast = {
  success: (msg: string) => useToastStore.getState().push(msg, "success"),
  error:   (msg: string) => useToastStore.getState().push(msg, "error"),
  info:    (msg: string) => useToastStore.getState().push(msg, "info"),
};

// ── Provider ──────────────────────────────────────────────
const TYPE_STYLES: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: "bg-success",  icon: "✓" },
  error:   { bg: "bg-danger",   icon: "✕" },
  info:    { bg: "bg-primary",  icon: "ℹ" },
};

export function ToastProvider() {
  const items = useToastStore((s) => s.items);
  const remove = useToastStore((s) => s.remove);

  // ESC 키로 가장 최근 토스트 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const last = items[items.length - 1];
      if (last) remove(last.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, remove]);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed top-6 left-1/2 -translate-x-1/2 z-toast flex flex-col gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => {
        const style = TYPE_STYLES[t.type];
        return (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            className={`
              ${style.bg} text-white px-5 py-3 rounded-sm shadow-md
              flex items-center gap-3 min-w-[240px] max-w-[480px]
              cursor-pointer pointer-events-auto
              animate-[toast-in_0.2s_ease-out]
            `}
          >
            <span className="text-lg font-bold">{style.icon}</span>
            <span className="text-sm">{t.message}</span>
          </div>
        );
      })}
      <style jsx global>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
