/**
 * RBAC 매트릭스 — Edge 런타임 호환 순수 함수.
 * (Next.js middleware 에서 import 시 next-auth/next/navigation 같은
 *  node-only 모듈이 따라오지 않도록 세션 헬퍼와 분리.)
 */
import type { UserRole } from "@prisma/client";

export const ROLE_PORTAL_ACCESS: Record<string, UserRole[]> = {
  "/admin": ["TENANT_OWNER", "ADMIN"],
  "/qc": ["TENANT_OWNER", "QC"],
  "/exec": ["TENANT_OWNER", "ADMIN", "EXEC"],
  "/ceo": ["TENANT_OWNER", "SUPER_ADMIN"],
  "/client": ["CLIENT"],
  "/system": ["SUPER_ADMIN"],
};

/** 포털별 정적 HTML 파일 접근 매트릭스 */
const PORTAL_HTML_ACCESS: Record<string, UserRole[]> = {
  "/portals/admin-portal.html":  ["TENANT_OWNER", "SUPER_ADMIN", "ADMIN"],
  "/portals/qc-portal.html":     ["TENANT_OWNER", "SUPER_ADMIN", "QC"],
  "/portals/exec-portal.html":   ["TENANT_OWNER", "SUPER_ADMIN", "EXEC"],
  "/portals/ceo-portal.html":    ["TENANT_OWNER", "SUPER_ADMIN"],
  "/portals/client-portal.html": ["TENANT_OWNER", "SUPER_ADMIN", "CLIENT"],
};

/**
 * 경로(prefix)에 대해 사용자 역할이 접근 가능한지 판정.
 * 매트릭스에 없는 경로는 기본 허용 (페이지별 guard 로 위임).
 */
export function canAccessPath(role: UserRole, pathname: string): boolean {
  // 1) 정적 자원(css/js)·widget-dashboard: 인증된 모든 역할 허용
  //    (prototype index.html 역할 선택 페이지는 2026-05 제거됨 — NextAuth 로그아웃으로 대체)
  if (
    pathname.startsWith("/portals/css/") ||
    pathname.startsWith("/portals/js/") ||
    pathname === "/portals/widget-dashboard.html"
  ) {
    return true;
  }

  // 2) 포털 HTML — 역할별 접근 제어
  if (pathname in PORTAL_HTML_ACCESS) {
    return PORTAL_HTML_ACCESS[pathname]!.includes(role);
  }

  // 3) 기존 prefix 매트릭스
  for (const [prefix, allowed] of Object.entries(ROLE_PORTAL_ACCESS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return allowed.includes(role);
    }
  }
  return true;
}
