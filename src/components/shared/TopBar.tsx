"use client";

/**
 * TopBar — 사이드바와 함께 사용하는 상단 헤더
 *
 * - 좌측: 페이지 타이틀 또는 빈 공간 (브랜드는 사이드바에 있음)
 * - 우측: 알림 종 + 사용자명 + 로그아웃
 *
 * 사용:
 *   <TopBar
 *     pageTitle="대시보드"
 *     userName="김소영"
 *     userRole="경영지원팀"
 *     notifications={items}
 *   />
 */

import { signOut } from "next-auth/react";
import { NotificationBell, type NotificationItem } from "./NotificationBell";

interface TopBarProps {
  /** 현재 페이지 타이틀 (선택) */
  pageTitle?: string;
  /** 사용자 이름 */
  userName: string;
  /** 사용자 역할 (admin/qc/exec/ceo/client 등 라벨) */
  userRole: string;
  /** 알림 목록 (선택) */
  notifications?: NotificationItem[];
  /** 알림 읽음 처리 콜백 */
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
}

export function TopBar({
  pageTitle,
  userName,
  userRole,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
}: TopBarProps) {
  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 sticky top-0 z-sticky">
      <div className="flex items-center gap-3">
        {pageTitle && (
          <h1 className="text-h2 m-0">{pageTitle}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* 알림 종 */}
        <NotificationBell
          notifications={notifications}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
        />

        {/* 구분선 */}
        <div className="w-px h-6 bg-border" />

        {/* 사용자 정보 */}
        <div className="flex items-center gap-2 text-caption">
          <span className="font-semibold text-ink">{userName}</span>
          <span className="text-tiny text-ink-muted">({userRole})</span>
        </div>

        {/* 로그아웃 */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="h-8 px-3 border border-border hover:bg-canvas text-ink-secondary text-tiny font-semibold rounded-xs transition"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
