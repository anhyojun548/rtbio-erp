"use client";

/**
 * Sidebar — 5개 포털 공용 사이드바
 *
 * prototype 의 다크 네이비 배경 + 흰 글자 디자인 그대로.
 * 메뉴 정의는 src/components/shared/portalMenus.ts 에 분리.
 *
 * 사용:
 *   <Sidebar
 *     menu={ADMIN_MENU}
 *     userName="김소영"
 *     userRole="경영지원팀 팀장"
 *     userAvatar="김"
 *   />
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export interface NavItem {
  /** 메뉴 라벨 */
  label: string;
  /** 이동할 경로 (절대) — 없으면 disabled 처리 */
  href?: string;
  /** 아이콘 (선택, 이모지 또는 텍스트) */
  icon?: string;
  /** 비활성화 처리 */
  disabled?: boolean;
  /** 추가 매칭 prefix — 이 경로로 이동했을 때도 이 메뉴가 active 로 표시됨 */
  matchExtra?: string[];
}

export interface NavSection {
  /** 섹션 타이틀 */
  title?: string;
  /** 섹션 내 메뉴 */
  items: NavItem[];
}

interface SidebarProps {
  /** 메뉴 정의 */
  menu: NavSection[];
  /** 사용자 이름 */
  userName: string;
  /** 사용자 역할 */
  userRole: string;
  /** 아바타 표시 (글자 1자 또는 이모지) */
  userAvatar: string;
  /** 사이드바 헤더 텍스트 (기본 "RTBIO") */
  brandText?: string;
  /** 사이드바 헤더 보조 텍스트 */
  brandSubText?: string;
  /** 푸터 링크 (기본 역할 선택으로) */
  footerHref?: string;
  /** 푸터 텍스트 */
  footerText?: string;
}

export function Sidebar({
  menu,
  userName,
  userRole,
  userAvatar,
  brandText = "RTBIO",
  brandSubText = "ERP",
  footerHref = "/",
  footerText = "← 역할 선택",
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // longest-prefix match — 가장 긴 prefix 가 매칭되도록 (3D-4b 패턴)
  // + matchExtra 보조 매칭: 예) 매입매출장(/admin/journal) 메뉴가 /admin/orders 진입 시에도 active
  const activeHref = (() => {
    let best: string | null = null;
    let bestLen = 0;
    for (const sec of menu) {
      for (const item of sec.items) {
        if (!item.href) continue;
        const candidates = [item.href, ...(item.matchExtra ?? [])];
        for (const c of candidates) {
          if (pathname === c || pathname.startsWith(c + "/")) {
            if (!best || c.length > bestLen) {
              best = item.href;
              bestLen = c.length;
            }
          }
        }
      }
    }
    return best;
  })();

  return (
    <>
      {/* 모바일 햄버거 (사이드바 닫혀있을 때 노출) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-sticky bg-primary text-white w-10 h-10 rounded-xs shadow-md"
        aria-label="메뉴 열기"
      >
        ☰
      </button>

      {/* 백드롭 (모바일) */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-sticky"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar 본체 */}
      <aside
        className={`
          fixed top-0 left-0 bottom-0 w-sidebar bg-primary text-white
          flex flex-col z-sticky transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Brand */}
        <div className="px-5 py-6 border-b border-white/10">
          <div className="text-xl font-bold leading-tight">{brandText}</div>
          {brandSubText && (
            <div className="text-tiny text-white/50 mt-1 tracking-wide">{brandSubText}</div>
          )}
        </div>

        {/* User */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-caption font-bold">
            {userAvatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-caption font-semibold truncate">{userName}</div>
            <div className="text-tiny text-white/50 truncate">{userRole}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 sidebar-scroll">
          {menu.map((sec, secIdx) => (
            <div key={secIdx} className="mb-2">
              {sec.title && (
                <div className="px-5 pt-2 pb-1 text-tiny font-bold text-white/35 uppercase tracking-wider">
                  {sec.title}
                </div>
              )}
              {sec.items.map((item, idx) => {
                const isActive = item.href === activeHref;
                if (item.disabled || !item.href) {
                  return (
                    <div
                      key={idx}
                      className="px-5 py-2 text-caption text-white/30 cursor-not-allowed select-none"
                    >
                      {item.icon && <span className="mr-2">{item.icon}</span>}
                      {item.label}
                    </div>
                  );
                }
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      block px-5 py-2 text-caption transition
                      ${isActive
                        ? "bg-white/10 text-white border-l-4 border-l-accent font-semibold"
                        : "text-white/75 hover:bg-white/5 hover:text-white border-l-4 border-l-transparent"
                      }
                    `}
                  >
                    {item.icon && <span className="mr-2">{item.icon}</span>}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10">
          <Link
            href={footerHref}
            className="text-tiny text-white/60 hover:text-white transition"
          >
            {footerText}
          </Link>
        </div>
      </aside>

      {/* 사이드바 스크롤바 스타일 */}
      <style jsx global>{`
        .sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
        }
        .sidebar-scroll::-webkit-scrollbar       { width: 6px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 3px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </>
  );
}
