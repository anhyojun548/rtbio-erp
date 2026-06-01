# 팀별 직원 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 각 팀(품질·경영지원·영업·임원진)의 "팀 관리자"가 프로토타입 포털 사이드바에서 자기 팀 직원을 등록/수정/비활성화/비밀번호 재발급할 수 있게 하고, 권한 없는 사용자에게는 메뉴를 통째로 숨긴다.

**Architecture:** `User.isTeamAdmin` Boolean 플래그 + role→team 앱-레벨 매핑. 메타관리자(ADMIN/TENANT_OWNER)는 자동으로 effectiveTeamAdmin. 백엔드는 server action(RBAC + tenantId 스코핑) + `/api/users/*` route. UI 는 프로토타입 HTML 4포털의 `page-staff` SPA 페이지 + 공통 `staff-mgmt.js`.

**Tech Stack:** Next.js 14 App Router · Prisma 5.22 (multiSchema, public.User) · NextAuth v4 (JWT) · bcryptjs · Zod · Vitest · 프로토타입 vanilla JS

**Spec:** `docs/superpowers/specs/2026-06-01-team-staff-management-design.md`

---

## 사전 메모 (구현자 필독)

- **TDD 적용 범위**: 순수 로직(`team.ts`, `validators/user.ts`)은 Vitest 먼저. actions/API 는 `scripts/smoke-users.ts`(실 DB 파이프라인)로 검증. 프로토타입 UI 는 브라우저 수동 검증. — 이 프로젝트의 기존 패턴과 동일.
- **권한 2단계**: route 핸들러는 `session.user` 인증만 확인 → 실제 RBAC 는 server action 내부 `requireRole`/신규 헬퍼가 강제. (`docs/02-design/api-reference.md` §0-1)
- **action 반환 규약**: `ok(data)` / `fail(msg, {fieldErrors})` / `zodFail(zodError)` from `@/lib/action-result`.
- **감사**: `logAudit({ tenantId, userId, action, resource: "User:<id>", metadata })` from `@/lib/audit`. **비밀번호 평문 절대 로그 금지.**
- **UserRole enum (7)**: `SUPER_ADMIN, TENANT_OWNER, ADMIN, QC, EXEC, CLIENT, VIEWER`.
- **로컬 실행 전제**: Docker `rtbio-postgres` 기동 + `npm run dev`. 마이그레이션은 `npx prisma migrate dev`.
- **커밋 메시지**: 한국어 허용, 제목 50자 이내. 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**신규 파일**
| 경로 | 책임 |
|---|---|
| `src/lib/team.ts` | role→team 매핑 + 권한 술어(순수 함수) |
| `src/lib/team.test.ts` | team.ts 단위 테스트 |
| `src/lib/validators/user.ts` | 직원 CRUD Zod 스키마 |
| `src/lib/validators/user.test.ts` | validator 단위 테스트 |
| `src/lib/actions/user.ts` | 직원 server actions (RBAC + tenantId + 감사) |
| `src/app/api/users/route.ts` | GET 목록 / POST 생성 |
| `src/app/api/users/[id]/route.ts` | GET / PATCH / DELETE |
| `src/app/api/users/[id]/password/route.ts` | POST 비번 재발급 |
| `src/app/api/users/[id]/team-admin/route.ts` | POST grant/revoke |
| `src/app/api/me/password/route.ts` | POST 본인 비번 변경 |
| `public/portals/js/staff-mgmt.js` | 4포털 공통 직원관리 UI 모듈 |
| `scripts/smoke-users.ts` | 실 DB 스모크 |

**수정 파일**
| 경로 | 변경 |
|---|---|
| `prisma/schema.prisma` | `User.isTeamAdmin Boolean @default(false)` |
| `prisma/seed.ts` | owner/admin `isTeamAdmin: true` |
| `src/lib/auth.ts` | authorize/jwt/session 에 isTeamAdmin |
| `src/types/next-auth.d.ts` | Session/User/JWT 에 isTeamAdmin |
| `src/lib/session.ts` | SessionUser + getCurrentUser + `requireTeamAdmin`/`requireMetaAdmin` |
| `src/app/api/me/route.ts` | 응답에 isTeamAdmin |
| `public/portals/admin-portal.html` | page-staff + nav-item + gate |
| `public/portals/qc-portal.html` | page-staff + nav-item + gate |
| `public/portals/exec-portal.html` | page-staff + nav-item + gate |
| `public/portals/ceo-portal.html` | page-staff + page-team-admins + nav-item ×2 |
| `docs/02-design/api-reference.md` | §직원 관리 추가 |

---

## Phase A — 토대 (스키마 + 권한 술어 + 세션)

### Task A1: User.isTeamAdmin 스키마 + 마이그레이션 + 시드

**Files:**
- Modify: `prisma/schema.prisma` (User 모델)
- Create: `prisma/migrations/<timestamp>_add_user_is_team_admin/migration.sql`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: schema.prisma 에 컬럼 추가**

`model User` 블록에서 `clientId` 인근에 추가:
```prisma
  isTeamAdmin Boolean  @default(false) // 팀 관리자(QC·EXEC 리더 승격). ADMIN/OWNER 는 자동 effectiveTeamAdmin
```

- [ ] **Step 2: 마이그레이션 생성**

Run: `npx prisma migrate dev --name add_user_is_team_admin`
Expected: 새 마이그레이션 폴더 생성 + `ALTER TABLE "public"."User" ADD COLUMN "isTeamAdmin" BOOLEAN NOT NULL DEFAULT false;` 적용 + `prisma generate` 자동 실행.

- [ ] **Step 3: 시드에 owner/admin 플래그**

`prisma/seed.ts` 에서 `owner@altibio.local`, `admin@altibio.local` user upsert 의 `create`/`update` 데이터에 `isTeamAdmin: true` 추가. (나머지 QC/EXEC 는 default false 유지)

- [ ] **Step 4: 시드 재실행 + 검증**

Run: `npx prisma db seed`
Run: `docker exec rtbio-postgres psql -U rtbio -d rtbio_erp -c "SELECT email, role, \"isTeamAdmin\" FROM public.\"User\" WHERE role NOT IN ('CLIENT') ORDER BY role;"`
Expected: owner/admin = t, qc/sales = f.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat(schema): User.isTeamAdmin 컬럼 + 시드 owner/admin true"
```

---

### Task A2: team.ts 권한 술어 (TDD)

**Files:**
- Create: `src/lib/team.ts`
- Test: `src/lib/team.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/team.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { TEAM_BY_ROLE, isMetaAdmin, isEffectiveTeamAdmin, canGrantRole } from "./team";

type U = { role: any; isTeamAdmin: boolean };
const owner: U = { role: "TENANT_OWNER", isTeamAdmin: true };
const adminPlain: U = { role: "ADMIN", isTeamAdmin: false };
const qcLead: U = { role: "QC", isTeamAdmin: true };
const qcStaff: U = { role: "QC", isTeamAdmin: false };
const execLead: U = { role: "EXEC", isTeamAdmin: true };

describe("TEAM_BY_ROLE", () => {
  it("maps roles to teams", () => {
    expect(TEAM_BY_ROLE.QC).toBe("quality");
    expect(TEAM_BY_ROLE.ADMIN).toBe("finance");
    expect(TEAM_BY_ROLE.EXEC).toBe("sales");
    expect(TEAM_BY_ROLE.TENANT_OWNER).toBe("executive");
    expect(TEAM_BY_ROLE.CLIENT).toBeNull();
  });
});

describe("isMetaAdmin", () => {
  it("ADMIN/OWNER are meta admins", () => {
    expect(isMetaAdmin(adminPlain)).toBe(true);
    expect(isMetaAdmin(owner)).toBe(true);
  });
  it("QC/EXEC are not, even as team admin", () => {
    expect(isMetaAdmin(qcLead)).toBe(false);
    expect(isMetaAdmin(execLead)).toBe(false);
  });
});

describe("isEffectiveTeamAdmin", () => {
  it("meta admins are auto effective", () => {
    expect(isEffectiveTeamAdmin(adminPlain)).toBe(true);
  });
  it("QC needs the flag", () => {
    expect(isEffectiveTeamAdmin(qcLead)).toBe(true);
    expect(isEffectiveTeamAdmin(qcStaff)).toBe(false);
  });
});

describe("canGrantRole", () => {
  it("owner can grant any staff role", () => {
    expect(canGrantRole(owner, "QC")).toBe(true);
    expect(canGrantRole(owner, "ADMIN")).toBe(true);
    expect(canGrantRole(owner, "TENANT_OWNER")).toBe(true);
  });
  it("QC lead can only grant QC", () => {
    expect(canGrantRole(qcLead, "QC")).toBe(true);
    expect(canGrantRole(qcLead, "ADMIN")).toBe(false);
    expect(canGrantRole(qcLead, "EXEC")).toBe(false);
  });
  it("ADMIN (non-owner) can only grant ADMIN", () => {
    expect(canGrantRole(adminPlain, "ADMIN")).toBe(true);
    expect(canGrantRole(adminPlain, "QC")).toBe(false);
  });
  it("nobody can grant CLIENT or SUPER_ADMIN via staff mgmt", () => {
    expect(canGrantRole(owner, "CLIENT")).toBe(false);
    expect(canGrantRole(owner, "SUPER_ADMIN")).toBe(false);
    expect(canGrantRole(owner, "VIEWER")).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/team.test.ts`
Expected: FAIL — "Cannot find module './team'".

- [ ] **Step 3: team.ts 구현**

`src/lib/team.ts`:
```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/team.test.ts`
Expected: PASS (모든 케이스).

- [ ] **Step 5: Commit**

```bash
git add src/lib/team.ts src/lib/team.test.ts
git commit -m "feat(team): role→team 매핑 + 권한 술어 (canGrantRole 등)"
```

---

### Task A3: 세션에 isTeamAdmin 전파 + 헬퍼

**Files:**
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts:48-56,62-70,73-81`
- Modify: `src/lib/session.ts`
- Modify: `src/app/api/me/route.ts`

- [ ] **Step 1: next-auth.d.ts 타입 확장**

`Session.user`, `User`, `JWT` 인터페이스 각각에 `isTeamAdmin: boolean;` 추가 (clientId 줄 바로 아래).

- [ ] **Step 2: auth.ts authorize 반환에 추가**

`src/lib/auth.ts` authorize 의 return 객체(48-56줄)에 추가:
```ts
        isTeamAdmin: user.isTeamAdmin,
```

- [ ] **Step 3: auth.ts jwt 콜백에 추가**

jwt 콜백 `if (user)` 블록(62-70줄)에 추가:
```ts
        token.isTeamAdmin = (user as { isTeamAdmin: boolean }).isTeamAdmin ?? false;
```

- [ ] **Step 4: auth.ts session 콜백에 추가**

session 콜백 `session.user` 객체(73-81줄)에 추가:
```ts
        isTeamAdmin: (token.isTeamAdmin as boolean) ?? false,
```

- [ ] **Step 5: session.ts SessionUser + getCurrentUser + 헬퍼**

`SessionUser` 타입에 `isTeamAdmin: boolean;` 추가. `getCurrentUser` 반환 객체에 `isTeamAdmin: session.user.isTeamAdmin ?? false,` 추가. 파일 끝에 헬퍼 추가:
```ts
import { isEffectiveTeamAdmin, isMetaAdmin } from "@/lib/team";

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
```

- [ ] **Step 6: /api/me 응답에 추가**

`src/app/api/me/route.ts` 응답 객체에 `isTeamAdmin: u.isTeamAdmin ?? false,` 추가.

- [ ] **Step 7: 타입 체크 + 재로그인 검증**

Run: `npx tsc --noEmit`
Expected: 에러 없음.
Run: dev 서버 재시작 후 admin 로그인 → `curl -s --cookie <세션> http://localhost:3000/api/me` 또는 브라우저 콘솔에서 `fetch('/api/me').then(r=>r.json()).then(console.log)`.
Expected: 응답에 `isTeamAdmin: true` (admin).

- [ ] **Step 8: Commit**

```bash
git add src/types/next-auth.d.ts src/lib/auth.ts src/lib/session.ts src/app/api/me/route.ts
git commit -m "feat(auth): 세션·JWT·me 에 isTeamAdmin 전파 + requireTeamAdmin/requireMetaAdmin"
```

---

## Phase B — Validator + Actions

### Task B1: validators/user.ts (TDD)

**Files:**
- Create: `src/lib/validators/user.ts`
- Test: `src/lib/validators/user.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/validators/user.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  createUserSchema, updateUserSchema, resetPasswordSchema, changePasswordSchema,
} from "./user";

describe("createUserSchema", () => {
  it("accepts valid input", () => {
    const r = createUserSchema.safeParse({
      name: "홍길동", email: "hong@altibio.local", role: "QC",
      phone: "010-1234-5678", tempPassword: "altibio123!",
    });
    expect(r.success).toBe(true);
  });
  it("rejects short password", () => {
    const r = createUserSchema.safeParse({
      name: "홍길동", email: "hong@altibio.local", role: "QC", tempPassword: "short",
    });
    expect(r.success).toBe(false);
  });
  it("rejects bad email", () => {
    const r = createUserSchema.safeParse({
      name: "홍길동", email: "not-email", role: "QC", tempPassword: "altibio123!",
    });
    expect(r.success).toBe(false);
  });
  it("rejects non-staff role at schema level (CLIENT)", () => {
    const r = createUserSchema.safeParse({
      name: "x", email: "x@altibio.local", role: "CLIENT", tempPassword: "altibio123!",
    });
    expect(r.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("requires current and next ≥ 8", () => {
    expect(changePasswordSchema.safeParse({ current: "old12345", next: "new12345" }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ current: "old12345", next: "short" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/validators/user.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: validators/user.ts 구현**

```ts
import { z } from "zod";

/** 직원관리로 부여 가능한 role (CLIENT/SUPER_ADMIN/VIEWER 제외) */
export const staffRoleEnum = z.enum(["TENANT_OWNER", "ADMIN", "QC", "EXEC"]);

const passwordField = z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(72);
const nameField = z.string().trim().min(1, "이름을 입력하세요.").max(50);
const phoneField = z.string().trim().max(20).optional().or(z.literal("")).transform((v) => v || undefined);

export const createUserSchema = z.object({
  name: nameField,
  email: z.string().trim().email("올바른 이메일 형식이 아닙니다.").max(120),
  role: staffRoleEnum,
  phone: phoneField,
  tempPassword: passwordField,
});

export const updateUserSchema = z.object({
  name: nameField.optional(),
  phone: phoneField,
  role: staffRoleEnum.optional(),
  active: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  tempPassword: passwordField,
});

export const changePasswordSchema = z.object({
  current: z.string().min(1, "현재 비밀번호를 입력하세요."),
  next: passwordField,
});

export const teamAdminToggleSchema = z.object({
  grant: z.boolean(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/validators/user.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/user.ts src/lib/validators/user.test.ts
git commit -m "feat(validators): 직원 CRUD Zod 스키마"
```

---

### Task B2: actions/user.ts — 조회 + 생성

**Files:**
- Create: `src/lib/actions/user.ts`

> **의존성:** 이 Task 는 **Task A3 완료 후**에만 tsc 가 통과한다. `SessionUser` 에 `isTeamAdmin` 이 추가되어야 `canGrantRole(me, ...)` 가 타입 통과. A3 를 건너뛰면 Step 2b tsc 가 실패한다.

- [ ] **Step 1: 조회 액션 작성**

`src/lib/actions/user.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, requireMetaAdmin, requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { TEAM_BY_ROLE, canGrantRole, isMetaAdmin, STAFF_ROLES } from "@/lib/team";
import {
  createUserSchema, updateUserSchema, resetPasswordSchema, changePasswordSchema,
} from "@/lib/validators/user";
import { ok, fail, zodFail } from "@/lib/action-result";

const SAFE_SELECT = {
  id: true, email: true, name: true, role: true, phone: true,
  active: true, isTeamAdmin: true, lastLoginAt: true, createdAt: true,
} satisfies Prisma.UserSelect;

/** 직원 목록 — tenantId 강제 + CLIENT 제외 + 비메타는 자기 팀만 */
export async function listUsers(opts?: { role?: string; active?: string; q?: string }) {
  const me = await requireTeamAdmin();
  const where: Prisma.UserWhereInput = {
    tenantId: me.tenantId,
    role: { in: STAFF_ROLES as UserRole[] },
  };
  // 비메타관리자(QC/EXEC 리더)는 자기 role(팀)만
  if (!isMetaAdmin(me)) where.role = me.role;
  else if (opts?.role && STAFF_ROLES.includes(opts.role as UserRole)) {
    where.role = opts.role as UserRole;
  }
  if (opts?.active === "true") where.active = true;
  if (opts?.active === "false") where.active = false;
  if (opts?.q) {
    where.OR = [
      { name: { contains: opts.q, mode: "insensitive" } },
      { email: { contains: opts.q, mode: "insensitive" } },
    ];
  }
  return prisma.user.findMany({ where, select: SAFE_SELECT, orderBy: [{ role: "asc" }, { name: "asc" }] });
}

export async function getUser(id: string) {
  const me = await requireTeamAdmin();
  const u = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId, role: { in: STAFF_ROLES as UserRole[] } },
    select: SAFE_SELECT,
  });
  if (!u) return null;
  if (!isMetaAdmin(me) && u.role !== me.role) return null; // 타 팀 차단
  return u;
}
```

- [ ] **Step 2: 생성 액션 추가 (같은 파일)**

```ts
export async function createUser(input: unknown) {
  const me = await requireTeamAdmin();
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  if (!canGrantRole(me, data.role)) {
    return fail("해당 직급의 직원을 만들 권한이 없습니다.", { fieldErrors: { role: ["권한 없음"] } });
  }
  const dup = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (dup) return fail("이미 사용 중인 이메일입니다.", { fieldErrors: { email: ["중복"] } });

  const hash = await bcrypt.hash(data.tempPassword, 10);
  const created = await prisma.user.create({
    data: {
      email: data.email, name: data.name, role: data.role, phone: data.phone ?? null,
      password: hash, tenantId: me.tenantId, isTeamAdmin: false, active: true, createdBy: me.id,
    },
    select: SAFE_SELECT,
  });
  logAudit({
    tenantId: me.tenantId, userId: me.id, action: "USER_CREATE", resource: `User:${created.id}`,
    metadata: { targetRole: created.role, team: TEAM_BY_ROLE[created.role] },
  });
  revalidatePath("/portals/admin-portal.html");
  return ok(created);
}
```

- [ ] **Step 2b: tsc 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (createdBy 컬럼이 User 에 있는지 확인 — 없으면 제거.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/user.ts
git commit -m "feat(actions): listUsers/getUser/createUser (tenantId 스코핑 + canGrantRole)"
```

---

### Task B3: actions/user.ts — 수정 + 비활성화(가드) + 비번 재발급

**Files:**
- Modify: `src/lib/actions/user.ts`

- [ ] **Step 1: 공통 소유권 헬퍼 + updateUser**

```ts
/** 내 테넌트 + (비메타면 같은 팀) 직원인지 확인하고 반환 */
async function loadManageableUser(me: Awaited<ReturnType<typeof requireTeamAdmin>>, id: string) {
  const u = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId, role: { in: STAFF_ROLES as UserRole[] } },
    select: { id: true, role: true, active: true },
  });
  if (!u) return null;
  if (!isMetaAdmin(me) && u.role !== me.role) return null;
  return u;
}

export async function updateUser(id: string, input: unknown) {
  const me = await requireTeamAdmin();
  if (id === me.id) return fail("본인 계정은 이 화면에서 수정할 수 없습니다.");
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const target = await loadManageableUser(me, id);
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");
  const d = parsed.data;
  if (d.role && d.role !== target.role && !canGrantRole(me, d.role)) {
    return fail("해당 직급으로 변경할 권한이 없습니다.", { fieldErrors: { role: ["권한 없음"] } });
  }
  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(d.name !== undefined && { name: d.name }),
      ...(d.phone !== undefined && { phone: d.phone ?? null }),
      ...(d.role !== undefined && { role: d.role }),
      ...(d.active !== undefined && { active: d.active }),
    },
    select: SAFE_SELECT,
  });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_UPDATE", resource: `User:${id}`, metadata: { changes: d } });
  revalidatePath("/portals/admin-portal.html");
  return ok(updated);
}
```

- [ ] **Step 2: deactivateUser (가드 3종)**

```ts
/** 비활성화 — soft. 본인/마지막 owner 차단 + 영업담당자 경고 */
export async function deactivateUser(id: string) {
  const me = await requireTeamAdmin();
  if (id === me.id) return fail("본인 계정은 비활성화할 수 없습니다.");
  const target = await loadManageableUser(me, id);
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");

  // 마지막 활성 owner 차단
  if (target.role === "TENANT_OWNER") {
    const owners = await prisma.user.count({ where: { tenantId: me.tenantId, role: "TENANT_OWNER", active: true } });
    if (owners <= 1) return fail("마지막 임원진(대표) 계정은 비활성화할 수 없습니다.");
  }
  // 영업담당자 경고 (차단 아님 — affectedCount 반환)
  let warning: string | undefined;
  let affectedCount = 0;
  if (target.role === "EXEC") {
    const [direct, assigned] = await Promise.all([
      prisma.client.count({ where: { salesRepId: id, active: true } }),
      prisma.salesAssignment.count({ where: { salesRepId: id, active: true } }),
    ]);
    affectedCount = direct + assigned;
    if (affectedCount > 0) warning = `이 직원에게 배정된 활성 거래처 ${affectedCount}곳이 있습니다.`;
  }
  await prisma.user.update({ where: { id }, data: { active: false } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_DEACTIVATE", resource: `User:${id}`, metadata: { role: target.role, affectedCount } });
  revalidatePath("/portals/admin-portal.html");
  return ok({ id, warning, affectedCount });
}

export async function reactivateUser(id: string) {
  const me = await requireTeamAdmin();
  const target = await loadManageableUser(me, id);
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");
  await prisma.user.update({ where: { id }, data: { active: true } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_REACTIVATE", resource: `User:${id}` });
  revalidatePath("/portals/admin-portal.html");
  return ok({ id });
}
```

> **구현자 주의:** `prisma.salesAssignment` 의 필드명(`salesRepId`, `active`)이 실제 스키마와 맞는지 `SalesAssignment` 모델에서 확인. 다르면 맞춰 수정. (이전 exec.ts 가 `SalesAssignment{active:true}` 사용 — 존재 확인됨)
>
> **⚠️ 크로스스키마:** `Client`/`SalesAssignment` 는 `tenant_altibio` 스키마이며 **`tenantId` 컬럼이 없다.** 따라서 위 count 쿼리에 `tenantId` 필터를 **추가하지 말 것** (현재 단일 테넌트 + 기존 exec.ts 와 동일 패턴). `salesRepId` 만으로 필터한다.

- [ ] **Step 3: resetUserPassword**

```ts
export async function resetUserPassword(id: string, input: unknown) {
  const me = await requireTeamAdmin();
  if (id === me.id) return fail("본인 비밀번호는 '내 정보'에서 변경하세요.");
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const target = await loadManageableUser(me, id);
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");
  const hash = await bcrypt.hash(parsed.data.tempPassword, 10);
  await prisma.user.update({ where: { id }, data: { password: hash } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_PASSWORD_RESET", resource: `User:${id}` });
  return ok({ id });
}
```

- [ ] **Step 4: tsc 체크 + Commit**

Run: `npx tsc --noEmit` → 에러 없음.
```bash
git add src/lib/actions/user.ts
git commit -m "feat(actions): updateUser/deactivateUser(가드)/resetUserPassword"
```

---

### Task B4: actions/user.ts — 팀관리자 토글 + 본인 비번 변경

**Files:**
- Modify: `src/lib/actions/user.ts`

- [ ] **Step 1: toggleTeamAdmin (메타관리자 전용)**

```ts
export async function toggleTeamAdmin(id: string, grant: boolean) {
  const me = await requireMetaAdmin();
  if (id === me.id) return fail("본인의 팀 관리자 권한은 변경할 수 없습니다.");
  const target = await prisma.user.findFirst({
    where: { id, tenantId: me.tenantId, role: { in: STAFF_ROLES as UserRole[] } },
    select: { id: true, role: true },
  });
  if (!target) return fail("대상 직원을 찾을 수 없습니다.");
  await prisma.user.update({ where: { id }, data: { isTeamAdmin: grant } });
  logAudit({
    tenantId: me.tenantId, userId: me.id,
    action: grant ? "USER_TEAM_ADMIN_GRANT" : "USER_TEAM_ADMIN_REVOKE",
    resource: `User:${id}`, metadata: { team: TEAM_BY_ROLE[target.role] },
  });
  revalidatePath("/portals/ceo-portal.html");
  return ok({ id, isTeamAdmin: grant });
}
```

- [ ] **Step 2: changeMyPassword (본인)**

```ts
export async function changeMyPassword(input: unknown) {
  const me = await requireAuth();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const row = await prisma.user.findUnique({ where: { id: me.id }, select: { password: true } });
  if (!row) return fail("사용자를 찾을 수 없습니다.");
  const okPw = await bcrypt.compare(parsed.data.current, row.password);
  if (!okPw) return fail("현재 비밀번호가 일치하지 않습니다.", { fieldErrors: { current: ["불일치"] } });
  const hash = await bcrypt.hash(parsed.data.next, 10);
  await prisma.user.update({ where: { id: me.id }, data: { password: hash } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "USER_PASSWORD_CHANGE_SELF", resource: `User:${me.id}` });
  return ok({ id: me.id });
}

/** ceo 팀관리자 지정 화면용 — 전체 staff (메타관리자 전용) */
export async function listAllStaff() {
  const me = await requireMetaAdmin();
  return prisma.user.findMany({
    where: { tenantId: me.tenantId, role: { in: STAFF_ROLES as UserRole[] } },
    select: SAFE_SELECT, orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}
```

- [ ] **Step 3: tsc 체크 + Commit**

Run: `npx tsc --noEmit` → 에러 없음.
```bash
git add src/lib/actions/user.ts
git commit -m "feat(actions): toggleTeamAdmin/changeMyPassword/listAllStaff"
```

---

## Phase C — API routes

### Task C1: /api/users (GET, POST)

**Files:**
- Create: `src/app/api/users/route.ts`

- [ ] **Step 1: route 작성** (패턴: `src/app/api/data-usage/route.ts`)

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers, createUser } from "@/lib/actions/user";

const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const url = new URL(req.url);
  const rows = await listUsers({
    role: url.searchParams.get("role") ?? undefined,
    active: url.searchParams.get("active") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const res = await createUser(body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data, { status: 201 });
}
```

- [ ] **Step 2: tsc + Commit**

Run: `npx tsc --noEmit` → 에러 없음.
```bash
git add src/app/api/users/route.ts
git commit -m "feat(api): GET/POST /api/users"
```

---

### Task C2: /api/users/[id] (GET, PATCH, DELETE)

**Files:**
- Create: `src/app/api/users/[id]/route.ts`

- [ ] **Step 1: route 작성**

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUser, updateUser, deactivateUser } from "@/lib/actions/user";

type Ctx = { params: { id: string } };
const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const u = await getUser(params.id);
  if (!u) return Response.json({ ok: false, error: "Not Found" }, { status: 404 });
  return Response.json(u);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const res = await updateUser(params.id, body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const res = await deactivateUser(params.id);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });
  return Response.json(res.data); // { id, warning?, affectedCount }
}
```

- [ ] **Step 2: tsc + Commit**

```bash
git add src/app/api/users/[id]/route.ts
git commit -m "feat(api): GET/PATCH/DELETE /api/users/[id]"
```

---

### Task C3: 비번 재발급 + 팀관리자 토글 + 본인 비번

**Files:**
- Create: `src/app/api/users/[id]/password/route.ts`
- Create: `src/app/api/users/[id]/team-admin/route.ts`
- Create: `src/app/api/me/password/route.ts`

- [ ] **Step 1: password route**

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resetUserPassword } from "@/lib/actions/user";
type Ctx = { params: { id: string } };
export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await resetUserPassword(params.id, body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data);
}
```

- [ ] **Step 2: team-admin route**

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toggleTeamAdmin } from "@/lib/actions/user";
import { teamAdminToggleSchema } from "@/lib/validators/user";
type Ctx = { params: { id: string } };
export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = teamAdminToggleSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "grant(boolean) 필요" }, { status: 400 });
  const res = await toggleTeamAdmin(params.id, parsed.data.grant);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });
  return Response.json(res.data);
}
```

- [ ] **Step 3: me/password route**

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changeMyPassword } from "@/lib/actions/user";
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await changeMyPassword(body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data);
}
```

- [ ] **Step 4: tsc + 전체 vitest + Commit**

Run: `npx tsc --noEmit` → 에러 없음.
Run: `npx vitest run` → 기존 전체 + 신규 통과.
```bash
git add src/app/api/users src/app/api/me/password
git commit -m "feat(api): 비번 재발급·팀관리자 토글·본인 비번 변경 endpoint"
```

---

## Phase D — 스모크 (실 DB 검증)

### Task D1: scripts/smoke-users.ts

**Files:**
- Create: `scripts/smoke-users.ts`

- [ ] **Step 1: 스모크 스크립트 작성**

기존 `scripts/smoke-*.ts` 패턴을 따라, action 을 직접 import 하지 말고(세션 의존) **prisma 직접 + team.ts 술어 + bcrypt** 로 검증하는 시나리오를 작성:
1. 임시 QC 직원 생성(bcrypt) → 조회 → `isEffectiveTeamAdmin` false 확인
2. `canGrantRole(qcLead, "QC")===true`, `canGrantRole(qcLead, "ADMIN")===false`
3. 비번 재발급 후 `bcrypt.compare` 새 값 일치
4. isTeamAdmin grant → `isEffectiveTeamAdmin` true
5. 마지막 owner 카운트 가드 로직 검증(owner 1명일 때 차단 조건 true)
6. 정리(생성한 임시 직원 삭제)

> action 레이어는 세션을 요구하므로 스모크는 "순수 술어 + DB 상태"를 검증한다. action 자체의 RBAC 는 브라우저 검증(Phase F)에서 확인.

- [ ] **Step 2: 실행**

Run: `npx tsx scripts/smoke-users.ts` (또는 프로젝트의 스모크 실행 방식)
Expected: 모든 시나리오 PASS 로그 + 임시 데이터 정리됨.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-users.ts
git commit -m "test(smoke): 직원관리 술어 + DB 파이프라인 검증"
```

---

## Phase E — 프로토타입 UI (4포털)

> 참고 패턴: `public/portals/js/client-mgmt.js` (buildXPageHTML + renderX + window.* 함수 + showModal/showToast). 사이드바 `.nav-item` 구조는 `admin-portal.html:561-601`. 메뉴 게이트는 `window.CURRENT_USER`.

### Task E1: js/staff-mgmt.js 공통 모듈

**Files:**
- Create: `public/portals/js/staff-mgmt.js`

- [ ] **Step 1: 모듈 골격 + 페이지 빌더**

`buildStaffMgmtPageHTML()` — 헤더 + 검색바(이름/이메일 input, role 필터 select, "+ 신규 직원" 버튼) + 직원 테이블 컨테이너. role 필터/등록 select 옵션은 `window.CURRENT_USER` 기준:
- 메타관리자(ADMIN/OWNER) → role 옵션 전체(STAFF_ROLES) + (OWNER 면 TENANT_OWNER 포함)
- QC/EXEC 리더 → 자기 role 1개만

- [ ] **Step 2: renderStaff(filter) — GET /api/users**

`fetch('/api/users?role=&active=&q=')` → 테이블 렌더(이름·이메일·role 한글·활성 뱃지·최근 로그인·액션 버튼[수정/비활성/비번재발급]). `_safeJson` 패턴(content-type 확인)으로 307/403 방어.

- [ ] **Step 3: 등록/수정/비번 모달 + fetch**

- `showNewStaffForm()` → 모달(이름·이메일·role·전화·임시비번) → `POST /api/users` → 성공 시 toast + renderStaff.
- `editStaff(id)` → 모달(이름·전화·role[권한 되면]·활성) → `PATCH /api/users/[id]`.
- `deactivateStaff(id)` → 먼저 `confirm("비활성화하시겠습니까?")` → `DELETE /api/users/[id]` → **비활성화는 이미 수행된 후** 응답의 `warning`(영업담당자 등)을 toast 로 사후 안내("비활성화됨 — 주의: 배정된 거래처 N곳"). 즉 warning 은 사전 경고가 아니라 사후 고지임을 UI 문구에 반영.
- `resetStaffPassword(id)` → 모달(새 임시비번) → `POST /api/users/[id]/password` → "직원에게 전달하세요" 안내.

- [ ] **Step 4: 브라우저 로드 확인 (admin 연결 후 Task E2 에서)**

이 단계는 E2 와 함께 검증.

- [ ] **Step 5: Commit**

```bash
git add public/portals/js/staff-mgmt.js
git commit -m "feat(portal): staff-mgmt.js 공통 직원관리 모듈"
```

---

### Task E2: admin-portal.html 연결 + 사이드바 게이트

**Files:**
- Modify: `public/portals/admin-portal.html`

- [ ] **Step 1: 스크립트 로드 + page-staff 컨테이너**

`<script src="js/staff-mgmt.js"></script>` 추가(다른 *-mgmt.js 인근). `<div id="page-staff" class="page"></div>` 추가.

- [ ] **Step 2: 사이드바 nav-item + 게이트**

"관리" 섹션에 추가:
```html
<div class="nav-item" id="nav-staff" data-page="page-staff" onclick="goTo('page-staff')" style="display:none">직원 관리</div>
```
init 스크립트(또는 data-loader 이후)에서:
```js
if (window.CURRENT_USER && (CURRENT_USER.isTeamAdmin || ['ADMIN','TENANT_OWNER'].includes(CURRENT_USER.role))) {
  var el = document.getElementById('nav-staff');
  if (el) el.style.display = '';
}
```
`goTo('page-staff')` 진입 시 `buildStaffMgmtPageHTML()` 주입 + `renderStaff('')` 호출(다른 페이지 lazy-init 패턴과 동일).

- [ ] **Step 3: 브라우저 검증**

dev 서버 + admin 로그인 → 사이드바 "직원 관리" 보임 → 클릭 → 5명 목록 → 신규 QC 직원 등록 → 목록 갱신 → 비번 재발급 → 비활성/재활성. EXEC 비활성 시 경고 확인.

- [ ] **Step 4: Commit**

```bash
git add public/portals/admin-portal.html
git commit -m "feat(portal): admin 직원관리 페이지 + 사이드바 게이트"
```

---

### Task E3: qc/exec-portal 연결

**Files:**
- Modify: `public/portals/qc-portal.html`, `public/portals/exec-portal.html`

- [ ] **Step 1: 각 포털에 E2 와 동일 패턴 적용** (스크립트 로드 + page-staff + nav-item + 게이트). QC/EXEC 는 비메타라 게이트 조건이 `CURRENT_USER.isTeamAdmin` 으로만 통과(role 분기는 동일 코드).

- [ ] **Step 2: 브라우저 검증** — QC 리더(isTeamAdmin=true)로 로그인 시 메뉴 보임 / 일반 QC(false)는 안 보임. (시드에 QC 리더 1명 isTeamAdmin=true 임시 설정해 확인 후 원복, 또는 ceo 에서 grant)

- [ ] **Step 3: Commit**

```bash
git add public/portals/qc-portal.html public/portals/exec-portal.html
git commit -m "feat(portal): qc·exec 직원관리 페이지 + 게이트"
```

---

### Task E4: ceo-portal — 직원관리 + 팀관리자 지정

**Files:**
- Modify: `public/portals/ceo-portal.html`

- [ ] **Step 1: page-staff (E2 동일) + page-team-admins 추가**

`page-team-admins`: `listAllStaff` 대응 — `GET /api/users`(메타라 전체) → 팀별 그룹 테이블 + 각 행 isTeamAdmin 토글 버튼(`POST /api/users/[id]/team-admin {grant}`). nav-item 2개:
```html
<div class="nav-item" id="nav-staff" data-page="page-staff" onclick="goTo('page-staff')" style="display:none">직원 관리</div>
<div class="nav-item" id="nav-team-admins" data-page="page-team-admins" onclick="goTo('page-team-admins')" style="display:none">팀 관리자 지정</div>
```
게이트: `nav-staff` 는 effectiveTeamAdmin, `nav-team-admins` 는 `['ADMIN','TENANT_OWNER'].includes(role)`.

- [ ] **Step 2: 팀관리자 토글 함수** — `toggleTeamAdminUI(id, grant)` → fetch → toast + 재렌더.

- [ ] **Step 3: 브라우저 검증** — owner 로그인 → "팀 관리자 지정" 보임 → QC 직원 grant → 그 QC 계정으로 로그인 시 "직원 관리" 메뉴 노출 확인 → revoke 후 사라짐 확인.

- [ ] **Step 4: Commit**

```bash
git add public/portals/ceo-portal.html
git commit -m "feat(portal): ceo 직원관리 + 팀관리자 지정 페이지"
```

---

### Task E5: 본인 비밀번호 변경 폼

**Files:**
- Modify: 4개 포털 계정/프로필 영역 (있는 포털) + `staff-mgmt.js` 에 공통 함수

- [ ] **Step 1: `changeMyPasswordUI()` 공통 함수** — 모달(현재/새 비번) → `POST /api/me/password`. 각 포털 계정 영역(또는 사이드바 footer)에 "비밀번호 변경" 링크 추가.

- [ ] **Step 2: 브라우저 검증** — 변경 후 로그아웃 → 새 비번 로그인 성공.

- [ ] **Step 3: Commit**

```bash
git add public/portals staff-mgmt 관련
git commit -m "feat(portal): 본인 비밀번호 변경 폼"
```

---

## Phase F — 문서 + 최종 검증

### Task F1: api-reference.md §직원 관리

**Files:**
- Modify: `docs/02-design/api-reference.md`

- [ ] **Step 1: §직원 관리 섹션 추가** — 8개 endpoint(표) + 권한(effectiveTeamAdmin/metaAdmin) + 2단계 권한 주석 + tenantId 스코핑 명시. route 수 64→69 로 헤더 갱신.

- [ ] **Step 2: Commit**

```bash
git add docs/02-design/api-reference.md
git commit -m "docs(api): 직원 관리 endpoint 추가"
```

---

### Task F2: 전체 회귀 + 최종 브라우저 QA

- [ ] **Step 1: 전체 테스트**

Run: `npx tsc --noEmit` → 클린.
Run: `npx vitest run` → 전체 통과(기존 + 신규 ~35건).

- [ ] **Step 2: 풀 시나리오 브라우저 QA**

| 검증 | 기대 |
|---|---|
| 일반 QC 로그인 | 사이드바에 "직원 관리" **없음** |
| owner → ceo "팀 관리자 지정" → QC grant | 해당 QC 재로그인 시 "직원 관리" 노출 |
| QC 리더가 신규 직원 등록 | role select 에 QC 만 / ADMIN 시도 시 400 |
| owner 가 신규 직원 등록 | 전체 role 선택 가능 |
| EXEC 비활성화(담당 거래처 보유) | warning 메시지 표시 |
| 마지막 owner 비활성화 | 400 차단 |
| 본인 계정 비활성/비번재발급 시도 | 400 차단 |
| 타 포털 직접 URL 접근(권한 없음) | 데이터 안 옴(403) |
| 본인 비밀번호 변경 → 재로그인 | 새 비번 성공 |

- [ ] **Step 3: 최종 커밋(있으면)**

```bash
git add -A
git commit -m "test: 직원관리 회귀 + 브라우저 QA 통과"
```

---

## 완료 기준 (Definition of Done)

- [ ] `User.isTeamAdmin` 마이그레이션 적용 + 시드 반영
- [ ] team.ts/validators 단위 테스트 통과, 전체 vitest 그린, tsc 클린
- [ ] 8개 endpoint 동작 + tenantId 스코핑 + 가드(본인/마지막owner/영업담당자)
- [ ] 4포털 "직원 관리" 메뉴 권한 게이트(없으면 통째 숨김) 브라우저 확인
- [ ] ceo "팀 관리자 지정" grant→메뉴 노출, revoke→숨김 확인
- [ ] api-reference.md 갱신
- [ ] 비밀번호 평문이 로그/응답 어디에도 없음

## 리스크 / 주의

1. **`createdBy` 컬럼**: User 모델에 `createdBy` 있으면 createUser 에 포함, 없으면 제거(Task B2 Step 2b 에서 tsc 로 확인).
2. **SalesAssignment 필드명**: `salesRepId`/`active` 실제 스키마 확인(Task B3 주의 박스).
3. **프로토타입 lazy-init**: 각 포털의 page 진입 패턴(goTo 가 HTML 주입하는지, 미리 렌더하는지)이 포털마다 미묘하게 다를 수 있음 — 기존 page-clients 패턴을 그 포털에서 그대로 모방.
4. **세션 캐시**: isTeamAdmin grant 후 대상자가 **재로그인**해야 JWT 갱신됨(8h). QA 시 로그아웃→로그인 필요. (운영 안내 필요 — 비고)
5. **revalidatePath 대상**: 프로토타입 HTML 은 정적 served 이므로 revalidatePath 효과는 제한적 — UI 는 fetch 재호출로 갱신. 무해하므로 유지.
