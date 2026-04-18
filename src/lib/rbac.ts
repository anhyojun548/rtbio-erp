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

/**
 * 경로(prefix)에 대해 사용자 역할이 접근 가능한지 판정.
 * 매트릭스에 없는 경로는 기본 허용 (페이지별 guard 로 위임).
 */
export function canAccessPath(role: UserRole, pathname: string): boolean {
  for (const [prefix, allowed] of Object.entries(ROLE_PORTAL_ACCESS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return allowed.includes(role);
    }
  }
  return true;
}
