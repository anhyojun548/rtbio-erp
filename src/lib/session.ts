/**
 * 서버 컴포넌트/Route Handler 에서 쓸 세션 헬퍼.
 *
 * - `getCurrentUser()`   : 현재 세션 반환 (없으면 null)
 * - `requireAuth()`      : 인증 필수 — 없으면 /login 으로 redirect
 * - `requireRole(...)`   : 특정 롤만 허용 — 아니면 /403
 * - `requireTenant()`    : tenantId 있는 사용자만 (SUPER_ADMIN 제외)
 *
 * RBAC 매트릭스는 `ROLE_PORTAL_ACCESS` 기준 — /admin, /qc, /exec, /ceo, /client.
 */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

// RBAC 매트릭스는 Edge 호환을 위해 별도 파일로 분리 — re-export
export { ROLE_PORTAL_ACCESS, canAccessPath } from "@/lib/rbac";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
  tenantCode: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
    tenantId: session.user.tenantId,
    tenantCode: session.user.tenantCode,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...allowed: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) redirect("/403");
  return user;
}

export async function requireTenant(): Promise<SessionUser & { tenantId: string }> {
  const user = await requireAuth();
  if (!user.tenantId) redirect("/403");
  return user as SessionUser & { tenantId: string };
}

