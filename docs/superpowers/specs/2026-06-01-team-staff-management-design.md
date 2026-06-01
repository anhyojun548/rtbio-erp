# 팀별 직원 관리 — 설계 (Design Spec)

**작성일**: 2026-06-01
**상태**: 승인됨 (브레인스토밍 + 비판적 리뷰 완료)
**대상**: RTBIO ERP 프로토타입 HTML 포털 (`public/portals/*.html`) + 백엔드 API
**전제**: prototype-as-truth 아키텍처 — UI 는 프로토타입 HTML, 백엔드는 `/api/*` 로 연결

---

## 1. 목적 / 배경

현재 RTBIO 에는 **직원(User) 관리 UI 가 없다.** 직원 계정은 시드/스크립트로만 생성되고, DB 직접 조회로만 확인 가능하다.

요구사항(사용자):
- 각 팀(품질관리·경영지원·영업·임원진)에 **"팀 관리자" 계정을 지정**할 수 있게 한다.
- 팀 관리자 **지정 권한은 경영지원팀·임원진만** 가진다.
- 팀 관리자는 사이드바에서 **자기 팀 직원을 관리**(등록/수정/비활성화/비밀번호 재발급)한다.
- **권한이 없으면 메뉴 자체가 안 보인다** (통째로 숨김).

## 2. 핵심 결정 (브레인스토밍 확정)

| # | 결정 | 선택 |
|---|------|------|
| D1 | 팀 관리자 권한의 DB 표현 | `User.isTeamAdmin Boolean` 플래그 (role 5개 유지) |
| D2 | 팀 관리자를 지정/해제할 수 있는 주체 | 경영지원·임원진 **role 전체** (`ADMIN`, `TENANT_OWNER`) |
| D3 | 팀 관리자가 부여 가능한 role 범위 | 자기 팀 role만 / **임원진 관리자는 전체 role** 가능 |
| D4 | 신규 직원 초기 비밀번호 | **관리자가 임시 비밀번호 직접 입력** (이메일 발송 불필요) |
| D5 | UI 타깃 | **프로토타입 HTML 포털만** (`page-staff` SPA 페이지) |
| D6 | 메뉴 위치 | 사이드바 **독립 nav-item "직원 관리"** (기존 설정 페이지와 분리) |

## 3. 권한 모델

### 3-1. 팀 매핑 (role → team, 앱-레벨 상수 · DB 컬럼 없음)
```
TENANT_OWNER → executive (임원진)
ADMIN        → finance   (경영지원)
EXEC         → sales     (영업)
QC           → quality   (품질관리)
SUPER_ADMIN  → system    (시스템 — 우리)
CLIENT       → null      (거래처 — 직원관리 대상 아님)
```

### 3-2. 권한 술어 (predicates)
```
isMetaAdmin(u)          = u.role ∈ [ADMIN, TENANT_OWNER]
                          // 팀 관리자 지정/해제 권한 (D2)

isEffectiveTeamAdmin(u) = u.isTeamAdmin === true  OR  isMetaAdmin(u)
                          // 직원 관리 메뉴/기능 접근 권한
                          // ★ 메타관리자는 자동 포함 → "신규 ADMIN 이 자기에게
                          //   플래그를 줘야 직원관리가 보이는" 2단계 혼란 제거

canGrantRole(actor, targetRole):
   if actor.role === TENANT_OWNER → 모든 role 허용 (D3 임원진 전체)
   else (effectiveTeamAdmin)      → targetRole === TEAM_BY_ROLE[actor.role] 의 동일 role 만
                                    // 예: QC 리더 → QC 만, ADMIN → ADMIN 만, EXEC → EXEC 만
   CLIENT / SUPER_ADMIN 부여 금지 (직원관리 대상 아님)
```

### 3-3. 플래그의 의미
- **QC·EXEC**: `isTeamAdmin` 플래그가 **유일한 게이트**. 메타관리자가 grant 해야 직원관리 가능. (자기 승격 불가)
- **ADMIN·TENANT_OWNER**: 메타관리자라서 effectiveTeamAdmin 에 자동 포함. 플래그는 "이 사람이 팀의 지정 관리자" 라는 표식 용도(선택적).

## 4. 데이터 모델

```prisma
model User {
  ...기존...
  isTeamAdmin Boolean @default(false)   // 추가 — QC·EXEC 리더 승격용
  ...
}
```

- **마이그레이션**: `ALTER TABLE "public"."User" ADD COLUMN "isTeamAdmin" BOOLEAN NOT NULL DEFAULT false;` (nullable 아님, default false → 기존 행 안전)
- **시드 보강**: `owner@altibio.local`, `admin@altibio.local` 을 `isTeamAdmin=true` 로. (메타관리자라 기능상 불필요하나 표식 일관성)
- 새 테이블 없음. `User` 는 `public` 스키마 유지.

## 5. 세션 전파 (clientId 패턴과 동일)

`isTeamAdmin` 을 4곳에 추가 (기존 `clientId` 전파와 정확히 동일):
1. `auth.ts` `authorize()` → 반환 객체에 `isTeamAdmin`
2. `auth.ts` `jwt()` 콜백 → `token.isTeamAdmin`
3. `auth.ts` `session()` 콜백 → `session.user.isTeamAdmin`
4. `/api/me/route.ts` → 응답에 `isTeamAdmin`

프로토타입은 `window.CURRENT_USER.isTeamAdmin` + `window.CURRENT_USER.role` 로 메뉴 노출을 제어한다.

## 6. API 설계 (`/api/users/*`)

route 핸들러는 인증만 확인하고, **RBAC 는 server action 내부**에서 강제 (기존 패턴). 모든 쿼리에 **`tenantId` 강제 스코핑** (멀티테넌트 보안 — User 는 public 스키마라 필수).

| Method | Path | 권한(action) | 설명 |
|---|---|---|---|
| GET | `/api/users?team=&role=&active=&q=` | effectiveTeamAdmin | 자기 테넌트 직원. 비메타 → 자기 팀만 강제. 메타 → 전체(team 필터 허용). CLIENT 제외 |
| POST | `/api/users` | effectiveTeamAdmin | 신규 직원. `canGrantRole` 검증 + bcrypt 해시. 임시 비번 입력 |
| GET | `/api/users/[id]` | effectiveTeamAdmin | 단건. 자기 팀(비메타) · 타테넌트 차단 |
| PATCH | `/api/users/[id]` | effectiveTeamAdmin | name·phone·active 수정. role 변경 시 `canGrantRole` |
| DELETE | `/api/users/[id]` | effectiveTeamAdmin | soft delete (`active=false`) |
| POST | `/api/users/[id]/password` | effectiveTeamAdmin | 임시 비밀번호 재발급 (bcrypt) |
| POST | `/api/users/[id]/team-admin` | **isMetaAdmin** | `{ grant: true|false }` — isTeamAdmin 토글 |
| POST | `/api/me/password` | 본인 | `{ current, next }` — 본인 비밀번호 변경 |

### 6-1. 가드 (비즈니스 규칙)
- **본인 대상 차단**: 자기 자신 비활성화 / role 변경 / 비번 재발급 → 400 (실수 방지). 본인 비번 변경은 `/api/me/password` 로만.
- **마지막 owner 차단**: 테넌트에 활성 `TENANT_OWNER` 가 1명일 때 그를 비활성화 → 400 (잠금 방지).
- **영업담당자 비활성화 경고**: `EXEC` 비활성화 시 `Client.salesRepId` 또는 활성 `SalesAssignment` 에 연결된 거래처가 있으면 경고 메시지 반환(차단 아님, `{ warning, affectedCount }`). UI 가 확인 모달 표시.
- **타테넌트 차단**: 모든 단건 조회/수정은 `tenantId === session.tenantId` 확인.
- **비밀번호 정책**: 최소 8자 (validator). 임시 비번도 동일.

## 7. 코드 구조 (새 파일)

```
src/lib/team.ts                       — TEAM_BY_ROLE, TEAM_LABEL, isMetaAdmin,
                                        isEffectiveTeamAdmin, canGrantRole (순수 함수)
src/lib/validators/user.ts            — createUserSchema, updateUserSchema,
                                        resetPasswordSchema, changePasswordSchema,
                                        teamAdminToggleSchema (Zod)
src/lib/actions/user.ts               — listUsers, getUser, createUser, updateUser,
                                        deactivateUser, resetUserPassword,
                                        toggleTeamAdmin, changeMyPassword
                                        (requireRole + tenantId 스코핑 + logAudit)
src/app/api/users/route.ts            — GET, POST
src/app/api/users/[id]/route.ts       — GET, PATCH, DELETE
src/app/api/users/[id]/password/route.ts      — POST
src/app/api/users/[id]/team-admin/route.ts    — POST
src/app/api/me/password/route.ts      — POST
public/portals/js/staff-mgmt.js       — 공통 직원관리 UI 모듈 (4 포털 재사용)
```

수정 파일:
```
prisma/schema.prisma                  — User.isTeamAdmin
prisma/migrations/.../migration.sql   — ADD COLUMN
prisma/seed.ts                        — owner/admin isTeamAdmin=true
src/lib/auth.ts                       — isTeamAdmin 전파 (jwt/session/authorize)
src/app/api/me/route.ts               — 응답에 isTeamAdmin
public/portals/admin-portal.html      — page-staff + nav-item
public/portals/qc-portal.html         — page-staff + nav-item
public/portals/exec-portal.html       — page-staff + nav-item
public/portals/ceo-portal.html        — page-staff + page-team-admins + nav-item ×2
docs/02-design/api-reference.md        — §직원 관리 추가
```

## 8. UI 설계 (프로토타입 HTML)

### 8-1. 공통 모듈 `js/staff-mgmt.js`
4개 포털이 동일 `page-staff` div + 동일 모듈 사용. 모듈은 `window.CURRENT_USER` 의 role/isTeamAdmin 으로 동작 분기.

기능:
- **직원 목록**: 이름·이메일·role(한글)·활성·최근 로그인. 검색 + role 필터.
- **신규 등록 모달**: 이름·이메일·role(자기 팀만/임원진은 전체 select)·전화·임시 비밀번호.
- **활성/비활성 토글**: 비활성화 시 가드 경고(영업담당자 등) 표시.
- **비밀번호 재발급 모달**: 새 임시 비번 입력 → 성공 시 "직원에게 전달하세요" 안내.

### 8-2. 사이드바 nav-item 노출 (메뉴 숨김)
각 포털 사이드바에 독립 nav-item **"직원 관리"** 추가. 렌더 시:
```js
if (window.CURRENT_USER && (CURRENT_USER.isTeamAdmin || ['ADMIN','TENANT_OWNER'].includes(CURRENT_USER.role))) {
  // nav-item 표시
} else {
  // nav-item 제거 (통째로 숨김 — 사용자 요구)
}
```
URL/page 직접 접근 시에도 server action `requireRole`(effectiveTeamAdmin) 이 차단 → 데이터 안 옴.

### 8-3. ceo-portal 전용: "팀 관리자 지정"
별도 nav-item **"팀 관리자 지정"** (isMetaAdmin 전용). 팀별 직원 리스트 + 각 행에 isTeamAdmin grant/revoke 토글 버튼. `/api/users/[id]/team-admin` 호출.

### 8-4. 본인 비밀번호 변경
각 포털 계정/프로필 영역에 간단 폼 (현재 비번 + 새 비번). `/api/me/password`.

## 9. 감사 로그

모든 쓰기에 `logAudit`:
- `USER_CREATE` · `USER_UPDATE` · `USER_DEACTIVATE` · `USER_REACTIVATE`
- `USER_PASSWORD_RESET` (관리자가 타인 비번 재발급)
- `USER_PASSWORD_CHANGE_SELF` (본인 변경)
- `USER_TEAM_ADMIN_GRANT` · `USER_TEAM_ADMIN_REVOKE`

metadata: `{ actorId, actorRole, targetId, targetRole, team }`. **비밀번호 평문은 절대 로그에 남기지 않음.**

## 10. 테스트

- **vitest** (`src/lib/team.test.ts` + `validators/user.test.ts`) 15~20건:
  - `isMetaAdmin` / `isEffectiveTeamAdmin` 경계 (QC isTeamAdmin true/false, ADMIN 자동 포함)
  - `canGrantRole`: TENANT_OWNER→전체 / QC→QC만 / EXEC→ADMIN 거부 / CLIENT·SUPER_ADMIN 거부
  - validator: 비번 8자 미만 거부, 이메일 형식, role enum
- **smoke** (`scripts/smoke-users.ts`) 1개 시나리오:
  생성 → 목록(테넌트 스코핑) → 비번 재발급 → 팀관리자 grant → revoke → 마지막 owner 비활성화 가드 → 본인 대상 차단.

## 11. 작업량 추정

약 1.5일:
- 스키마 + 마이그레이션 + 세션 전파 (½h)
- team.ts + validators + actions + API (½d)
- 프로토타입 4포털 UI + staff-mgmt.js + 사이드바 게이트 (½d)
- 테스트 + 브라우저 검증 + 문서 (½d)

## 12. 비고 / 향후

- **이메일 기반 비번 발급**: #144(Nodemailer Daum SMTP) 완료 후 옵션 추가 가능.
- **mustChangePassword 강제**: 현재 미적용(D4). 필요 시 컬럼 + 전용 페이지로 후속.
- **팀당 관리자 수 제한**: DB 제약 없음(다중 허용). UI 에 "현재 N명" 표시 + 1명 권장 안내(운영 정책).
- **data-explorer mock 잔재**: 영업담당자 select 의 `박진우/배경동/신현호` 는 DB와 불일치 — 본 작업 범위 밖, 별도 클린업 대상.

---

**참고**: `CLAUDE.md` (도메인 규칙) · `src/lib/session.ts`(세션 헬퍼) · `src/lib/auth.ts`(NextAuth 콜백) · `docs/02-design/api-reference.md`(API 레퍼런스).
