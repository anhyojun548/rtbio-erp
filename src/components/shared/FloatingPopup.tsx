"use client";

/**
 * FloatingPopup — 드래그 가능 + 뷰포트 클램프 + resize 가능한 부유 창
 *
 * prototype 의 거래처원장 발주 상세, 매뉴얼 상세 등에서 사용.
 * 사용 방식 2가지:
 *
 * [1] 선언형 (권장)
 *   <FloatingPopup
 *     open={isOpen}
 *     onClose={...}
 *     title="발주 상세 — ORD-260520-001"
 *     width={520}
 *     height={420}
 *   >
 *     본문 컴포넌트
 *   </FloatingPopup>
 *
 * [2] 명령형 (legacy 호환)
 *   import { openFloatingPopup } from "@/components/shared/FloatingPopup";
 *   openFloatingPopup({ title, content, width, height });
 *
 * prototype/js/shared-ui.js 의 showFloatingPopup() 을 React 로 변환.
 */

import { create } from "zustand";
import { ReactNode, useEffect, useRef, useState } from "react";

// ============================================================
// [1] 선언형 컴포넌트
// ============================================================
interface FloatingPopupProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 가로(px). 기본 600 */
  width?: number;
  /** 세로(px). 기본 480 */
  height?: number;
  /** 초기 위치 (좌표 미지정 시 중앙) */
  initialX?: number;
  initialY?: number;
}

export function FloatingPopup({
  open,
  onClose,
  title,
  children,
  width = 600,
  height = 480,
  initialX,
  initialY,
}: FloatingPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // 초기 위치/크기 계산 (open 시 한 번만)
  useEffect(() => {
    if (!open) return;
    const margin = 16;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    let w = Math.min(width, vpW - margin * 2);
    let h = Math.min(height, vpH - margin * 2);
    w = Math.max(w, 320);
    h = Math.max(h, 200);
    let x = initialX ?? Math.max(margin, (vpW - w) / 2);
    let y = initialY ?? Math.max(margin, (vpH - h) / 3);
    x = Math.min(Math.max(margin, x), vpW - w - margin);
    y = Math.min(Math.max(margin, y), vpH - h - margin);
    setPos({ x, y, w, h });
  }, [open, width, height, initialX, initialY]);

  // 드래그 핸들러
  useEffect(() => {
    if (!open) return;
    const header = headerRef.current;
    const popup = popupRef.current;
    if (!header || !popup) return;

    let dragging = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;
    const margin = 8;

    const onMouseDown = (e: MouseEvent) => {
      // 닫기 버튼은 드래그 안 됨
      if ((e.target as HTMLElement).dataset.popupClose === "1") return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = popup.offsetLeft;
      origY = popup.offsetTop;
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const w = popup.offsetWidth;
      const h = popup.offsetHeight;
      let nx = origX + (e.clientX - startX);
      let ny = origY + (e.clientY - startY);
      nx = Math.min(Math.max(margin, nx), window.innerWidth - w - margin);
      ny = Math.min(Math.max(margin, ny), window.innerHeight - h - margin);
      popup.style.left = `${nx}px`;
      popup.style.top  = `${ny}px`;
    };
    const onMouseUp = () => { dragging = false; };

    header.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      header.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [open, pos]);

  // ESC 키
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !pos) return null;

  return (
    <div
      ref={popupRef}
      className="fixed z-popup bg-surface rounded-sm shadow-lg border border-border flex flex-col overflow-hidden"
      style={{
        left:   `${pos.x}px`,
        top:    `${pos.y}px`,
        width:  `${pos.w}px`,
        height: `${pos.h}px`,
        resize: "both",   // 사용자 resize 가능
      }}
      role="dialog"
      aria-label={title}
    >
      {/* Header (드래그 핸들) */}
      <div
        ref={headerRef}
        className="px-4 py-3 bg-primary text-white flex items-center justify-between flex-shrink-0 select-none cursor-move"
      >
        <span className="font-semibold truncate">{title}</span>
        <button
          type="button"
          onClick={onClose}
          data-popup-close="1"
          className="text-white/80 hover:text-white text-lg w-7 h-7 flex items-center justify-center rounded transition"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {/* Body (스크롤) */}
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
    </div>
  );
}

// ============================================================
// [2] 명령형 — openFloatingPopup({ ... })
// ============================================================
interface PopupItem {
  id: number;
  title: string;
  content: ReactNode;
  width?: number;
  height?: number;
  initialX?: number;
  initialY?: number;
}

interface PopupStore {
  items: PopupItem[];
  open: (item: Omit<PopupItem, "id">) => number;
  close: (id: number) => void;
  closeAll: () => void;
}

let _nextId = 1;
const usePopupStore = create<PopupStore>((set) => ({
  items: [],
  open: (item) => {
    const id = _nextId++;
    set((s) => ({ items: [...s.items, { ...item, id }] }));
    return id;
  },
  close: (id) =>
    set((s) => ({ items: s.items.filter((p) => p.id !== id) })),
  closeAll: () => set({ items: [] }),
}));

/** 명령형 호출 — 어디서든 팝업 띄우기 */
export function openFloatingPopup(item: Omit<PopupItem, "id">): number {
  return usePopupStore.getState().open(item);
}
export function closeFloatingPopup(id: number) {
  usePopupStore.getState().close(id);
}
export function closeAllFloatingPopups() {
  usePopupStore.getState().closeAll();
}

/** Root layout 에 한 번 마운트 */
export function FloatingPopupProvider() {
  const items = usePopupStore((s) => s.items);
  const close = usePopupStore((s) => s.close);

  return (
    <>
      {items.map((p) => (
        <FloatingPopup
          key={p.id}
          open={true}
          onClose={() => close(p.id)}
          title={p.title}
          width={p.width}
          height={p.height}
          initialX={p.initialX}
          initialY={p.initialY}
        >
          {p.content}
        </FloatingPopup>
      ))}
    </>
  );
}
