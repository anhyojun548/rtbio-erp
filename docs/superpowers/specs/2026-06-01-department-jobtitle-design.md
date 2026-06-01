# 부서·직급 분리 + 관리 목록 — 설계 (Design Spec)

**작성일**: 2026-06-01
**상태**: 승인됨 (브레인스토밍 완료)
**대상**: RTBIO ERP 프로토타입 4포털 직원 관리 + 백엔드
**선행**: `2026-06-01-team-staff-management-design.md` (직원 관리 기능 — 이미 구현 완료)

---

## 1. 배경 / 문제

직원 관리 기능에서 `User.role`(RBAC 권한 enum)을 UI 에서 **"직급"** 으로 라벨링했는데, 이는 잘못이다. `role`(대표/경영지원/품질관리/영업)은 **권한·부서 성격**이지 직급이 아니다. 직급(사원/대리/과장/부장…)과 부서는 별도의 HR 정보 필드여야 하며, 사용자가 **값을 추가**할 수 있어야 한다.

## 2. 핵심 결정 (브레인스토밍 확정)

| # | 결정 | 선택 |
|---|------|------|
| D1 | role(권한) ↔ 부서/직급 관계 | **role=권한 전용** (UI 라벨 "직급"→"권한" 교정) + 부서·직급 **독립 신규 필드** |
| D2 | 부서·직급 값 추가 방식 | **관리 목록**(설정에서 추가/삭제) + 직원 폼은 **드롭다운** |
| D3 | 옵션 관리 UI 위치 | 직원 관리 페이지 내 **"⚙ 부서·직급 관리" 모달** (co-located, metaAdmin만) |

## 3. 개념 모델 (3개 직교)

| 필드 | 의미 | 값 | 변경 |
|---|---|---|---|
| `role` (기존) | **권한** — 포털 접근/RBAC | TENANT_OWNER/ADMIN/QC/EXEC | 코드 고정 (라벨만 교정) |
| `department` (신규) | **부서** | OrgOption(DEPARTMENT) 라벨 | 관리 목록에서 추가/삭제 |
| `jobTitle` (신규) | **직급** | OrgOption(JOB_TITLE) 라벨 | 관리 목록에서 추가/삭제 |

- role 값 라벨(대표/경영지원/품질관리/영업)은 **포털/팀**을 뜻하므로 유지. 컬럼 헤더만 "직급"→"권한".

## 4. 데이터 모델

```prisma
model User {
  ...기존...
  department String?   // 부서 (OrgOption 라벨 스냅샷)
  jobTitle   String?   // 직급 (OrgOption 라벨 스냅샷)
}

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

- 마이그레이션: `User`에 2 nullable 컬럼 ADD + `OrgOption` 테이블 + enum 생성 (모두 안전).
- **`department`/`jobTitle`는 단순 문자열**(옵션 라벨 스냅샷). 옵션이 삭제돼도 기존 직원값 불변. 입력 경로가 드롭다운뿐이라 데이터 일관성 자연 확보 → **서버 하드 검증 없음**(삭제 edge case 회피, YAGNI).
- `OrgOption`은 `tenant_altibio` 스키마(테넌트 조직 데이터). `User`는 `public`이지만 department/jobTitle은 string 컬럼이라 크로스스키마 FK 불필요.

## 5. 권한

- **옵션 읽기**(드롭다운 채우기): `effectiveTeamAdmin` — QC/EXEC 리더도 직원 등록 시 옵션 조회 필요.
- **옵션 추가/삭제**: `metaAdmin`(ADMIN/TENANT_OWNER) — 조직 설정 성격.
- 직원의 department/jobTitle 설정: `effectiveTeamAdmin`(기존 createUser/updateUser 권한 그대로).

## 6. API

신규:
| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/org-options?kind=DEPARTMENT\|JOB_TITLE` | effectiveTeamAdmin | `listOrgOptions` (active, sortOrder asc) |
| POST | `/api/org-options` | metaAdmin | `createOrgOption` (`{kind, label}`, 중복 가드) |
| DELETE | `/api/org-options/[id]` | metaAdmin | `deactivateOrgOption` (soft active=false) |

기존 확장:
- `createUserSchema`/`updateUserSchema`에 `department?`, `jobTitle?` (optional string, trim, 빈값→undefined).
- `createUser`/`updateUser`가 두 필드를 기록. SAFE_SELECT에 department/jobTitle 추가.

## 7. 코드 구조

신규:
```
src/lib/validators/org-option.ts         — OrgOption Zod 스키마 + ORG_OPTION_KINDS
src/lib/validators/org-option.test.ts    — 단위 테스트
src/lib/actions/org-option.ts            — listOrgOptions/createOrgOption/deactivateOrgOption
src/app/api/org-options/route.ts         — GET, POST
src/app/api/org-options/[id]/route.ts    — DELETE
```
수정:
```
prisma/schema.prisma                     — User.department/jobTitle + OrgOption + enum
prisma/migrations/.../migration.sql
prisma/seed.ts                           — 기본 부서·직급 옵션 시드
src/lib/validators/user.ts               — create/update 에 department/jobTitle
src/lib/actions/user.ts                  — create/update 기록 + SAFE_SELECT
public/portals/js/staff-mgmt.js          — 폼(권한 라벨+부서/직급 드롭다운) · 목록 컬럼 · 관리 모달
docs/02-design/api-reference.md          — org-options 섹션
```

## 8. UI (프로토타입 staff-mgmt.js, 4포털 공통)

- **직원 폼**: "직급"→**"권한"**(role) 라벨 교정 + **부서** 드롭다운 + **직급** 드롭다운. 옵션은 `GET /api/org-options`로 채움(폼 열 때 로드, 캐시). 빈 값("— 없음 —") 허용.
- **직원 목록**: 컬럼 = 이름 · 이메일 · **권한** · **부서** · **직급** · 상태 · 최근로그인 · 액션.
- **부서·직급 관리 모달**: 직원 관리 페이지 상단 **"⚙ 부서·직급 관리"** 버튼(metaAdmin만 노출 — `isMeta` 게이트). 모달에 부서 목록 + 직급 목록 2개 섹션, 각 섹션에 추가 input + 항목별 삭제 버튼. `POST`/`DELETE /api/org-options` 호출 후 재렌더.
- 모든 사용자 문자열은 기존 `_esc` 이스케이프.

## 9. 시드 (기본 옵션)

- 부서: 경영지원, 품질관리, 영업, 대표이사실
- 직급: 사원, 주임, 대리, 과장, 차장, 부장, 이사, 대표
- 각 tenant(altibio)에 OrgOption upsert. sortOrder는 배열 순서.

## 10. 감사 로그

`ORG_OPTION_CREATE` · `ORG_OPTION_DEACTIVATE` (metadata: kind, label). 직원 department/jobTitle 변경은 기존 `USER_UPDATE` metadata.changes 에 자연 포함.

## 11. 테스트

- vitest: org-option validator(중복/kind enum/label 길이) + user validator 확장 케이스. ~8건.
- smoke-org-option(또는 smoke-users 확장): 옵션 생성 → 목록 → 직원에 부서/직급 세팅 → 옵션 삭제 후 기존 직원값 보존 확인 → 정리.

## 12. 작업량

약 1일: 스키마+마이그레이션+시드 ½h · validator+org-option actions+user 확장 ½d · API ¼d · UI(폼/목록/관리모달) ½d · 테스트+문서 ¼d.

## 13. 비고

- 옵션 **정렬(reorder)**: 1차 생략, sortOrder=추가순. 필요 시 후속 PATCH.
- 옵션 **이름 변경**: 1차 생략(삭제+재추가). 기존 직원값은 문자열 스냅샷이라 영향 없음.
- 관리 위치를 직원 관리 페이지 내 모달로 채택(설정 페이지 아님) — 사용자가 설정 페이지 선호 시 이동 가능.

---

**참고**: `CLAUDE.md` · `src/lib/team.ts`(isMetaAdmin/isEffectiveTeamAdmin) · `src/lib/actions/user.ts` · `public/portals/js/staff-mgmt.js`.
