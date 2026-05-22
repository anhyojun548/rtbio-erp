"use client";

/**
 * Modal — 중앙 정렬 모달 다이얼로그 (90vh 제한, 본문만 스크롤)
 *
 * 두 가지 사용 방식:
 *
 * [1] 선언형 (권장)
 *   <Modal open={isOpen} onClose={...} title="제목" onConfirm={...}>
 *     본문 컴포넌트
 *   </Modal>
 *
 * [2] 명령형 (legacy 호환, prototype 의 showModal 대체)
 *   import { confirmDialog } from "@/components/shared/Modal";
 *   const ok = await confirmDialog({ title: "삭제", body: "정말?" });
 *   if (ok) ...
 *
 * prototype/js/shared.js 의 showModal() 을 React 로 변환.
 */

import { create } from "zustand";
import { ReactNode, useEffect } from "react";

// ============================================================
// [1] 선언형 Modal 컴포넌트
// ============================================================
interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  /** 확인 버튼 색상 (기본 primary, 위험한 액션은 danger) */
  variant?: "primary" | "danger" | "warning";
  /** 가로 너비 제한 (px). 기본 720 */
  maxWidth?: number;
  /** 푸터 숨김 (커스텀 푸터 사용 시) */
  hideFooter?: boolean;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmText = "확인",
  cancelText = "취소",
  variant = "primary",
  maxWidth = 720,
  hideFooter = false,
}: ModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // body scroll lock
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const btnClass = {
    primary: "bg-primary  hover:bg-primary-light",
    danger:  "bg-danger   hover:bg-danger/90",
    warning: "bg-warning  hover:bg-warning/90",
  }[variant];

  return (
    <div
      className="fixed inset-0 z-modal bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-surface rounded shadow-lg flex flex-col w-full max-h-modal"
        style={{ maxWidth: `${maxWidth}px` }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 id="modal-title" className="text-h2 m-0">{title}</h2>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center rounded transition"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* Body (스크롤 영역) */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {!hideFooter && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
            {onConfirm && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xs border border-border text-ink-secondary hover:bg-canvas transition"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={async () => {
                if (onConfirm) { await onConfirm(); }
                onClose();
              }}
              className={`px-4 py-2 rounded-xs text-white font-semibold transition ${btnClass}`}
            >
              {onConfirm ? confirmText : "닫기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// [2] 명령형 confirmDialog (legacy 호환)
// ============================================================
interface DialogState {
  open: boolean;
  title: string;
  body: ReactNode;
  variant: "primary" | "danger" | "warning";
  resolver: ((value: boolean) => void) | null;
}

interface DialogStore {
  state: DialogState;
  open: (opts: Omit<DialogState, "open" | "resolver"> & { resolver: DialogState["resolver"] }) => void;
  close: (value: boolean) => void;
}

const useDialogStore = create<DialogStore>((set, get) => ({
  state: {
    open: false,
    title: "",
    body: null,
    variant: "primary",
    resolver: null,
  },
  open: (opts) => set({ state: { ...opts, open: true } }),
  close: (value) => {
    const { resolver } = get().state;
    if (resolver) resolver(value);
    set({
      state: { open: false, title: "", body: null, variant: "primary", resolver: null },
    });
  },
}));

/**
 * Promise 기반 confirm 다이얼로그
 * @returns true = 확인 클릭, false = 취소/닫기
 */
export function confirmDialog(opts: {
  title: string;
  body: ReactNode;
  variant?: "primary" | "danger" | "warning";
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useDialogStore.getState().open({
      title: opts.title,
      body: opts.body,
      variant: opts.variant ?? "primary",
      resolver: resolve,
    });
  });
}

/** Root layout 에 한 번 마운트 (legacy confirmDialog 동작용) */
export function DialogProvider() {
  const state = useDialogStore((s) => s.state);
  const close = useDialogStore((s) => s.close);

  if (!state.open) return null;

  return (
    <Modal
      open={state.open}
      title={state.title}
      variant={state.variant}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
    >
      <div className="text-body">{state.body}</div>
    </Modal>
  );
}
