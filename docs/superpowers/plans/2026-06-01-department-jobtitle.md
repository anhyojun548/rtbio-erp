# 부서·직급 분리 + 관리 목록 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `User.role`(권한)을 직급으로 오라벨한 것을 교정하고, 독립적인 **부서(department)·직급(jobTitle)** 필드 + 관리 목록(OrgOption)을 추가해 관리자가 설정에서 부서·직급 값을 추가/삭제하고 직원 폼 드롭다운으로 선택하게 한다.

**Architecture:** `User`에 `department`/`jobTitle` nullable string 추가. 신규 `OrgOption{kind,label,...}` 테이블(tenant_altibio)이 부서·직급 옵션 목록. 값은 드롭다운으로만 입력되는 문자열 스냅샷(서버 하드검증 없음). 옵션 읽기=effectiveTeamAdmin, 추가/삭제=metaAdmin. UI는 프로토타입 4포털 공통 `staff-mgmt.js`.

**Tech Stack:** Next.js 14 · Prisma 5.22 (multiSchema) · NextAuth v4 · Zod · Vitest · 프로토타입 vanilla JS

**Spec:** `docs/superpowers/specs/2026-06-01-department-jobtitle-design.md`
**선행 구현:** `docs/superpowers/plans/2026-06-01-team-staff-management.md` (직원 관리 — 완료. 본 plan은 그 위에 얹음)

---

## 사전 메모 (구현자 필독)

- TDD: 순수 로직(validators) Vitest 먼저. actions/API는 smoke + 브라우저. UI는 브라우저 수동.
- action 반환: `ok/fail/zodFail` from `@/lib/action-result`. 감사: `logAudit` from `@/lib/audit`.
- 권한 술어: `@/lib/team`의 `isMetaAdmin`, `isEffectiveTeamAdmin`. 세션 헬퍼: `@/lib/session`의 `requireTeamAdmin`(effectiveTeamAdmin), `requireMetaAdmin`. (직원관리 구현에서 추가됨 — 존재 확인)
- `OrgOptionKind` enum 2값: `DEPARTMENT`, `JOB_TITLE`.
- 기존 `src/lib/actions/user.ts`의 `SAFE_SELECT`에 department/jobTitle 추가, `createUserSchema`/`updateUserSchema`에 두 필드 추가.
- 커밋: 한국어 ≤50자. 본문 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. push 금지.
- 로컬: Docker `rtbio-postgres` + `npm run dev`. 마이그레이션 `npx prisma migrate dev`.

---

## File Structure

**신규**
| 경로 | 책임 |
|---|---|
| `src/lib/validators/org-option.ts` | OrgOption Zod + ORG_OPTION_KINDS + 라벨맵 |
| `src/lib/validators/org-option.test.ts` | 단위 테스트 |
| `src/lib/actions/org-option.ts` | list/create/deactivate |
| `src/app/api/org-options/route.ts` | GET, POST |
| `src/app/api/org-options/[id]/route.ts` | DELETE |

**수정**
| 경로 | 변경 |
|---|---|
| `prisma/schema.prisma` | User.department/jobTitle + OrgOption + OrgOptionKind |
| `prisma/migrations/.../migration.sql` | 위 DDL |
| `prisma/seed.ts` | 기본 부서·직급 옵션 upsert |
| `src/lib/validators/user.ts` | create/update 에 department/jobTitle |
| `src/lib/actions/user.ts` | create/update 기록 + SAFE_SELECT |
| `public/portals/js/staff-mgmt.js` | 폼·목록·관리모달 |
| `docs/02-design/api-reference.md` | org-options 섹션 |

---

## Phase A — 스키마 + 시드

### Task A1: User 필드 + OrgOption 테이블 + 마이그레이션 + 시드

**Files:** `prisma/schema.prisma`, `prisma/migrations/...`, `prisma/seed.ts`

- [ ] **Step 1: schema.prisma — User 필드 추가**

`model User` 에 `isTeamAdmin` 인근:
```prisma
  department String? // 부서 (OrgOption 라벨 스냅샷)
  jobTitle   String? // 직급 (OrgOption 라벨 스냅샷)
```

- [ ] **Step 2: schema.prisma — OrgOption + enum (tenant_altibio 스키마 블록에)**

`tenant_altibio` 모델들이 있는 영역(예: TenantSetting 인근)에 추가:
```prisma
model OrgOption {
  id        String        @id @default(cuid())
  tenantId  String
  kind      OrgOptionKind
  label     String
  sortOrder Int           @default(0)
  active    Boolean       @default(true)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  createdBy String?

  @@unique([tenantId, kind, label])
  @@index([tenantId, kind, active])
  @@schema("tenant_altibio")
}

enum OrgOptionKind {
  DEPARTMENT
  JOB_TITLE

  @@schema("tenant_altibio")
}
```

- [ ] **Step 3: 마이그레이션 생성**

Run: `npx prisma migrate dev --name add_department_jobtitle_orgoption`
Expected: User에 2컬럼 ADD + OrgOption 테이블 + enum 생성 + `prisma generate`.

- [ ] **Step 4: 시드 — 기본 옵션 (prisma/seed.ts)**

기존 시드의 tenant(altibio) 생성 이후에 추가. tenant id 변수명은 시드 코드에서 확인(예: `tenant.id`):
```ts
const DEPARTMENTS = ["경영지원", "품질관리", "영업", "대표이사실"];
const JOB_TITLES = ["사원", "주임", "대리", "과장", "차장", "부장", "이사", "대표"];
for (let i = 0; i < DEPARTMENTS.length; i++) {
  await prisma.orgOption.upsert({
    where: { tenantId_kind_label: { tenantId: tenant.id, kind: "DEPARTMENT", label: DEPARTMENTS[i] } },
    update: {}, create: { tenantId: tenant.id, kind: "DEPARTMENT", label: DEPARTMENTS[i], sortOrder: i },
  });
}
for (let i = 0; i < JOB_TITLES.length; i++) {
  await prisma.orgOption.upsert({
    where: { tenantId_kind_label: { tenantId: tenant.id, kind: "JOB_TITLE", label: JOB_TITLES[i] } },
    update: {}, create: { tenantId: tenant.id, kind: "JOB_TITLE", label: JOB_TITLES[i], sortOrder: i },
  });
}
```
> 시드의 tenant 변수 실제 이름을 확인해 맞출 것. seed가 여러 tenant를 만들면 각 tenant에 반복.

- [ ] **Step 5: 시드 실행 + 검증**

Run: `npx prisma db seed`
Run: `docker exec rtbio-postgres psql -U rtbio -d rtbio_erp -c "SELECT kind, label, \"sortOrder\" FROM tenant_altibio.\"OrgOption\" ORDER BY kind, \"sortOrder\";"`
Expected: DEPARTMENT 4행 + JOB_TITLE 8행.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat(schema): User.department/jobTitle + OrgOption 테이블 + 기본 시드"
```

---

## Phase B — Validators + Actions

### Task B1: validators/org-option.ts (TDD)

**Files:** `src/lib/validators/org-option.ts`, `src/lib/validators/org-option.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { describe, it, expect } from "vitest";
import { createOrgOptionSchema, ORG_OPTION_KINDS, ORG_OPTION_KIND_LABEL } from "./org-option";

describe("createOrgOptionSchema", () => {
  it("accepts valid", () => {
    expect(createOrgOptionSchema.safeParse({ kind: "DEPARTMENT", label: "회계팀" }).success).toBe(true);
    expect(createOrgOptionSchema.safeParse({ kind: "JOB_TITLE", label: "수석" }).success).toBe(true);
  });
  it("rejects bad kind", () => {
    expect(createOrgOptionSchema.safeParse({ kind: "TEAM", label: "x" }).success).toBe(false);
  });
  it("rejects empty / too-long label", () => {
    expect(createOrgOptionSchema.safeParse({ kind: "DEPARTMENT", label: "" }).success).toBe(false);
    expect(createOrgOptionSchema.safeParse({ kind: "DEPARTMENT", label: "x".repeat(41) }).success).toBe(false);
  });
});
describe("ORG_OPTION_KINDS", () => {
  it("has 2 kinds with labels", () => {
    expect(ORG_OPTION_KINDS).toEqual(["DEPARTMENT", "JOB_TITLE"]);
    expect(ORG_OPTION_KIND_LABEL.DEPARTMENT).toBe("부서");
    expect(ORG_OPTION_KIND_LABEL.JOB_TITLE).toBe("직급");
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/validators/org-option.test.ts` → FAIL.

- [ ] **Step 3: 구현**

```ts
import { z } from "zod";

export const ORG_OPTION_KINDS = ["DEPARTMENT", "JOB_TITLE"] as const;
export type OrgOptionKind = (typeof ORG_OPTION_KINDS)[number];

export const ORG_OPTION_KIND_LABEL: Record<OrgOptionKind, string> = {
  DEPARTMENT: "부서",
  JOB_TITLE: "직급",
};

export const orgOptionKindEnum = z.enum(ORG_OPTION_KINDS);
const labelField = z.string().trim().min(1, "이름을 입력하세요.").max(40, "40자 이하여야 합니다.");

export const createOrgOptionSchema = z.object({
  kind: orgOptionKindEnum,
  label: labelField,
});
export type CreateOrgOptionInput = z.infer<typeof createOrgOptionSchema>;
```

- [ ] **Step 4: 통과** — `npx vitest run src/lib/validators/org-option.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/validators/org-option.ts src/lib/validators/org-option.test.ts
git commit -m "feat(validators): OrgOption Zod 스키마"
```

---

### Task B2: actions/org-option.ts

**Files:** `src/lib/actions/org-option.ts`

- [ ] **Step 1: 구현** (패턴: `src/lib/actions/user.ts`)

```ts
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, requireMetaAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { createOrgOptionSchema, type OrgOptionKind } from "@/lib/validators/org-option";
import { ok, fail, zodFail } from "@/lib/action-result";

/** 옵션 목록 — active, kind 별. 읽기는 effectiveTeamAdmin. */
export async function listOrgOptions(kind?: string) {
  const me = await requireTeamAdmin();
  const where: Prisma.OrgOptionWhereInput = { tenantId: me.tenantId, active: true };
  // kind 가 유효하지 않으면(또는 생략) 의도적으로 전체 kind 반환 — 프론트는 무인자 GET 만 사용.
  if (kind === "DEPARTMENT" || kind === "JOB_TITLE") where.kind = kind as OrgOptionKind;
  return prisma.orgOption.findMany({
    where,
    select: { id: true, kind: true, label: true, sortOrder: true },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
}

/** 옵션 추가 — metaAdmin. 중복(active/inactive 무관) 가드. */
export async function createOrgOption(input: unknown) {
  const me = await requireMetaAdmin();
  const parsed = createOrgOptionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { kind, label } = parsed.data;

  const dup = await prisma.orgOption.findUnique({
    where: { tenantId_kind_label: { tenantId: me.tenantId, kind, label } },
    select: { id: true, active: true },
  });
  if (dup) {
    // 비활성 동일 라벨이면 되살린다 (UX), 활성이면 중복 에러
    if (!dup.active) {
      const revived = await prisma.orgOption.update({
        where: { id: dup.id }, data: { active: true },
        select: { id: true, kind: true, label: true, sortOrder: true },
      });
      logAudit({ tenantId: me.tenantId, userId: me.id, action: "ORG_OPTION_CREATE", resource: `OrgOption:${revived.id}`, metadata: { kind, label, revived: true } });
      revalidatePath("/portals/admin-portal.html");
      return ok(revived);
    }
    return fail("이미 존재하는 항목입니다.", { fieldErrors: { label: ["중복"] } });
  }

  const max = await prisma.orgOption.aggregate({ where: { tenantId: me.tenantId, kind }, _max: { sortOrder: true } });
  const created = await prisma.orgOption.create({
    data: { tenantId: me.tenantId, kind, label, sortOrder: (max._max.sortOrder ?? -1) + 1, createdBy: me.id },
    select: { id: true, kind: true, label: true, sortOrder: true },
  });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "ORG_OPTION_CREATE", resource: `OrgOption:${created.id}`, metadata: { kind, label } });
  revalidatePath("/portals/admin-portal.html");
  return ok(created);
}

/** 옵션 삭제 — metaAdmin, soft(active=false). 기존 직원 문자열값은 불변. */
export async function deactivateOrgOption(id: string) {
  const me = await requireMetaAdmin();
  const opt = await prisma.orgOption.findFirst({ where: { id, tenantId: me.tenantId }, select: { id: true, kind: true, label: true } });
  if (!opt) return fail("항목을 찾을 수 없습니다.");
  await prisma.orgOption.update({ where: { id }, data: { active: false } });
  logAudit({ tenantId: me.tenantId, userId: me.id, action: "ORG_OPTION_DEACTIVATE", resource: `OrgOption:${id}`, metadata: { kind: opt.kind, label: opt.label } });
  revalidatePath("/portals/admin-portal.html");
  return ok({ id });
}
```

> **주의:** unique 복합키 이름은 Prisma 가 `tenantId_kind_label` 로 생성하는지 확인(스키마 `@@unique([tenantId, kind, label])` 기준). 다르면 생성된 이름으로 맞출 것.

- [ ] **Step 2: tsc** — `npx tsc --noEmit` 클린.

- [ ] **Step 3: Commit**
```bash
git add src/lib/actions/org-option.ts
git commit -m "feat(actions): OrgOption list/create/deactivate"
```

---

### Task B3: user validator/action 확장 (department/jobTitle)

**Files:** `src/lib/validators/user.ts`, `src/lib/actions/user.ts`

- [ ] **Step 1: validators/user.ts — 두 필드 추가**

`createUserSchema` 와 `updateUserSchema` 에 추가 (optional, 빈값→undefined):
```ts
  department: z.string().trim().max(40).optional().or(z.literal("")).transform((v) => v || undefined),
  jobTitle: z.string().trim().max(40).optional().or(z.literal("")).transform((v) => v || undefined),
```
(phoneField와 동일 패턴. createUserSchema·updateUserSchema 양쪽 모두.)

- [ ] **Step 2: actions/user.ts — SAFE_SELECT + create/update 반영**

- `SAFE_SELECT` 에 `department: true, jobTitle: true,` 추가.
- `createUser` 의 `prisma.user.create({ data: {...} })` 에 `department: data.department ?? null, jobTitle: data.jobTitle ?? null,` 추가.
- `updateUser` 의 update data 스프레드에 추가:
```ts
      ...(d.department !== undefined && { department: d.department ?? null }),
      ...(d.jobTitle !== undefined && { jobTitle: d.jobTitle ?? null }),
```

- [ ] **Step 3: tsc + vitest** — `npx tsc --noEmit` 클린, `npx vitest run` 그린(기존 user.test 통과).

- [ ] **Step 4: Commit**
```bash
git add src/lib/validators/user.ts src/lib/actions/user.ts
git commit -m "feat: 직원 create/update 에 department/jobTitle"
```

---

## Phase C — API routes

### Task C1: /api/org-options (GET, POST) + [id] (DELETE)

**Files:** `src/app/api/org-options/route.ts`, `src/app/api/org-options/[id]/route.ts`

- [ ] **Step 1: route.ts**
```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listOrgOptions, createOrgOption } from "@/lib/actions/org-option";
const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const url = new URL(req.url);
  const rows = await listOrgOptions(url.searchParams.get("kind") ?? undefined);
  return Response.json(rows);
}
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const res = await createOrgOption(body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data, { status: 201 });
}
```

- [ ] **Step 2: [id]/route.ts**
```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deactivateOrgOption } from "@/lib/actions/org-option";
type Ctx = { params: { id: string } };
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const res = await deactivateOrgOption(params.id);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });
  return Response.json(res.data);
}
```

- [ ] **Step 3: tsc + curl** — `npx tsc --noEmit` 클린. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/org-options` → 307/401(라우트 존재).

- [ ] **Step 4: Commit**
```bash
git add src/app/api/org-options
git commit -m "feat(api): /api/org-options GET/POST + [id] DELETE"
```

---

## Phase D — 프로토타입 UI (staff-mgmt.js)

> 모든 변경은 `public/portals/js/staff-mgmt.js` 한 파일. 4포털 공통 → 한 번 수정으로 전 포털 반영. 각 단계 후 `node --check public/portals/js/staff-mgmt.js`.

### Task D1: 옵션 로더 + 직원 폼(권한 라벨 교정 + 부서/직급 드롭다운)

- [ ] **Step 1: 모듈 상단에 옵션 캐시 + 로더 추가**

```js
// 부서·직급 옵션 캐시 (폼 열기 전 _loadOrgOptions 로 채움)
var _ORG_OPTIONS = { DEPARTMENT: [], JOB_TITLE: [] };
async function _loadOrgOptions() {
  try {
    const r = await fetch('/api/org-options', { credentials: 'same-origin' });
    const rows = await _staffSafeJson(r);
    if (Array.isArray(rows)) {
      _ORG_OPTIONS = { DEPARTMENT: [], JOB_TITLE: [] };
      rows.forEach((o) => { if (_ORG_OPTIONS[o.kind]) _ORG_OPTIONS[o.kind].push(o); });
    }
  } catch { /* keep last */ }
}
// 옵션 → <option> HTML (선택값 보존, 빈 값 허용)
function _orgOptionSelectHTML(kind, current) {
  const opts = _ORG_OPTIONS[kind] || [];
  let html = `<option value="">— 없음 —</option>`;
  // current 값이 목록에 없어도(삭제된 옵션) 보존
  if (current && !opts.some((o) => o.label === current)) {
    html += `<option value="${_esc(current)}" selected>${_esc(current)} (사용 안 함)</option>`;
  }
  html += opts.map((o) => `<option value="${_esc(o.label)}"${o.label === current ? ' selected' : ''}>${_esc(o.label)}</option>`).join('');
  return html;
}
```

- [ ] **Step 2: `showNewStaffForm` 을 async 로 + 부서/직급 필드 추가 + "직급"→"권한"**

- 함수 시그니처를 `function showNewStaffForm()` → **`async function showNewStaffForm()`** 로 변경.
- `await _loadOrgOptions();` 는 **기존 `if (!roleOpts) { ...return; }` 권한 가드 _뒤_** 에 넣을 것 (권한 없는 경로에서 불필요한 fetch 방지).
- 기존 `<label>직급 *</label><select id="sf-role">` 의 라벨을 **"권한 *"** 로 변경(select는 그대로 role).
- 임시 비밀번호 form-row 앞(또는 뒤)에 부서/직급 row 추가:
```html
<div class="form-row">
  <div class="form-group"><label>부서</label>
    <select class="form-select" id="sf-department">${_orgOptionSelectHTML('DEPARTMENT', '')}</select></div>
  <div class="form-group"><label>직급</label>
    <select class="form-select" id="sf-jobtitle">${_orgOptionSelectHTML('JOB_TITLE', '')}</select></div>
</div>
```

- [ ] **Step 3: `_submitNewStaff` payload 에 추가**
```js
    department: document.getElementById('sf-department')?.value || '',
    jobTitle: document.getElementById('sf-jobtitle')?.value || '',
```

- [ ] **Step 4: `editStaff` 도 async + 부서/직급 드롭다운(현재값 selected) + "직급"라벨→"권한"**

- `editStaff` 는 이미 async. `const u = ...` 직후 `await _loadOrgOptions();` 추가.
- 기존 role 필드의 `<label>직급</label>` → **"권한"** (canEditRole 분기 양쪽).
- 폼에 부서/직급 row 추가: `_orgOptionSelectHTML('DEPARTMENT', u.department)` / `('JOB_TITLE', u.jobTitle)`.
- `_submitEditStaff`(수정 제출 함수) payload 에 `department`/`jobTitle` 추가(생성과 동일).

- [ ] **Step 5: node --check + 브라우저** — 구문 OK. admin 로그인 → 신규/수정 폼에 권한+부서+직급 드롭다운, 기본 옵션 표시.

- [ ] **Step 6: Commit**
```bash
git add public/portals/js/staff-mgmt.js
git commit -m "feat(portal): 직원 폼 권한 라벨 교정 + 부서/직급 드롭다운"
```

---

### Task D2: 직원 목록 컬럼 (권한·부서·직급)

- [ ] **Step 1: `renderStaff` bodyRows + 헤더 수정**

- bodyRows 의 `<td>${roleLabel}</td>` 뒤에 2칸 추가:
```js
        <td>${_esc(u.department || '-')}</td>
        <td>${_esc(u.jobTitle || '-')}</td>
```
  (주의: 이 셀들은 bare `<td>` 라 헤더의 `replace(/<td>/g, ...)` 패딩이 자동 적용됨 — roleLabel 셀과 동일.)
- thead 의 `<th>직급</th>` → `<th>권한</th>` 로 변경하고, 그 뒤에 추가:
```html
          <th style="padding:10px 12px;border-bottom:2px solid var(--border);">부서</th>
          <th style="padding:10px 12px;border-bottom:2px solid var(--border);">직급</th>
```

- [ ] **Step 2: node --check + 브라우저** — 목록에 권한·부서·직급 3컬럼 표시.

- [ ] **Step 3: Commit**
```bash
git add public/portals/js/staff-mgmt.js
git commit -m "feat(portal): 직원 목록에 권한·부서·직급 컬럼"
```

---

### Task D3: 부서·직급 관리 모달 (metaAdmin)

- [ ] **Step 1: 관리 버튼 — `buildStaffMgmtPageHTML` search-bar 에 추가**

"+ 신규 직원" 버튼 옆에(metaAdmin만 보이게 JS로 제어하기 위해 id 부여):
```html
<button class="btn btn-outline" id="staff-orgopt-btn" style="display:none;" onclick="showOrgOptionsModal()">⚙ 부서·직급 관리</button>
```
그리고 페이지 진입 시(렌더 직후) 노출 제어 함수 호출 — `renderStaff` 끝부분 또는 별도 init 에서:
```js
function _gateOrgOptBtn() {
  const u = window.CURRENT_USER;
  const btn = document.getElementById('staff-orgopt-btn');
  if (btn && u && ['ADMIN','TENANT_OWNER'].includes(u.role)) btn.style.display = '';
}
```
`renderStaff` 성공 경로 마지막에 `_gateOrgOptBtn();` 호출(목록 갱신마다 안전).

- [ ] **Step 2: 모달 함수들 추가**

```js
async function showOrgOptionsModal() {
  await _loadOrgOptions();
  const section = (kind, title) => {
    const opts = _ORG_OPTIONS[kind] || [];
    const rows = opts.length
      ? opts.map((o) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
          <span>${_esc(o.label)}</span>
          <button class="btn btn-outline btn-sm" style="color:var(--danger);font-size:11px;padding:2px 8px;" onclick="removeOrgOption('${o.id}')">삭제</button>
        </div>`).join('')
      : `<div class="text-sm text-muted" style="padding:8px 0;">항목 없음</div>`;
    return `
      <div style="margin-bottom:16px;">
        <div style="font-weight:700;margin-bottom:6px;">${title}</div>
        <div id="orgopt-list-${kind}">${rows}</div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <input type="text" class="form-input" id="orgopt-input-${kind}" placeholder="${title} 추가..." style="flex:1;">
          <button class="btn btn-primary btn-sm" onclick="addOrgOption('${kind}')">추가</button>
        </div>
      </div>`;
  };
  _openStaffFormModal('부서 · 직급 관리', `
    <div class="modal-form">
      <div id="orgopt-error" style="display:none;color:var(--danger);font-size:13px;margin-bottom:8px;"></div>
      ${section('DEPARTMENT', '부서')}
      ${section('JOB_TITLE', '직급')}
      <div class="form-actions"><button class="btn btn-outline" onclick="_closeTopModal()">닫기</button></div>
    </div>
  `);
}

async function addOrgOption(kind) {
  const input = document.getElementById('orgopt-input-' + kind);
  const label = (input?.value || '').trim();
  const errEl = document.getElementById('orgopt-error');
  if (errEl) errEl.style.display = 'none';
  if (!label) return;
  try {
    const r = await fetch('/api/org-options', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ kind, label }),
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
    if (!r.ok || (data && data.ok === false)) {
      if (errEl) { errEl.textContent = (data && data.error) || '추가 실패'; errEl.style.display = ''; }
      return;
    }
    await showOrgOptionsModal(); // 재렌더 (모달 교체)
  } catch (e) { if (errEl) { errEl.textContent = e.message || '추가 실패'; errEl.style.display = ''; } }
}

async function removeOrgOption(id) {
  if (!confirm('이 항목을 삭제할까요?\n(기존 직원에 입력된 값은 그대로 유지됩니다)')) return;
  try {
    const r = await fetch('/api/org-options/' + id, { method: 'DELETE', credentials: 'same-origin' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
    if (!r.ok || (data && data.ok === false)) { showToast((data && data.error) || '삭제 실패', 'error'); return; }
    await showOrgOptionsModal();
  } catch (e) { showToast(e.message || '삭제 실패', 'error'); }
}
```

- [ ] **Step 3: window 노출** — 파일의 window 노출 블록에 추가:
```js
window.showOrgOptionsModal = showOrgOptionsModal;
window.addOrgOption = addOrgOption;
window.removeOrgOption = removeOrgOption;
```

- [ ] **Step 4: node --check + 브라우저** — admin(meta)에 "⚙ 부서·직급 관리" 버튼 보임 → 모달 → 부서 추가/삭제 → 직원 폼 드롭다운에 반영. 일반 QC 리더(비meta)는 버튼 안 보임.

- [ ] **Step 5: Commit**
```bash
git add public/portals/js/staff-mgmt.js
git commit -m "feat(portal): 부서·직급 관리 모달 (metaAdmin)"
```

---

## Phase E — 문서 + 검증

### Task E1: api-reference + 스모크 확장

**Files:** `docs/02-design/api-reference.md`, `scripts/smoke-users.ts`(확장) 또는 신규 `scripts/smoke-org-option.ts`

- [ ] **Step 1: api-reference §직원 관리 에 org-options 3 endpoint 추가** (동일 표 스타일). **route 수는 문서 헤더의 현재 값을 읽어 +3 할 것**(하드코딩 금지 — 직전 STAFF 작업에서 갱신됐을 수 있음). 권한 모델 한 줄: 읽기=effectiveTeamAdmin, 추가/삭제=metaAdmin. User에 department/jobTitle 추가됨도 명시.

- [ ] **Step 2: 스모크** — `scripts/smoke-org-option.ts`(smoke-users 패턴):
  1. 옵션 생성(prisma.orgOption.create, kind=DEPARTMENT, label 유니크) → 목록에 존재
  2. 임시 직원에 department=그 label 세팅 → 조회 확인
  3. 옵션 soft delete(active=false) → 직원 department **문자열 보존** 확인(스냅샷)
  4. 중복 라벨 unique 제약 확인(같은 tenant+kind+label create 시 throw)
  5. 정리(임시 직원 + 옵션 삭제)
  Run: `npx tsx scripts/smoke-org-option.ts` → PASS, 잔여 0.

- [ ] **Step 3: Commit**
```bash
git add docs/02-design/api-reference.md scripts/smoke-org-option.ts
git commit -m "docs(api)+test: org-options 문서 + 스모크"
```

---

### Task E2: 전체 회귀 + 브라우저 QA

- [ ] **Step 1: 회귀** — `npx tsc --noEmit`(클린) · `npx vitest run`(그린) · `node --check public/portals/js/staff-mgmt.js`(OK) · `npx tsx scripts/smoke-org-option.ts`(PASS).

- [ ] **Step 2: 브라우저 QA** (`Ctrl+Shift+R`)

| 검증 | 기대 |
|---|---|
| admin 직원 관리 → 목록 | 권한·부서·직급 3컬럼 (기존 직원 부서/직급은 "-") |
| "⚙ 부서·직급 관리" | admin 보임 / 일반 QC 리더 안 보임 |
| 부서 "회계팀" 추가 | 목록 즉시 반영 |
| 신규 직원 등록 | 권한+부서(드롭다운에 회계팀)+직급 선택 → 목록에 표시 |
| 직원 수정 | 부서/직급 변경 → 반영 |
| 부서 "회계팀" 삭제 | 드롭다운에서 사라짐, 그 부서 직원은 "회계팀 (사용 안 함)" 보존 |

- [ ] **Step 3: 최종 커밋(있으면)**
```bash
git add -A && git commit -m "test: 부서·직급 회귀 + 브라우저 QA"
```

---

## 완료 기준 (DoD)
- [ ] User.department/jobTitle + OrgOption 마이그레이션 + 기본 시드
- [ ] org-option validator 단위테스트 + 전체 vitest 그린 + tsc 클린
- [ ] 3 endpoint(GET/POST/DELETE) + 읽기=effectiveTeamAdmin / 쓰기=metaAdmin
- [ ] 직원 폼: "직급"→"권한" 교정 + 부서·직급 드롭다운
- [ ] 직원 목록: 권한·부서·직급 컬럼
- [ ] 관리 모달(metaAdmin) 추가/삭제 → 드롭다운 반영
- [ ] 옵션 삭제 시 기존 직원 문자열값 보존(스냅샷)

## 리스크 / 주의
1. **Prisma 복합 unique 이름**: `tenantId_kind_label` 가정 — 생성된 클라이언트에서 실제 이름 확인(B2 주의).
2. **시드 tenant 변수명**: seed.ts 의 실제 변수/구조에 맞춰 옵션 upsert 삽입.
3. **`_submitEditStaff` 함수명**: 실제 수정-제출 함수명을 staff-mgmt.js 에서 확인(editStaff 내부 또는 별도). payload 확장 위치를 정확히.
4. **`_closeTopModal`/window 노출 블록**: 기존 staff-mgmt.js 에 존재하는 헬퍼/블록을 재사용(새로 만들지 말 것).
5. **bare `<td>` 패딩 트릭**: 신규 부서/직급 셀은 inline style 없는 `<td>` 로 두어 헤더의 replace 패딩이 적용되게(roleLabel 셀과 동일 방식).
