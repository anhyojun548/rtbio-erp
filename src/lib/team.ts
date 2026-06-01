/**
 * 팀 매핑 + 직원관리 권한 술어 (순수 함수).
 *
 * - role → team 1:1 매핑 (DB 컬럼 없음, 앱-레벨 상수)
 * - 메타관리자(ADMIN/TENANT_OWNER) = 자동 effectiveTeamAdmin
 * - canGrantRole: 임원진 → 전체 staff role / 그 외 → 자기 팀 role 만
 */
import type { UserRole } from "@prisma/client";

export const TEAM_BY_ROLE: Record<UserRole, string | null> = {
  SUPER_ADMIN: "system",
  TENANT_OWNER: "executive",
  ADMIN: "finance",
  QC: "quality",
  EXEC: "sales",
  CLIENT: null,
  VIEWER: null,
};

export const TEAM_LABEL: Record<string, string> = {
  system: "시스템",
  executive: "임원진",
  finance: "경영지원",
  quality: "품질관리",
  sales: "영업",
};

/** 직원관리로 부여 가능한 staff role (CLIENT/SUPER_ADMIN/VIEWER 제외) */
export const STAFF_ROLES: UserRole[] = ["TENANT_OWNER", "ADMIN", "QC", "EXEC"];

type Actor = { role: UserRole; isTeamAdmin: boolean };

/** 팀 관리자 지정/해제 권한 (경영지원·임원진) */
export function isMetaAdmin(u: { role: UserRole }): boolean {
  return u.role === "ADMIN" || u.role === "TENANT_OWNER";
}

/** 직원관리 메뉴·기능 접근 권한 (메타관리자는 자동 포함) */
export function isEffectiveTeamAdmin(u: Actor): boolean {
  return u.isTeamAdmin === true || isMetaAdmin(u);
}

/** actor 가 targetRole 의 직원을 만들/바꿀 수 있는가 */
export function canGrantRole(actor: Actor, targetRole: UserRole): boolean {
  if (!STAFF_ROLES.includes(targetRole)) return false; // CLIENT/SUPER_ADMIN/VIEWER 금지
  if (actor.role === "TENANT_OWNER") return true; // 임원진 = 전체
  if (!isEffectiveTeamAdmin(actor)) return false;
  return targetRole === actor.role; // 그 외 = 자기 팀 role 만
}
