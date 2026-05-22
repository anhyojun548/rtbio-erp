"use client";

/**
 * NotificationBell — 종 모양 알림 + 미읽음 배지 + 드롭다운
 *
 * 데이터 소스: 서버 액션으로 받은 알림 목록 (props 로 전달)
 * 또는 글로벌 store(useNotifyStore) 활용 가능.
 *
 * 사용:
 *   <NotificationBell
 *     notifications={items}
 *     onMarkRead={(id) => ...}
 *     onMarkAllRead={() => ...}
 *   />
 *
 * prototype/js/shared-ui.js 의 buildNotifyBell + toggleNotifyDropdown + 관련 함수를 변환.
 */

import { useEffect, useRef, useState } from "react";

export interface NotificationItem {
  id: string;
  type: string;  // 'ORDER_EDIT' | 'STOCK_LOW' | 'NOTICE' | 'PROJECT_ARRIVAL' | 'INVOICE_RESEND' | ...
  title: string;
  message: string;
  createdAt: string;
  readAt?: string | null;
  urgent?: boolean;
  relatedId?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  ORDER_EDIT:      "발주수정",
  STOCK_LOW:       "재고경고",
  NOTICE:          "공지사항",
  PROJECT_ARRIVAL: "베트남입고",
  INVOICE_RESEND:  "명세서재발행",
};

function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? "알림";
}

interface Props {
  notifications: NotificationItem[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  /** 알림 클릭 시 어디로 이동할지 (relatedId 기반) */
  onItemClick?: (notification: NotificationItem) => void;
}

export function NotificationBell({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onItemClick,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // setTimeout 으로 이벤트 전파 다음 tick 에 등록 (열자마자 즉시 닫히는 거 방지)
    const id = setTimeout(() => document.addEventListener("click", onClick), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  // ESC 키
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xs hover:bg-canvas transition"
        title={`알림 ${unread}건`}
        aria-label={`알림 ${unread}건`}
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 bg-danger text-white text-tiny font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] bg-surface border border-border rounded shadow-lg z-dropdown flex flex-col"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <strong className="text-h3">알림</strong>
            {unread > 0 && onMarkAllRead && (
              <button
                type="button"
                onClick={() => onMarkAllRead()}
                className="text-tiny text-primary hover:underline"
              >
                모두 읽음
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-tiny text-ink-muted">
                새 알림이 없습니다
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => {
                      if (!n.readAt && onMarkRead) onMarkRead(n.id);
                      if (onItemClick) onItemClick(n);
                    }}
                    className={`
                      px-4 py-3 cursor-pointer transition hover:bg-canvas
                      ${!n.readAt ? "bg-primary-lighter/30" : ""}
                      ${n.urgent ? "border-l-4 border-l-danger" : ""}
                    `}
                  >
                    <div className="text-caption font-semibold mb-1">
                      {n.urgent && <span className="mr-1">🔴</span>}
                      {n.title}
                    </div>
                    <div className="text-caption text-ink-secondary mb-1 line-clamp-2">
                      {n.message}
                    </div>
                    <div className="text-tiny text-ink-muted">
                      {n.createdAt} · {typeLabel(n.type)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
