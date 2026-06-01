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
import { isEffectiveTeamAdmin, isMetaAdmin } from "@/lib/team";
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
  clientId: string | null;
  isTeamAdmin: boolean;
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
    clientId: session.user.clientId ?? null,
    isTeamAdmin: session.user.isTeamAdmin ?? false,
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

/**
 * CLIENT 포털 전용 — role=CLIENT 이고 clientId 가 세팅된 유저만 통과.
 * TENANT_OWNER/ADMIN 이 CLIENT 포털을 직접 볼 필요는 현재 없으므로 엄격하게 막는다.
 */
export async function requireClient(): Promise<
  SessionUser & { clientId: string }
> {
  const user = await requireAuth();
  if (user.role !== "CLIENT") redirect("/403");
  if (!user.clientId) redirect("/403");
  return user as SessionUser & { clientId: string };
}

/** 직원관리 접근 — effectiveTeamAdmin 아니면 /403 */
export async function requireTeamAdmin(): Promise<SessionUser & { tenantId: string }> {
  const user = await requireAuth();
  if (!user.tenantId) redirect("/403");
  if (!isEffectiveTeamAdmin(user)) redirect("/403");
  return user as SessionUser & { tenantId: string };
}

/** 팀 관리자 지정/해제 — 메타관리자(ADMIN/OWNER) 아니면 /403 */
export async function requireMetaAdmin(): Promise<SessionUser & { tenantId: string }> {
  const user = await requireAuth();
  if (!user.tenantId) redirect("/403");
  if (!isMetaAdmin(user)) redirect("/403");
  return user as SessionUser & { tenantId: string };
}

