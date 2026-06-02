# DB 탐색기 (전체 테이블 조회 + 설정성 편집) — 설계

**작성일**: 2026-06-01
**상태**: 승인됨 (브레인스토밍 완료, B안 채택)
**대상**: RTBIO ERP 프로토타입 데이터 탐색기 확장 + 신규 백엔드
**선행**: 기존 데이터 탐색기(TransactionLedger 41K CRUD) — 유지

---

## 1. 배경 / 목표

운영·디버깅·CS 를 위해 ERP 의 **모든 업무 테이블을 한 곳에서 조회**하고, **도메인 로직이 없는 설정성 테이블은 인라인 편집**한다. 단, 핵심 도메인(주문·재고·정산 등)의 무결성을 깨는 raw 편집은 금지.

## 2. 핵심 결정 (브레인스토밍 확정)

| # | 결정 | 선택 |
|---|------|------|
| D1 | Tier 1 조회 범위 | **의미있는 업무 테이블 ~20개** (로그·조인·시스템·큐 테이블 제외) |
| D2 | 접근 권한 | **OWNER/ADMIN** (읽기·편집 공통) — User·민감 테이블 노출 때문에 조임 |
| D3 | Tier 2 편집 화이트리스트 | **설정성 4개**: `OrgOption`·`KanbanColumn`·`TenantSetting`·`Notice` |
| D4 | 보안 경계 | **서버 레지스트리**가 단일 진실 — 임의 테이블/컬럼/SQL 접근 불가 |

## 3. 보안 원칙 — 서버 레지스트리가 경계

클라이언트가 아니라 **서버의 화이트리스트 레지스트리**(`src/lib/db-explorer/registry.ts`)가 "어떤 테이블·컬럼·작업이 가능한가"를 결정한다. API 는 레지스트리에 정의된 테이블/컬럼/작업만 수행. 임의 모델명·컬럼·raw SQL 접근 불가 (인젝션 차단).

## 4. 멀티테넌시 (아키텍처 반영)

- `public` 스키마 모델(`User`, `AuditLog`, `OrgOption`)은 `tenantId` 컬럼 보유 → **`tenantId = session.tenantId` 강제 필터**.
- `tenant_altibio` 스키마 모델(나머지 전부)은 **스키마 자체가 테넌트 경계**(컬럼 불필요) → Prisma 가 테넌트 스키마로 격리. 추가 필터 불필요.
- 레지스트리에 `tenantScoped: boolean` 으로 표기.

## 5. 데이터 모델 (스키마 변경 없음)

신규 테이블 없음. 기존 Prisma 모델을 메타 조회. 컬럼 메타는 **Prisma DMMF**(`Prisma.dmmf.datamodel.models`)에서 런타임 추출(scalar 필드) − 레지스트리의 `sensitiveFields` 제외.

## 6. 서버 레지스트리 (`src/lib/db-explorer/registry.ts`)

각 테이블 엔트리:
```ts
type DbTableDef = {
  key: string;              // url-safe 식별자 (예: 'order')
  label: string;            // 한글 라벨
  model: string;            // Prisma 모델 accessor (예: 'order')
  group: string;            // 메뉴 그룹 (거래처/제품/주문/정산/설정 …)
  tenantScoped: boolean;    // public 스키마 + tenantId 필터 여부
  sensitiveFields: string[];// 절대 노출 금지 (예: ['password'])
  searchFields: string[];   // q 검색 대상 컬럼
  defaultOrderBy: object;   // 예: { createdAt: 'desc' }
  editable: boolean;        // Tier 2 화이트리스트
  editableFields?: Record<string, 'string'|'int'|'boolean'|'datetime'>;
};
```

### 6-1. Tier 1 읽기 (~20개, editable:false)
거래처군(Client·ClientAddress·ClientDiscount·ClientFixedPrice) · 제품/재고(Product·ProductSize·ExpiryLot) · 주문(Order·OrderItem) · 출고(Shipment·ShipmentAssignee) · 명세서(Invoice·InvoiceItem) · 수금(Payment·BankTransaction·ClosingLedger) · 영업(Conference·ConferenceVisitor·SalesContract·SalesAssignment·DataUsage) · UDI(UdiReport·UdiReportItem) · 조달(ProcurementProject) · 품질(QualityDocument) · 직원(User — `sensitiveFields:['password']`, tenantScoped) · TransactionLedger(41K).

**제외**: 로그(InventoryLog·ShipmentStageLog·NoticeReadLog·AuditLog) · 조인(NoticeRecipient) · 시스템/큐(Notification·EmailQueue·DashboardWidget·Tenant·SystemSetting).

### 6-2. Tier 2 편집 (4개, editable:true)
| 테이블 | editableFields |
|---|---|
| `OrgOption` | label·sortOrder·active (kind 제외 — 부서/직급 이동 방지) |
| `KanbanColumn` | label·sortOrder·color·isTerminal (key 제외 — 참조 무결성) |
| `TenantSetting` | value (key 제외) — ⚠ raw 편집, 검증된 경로는 설정 페이지 |
| `Notice` | title·body·target·priority·pinned·expiresAt |

> 4개 모두 도메인 불변식 없는 단순 config 행 → 직접 update 안전. TenantSetting.value 만 형식 의존성 있어 감사로그 + 안내.

## 7. API

| Method | Path | 권한 | 동작 |
|---|---|---|---|
| GET | `/api/db-explorer` | OWNER/ADMIN | 레지스트리 테이블 목록(그룹·label·editable) — 피커용 |
| GET | `/api/db-explorer/[table]?q=&limit=&offset=` | OWNER/ADMIN | `prisma[model].findMany`(안전컬럼 select + tenantScoped 필터 + 검색 + 페이지) → `{ rows, columns, total }`. 민감컬럼 미포함 |
| PATCH | `/api/db-explorer/[table]/[id]` | OWNER/ADMIN | **editable=true 테이블만** · `editableFields` 만 허용 · 타입 coerce/검증 · tenantScoped 가드 · `logAudit` |

- 비-화이트리스트 테이블 PATCH → 403. 비허용 필드 → 무시/거부. 비등록 테이블 GET → 404.
- `prisma[model]` 은 레지스트리 화이트리스트로 검증된 accessor 만 (`(prisma as any)[def.model]`).

## 8. 코드 구조

신규:
```
src/lib/db-explorer/registry.ts        — 테이블 정의 (보안 경계)
src/lib/db-explorer/registry.test.ts   — 단위 테스트
src/lib/db-explorer/query.ts           — DMMF 컬럼 추출 + findMany/update 헬퍼 (tenant/sensitive 가드)
src/app/api/db-explorer/route.ts       — GET 목록  ※ 기존 transaction 용 route 와 충돌 주의(아래)
src/app/api/db-explorer/[table]/route.ts        — GET 테이블 조회
src/app/api/db-explorer/[table]/[id]/route.ts   — PATCH 편집
public/portals/js/db-admin.js          — 전체 테이블 브라우저 UI 모듈
```

> **경로 충돌 주의**: 기존 `/api/data-explorer`(TransactionLedger 전용)는 그대로 유지. 신규는 **`/api/db-explorer`** (다른 경로) 로 분리해 충돌 회피.

수정:
```
public/portals/admin-portal.html  — 데이터 탐색기 페이지에 "전체 테이블" 모드/탭 + db-admin.js 로드
docs/02-design/api-reference.md   — DB 탐색기 섹션
```

## 9. UI (프로토타입)

- 데이터 탐색기 페이지에 **"전체 테이블"** 섹션 추가(기존 41K TransactionLedger 탐색기는 별도 유지).
- 좌측/상단 **테이블 피커**(그룹별 ~20개) → 선택 시 `GET /api/db-explorer/[table]` → 그리드(서버가 준 컬럼 자동 렌더, 검색·페이지네이션, 표 가로 스크롤은 이미 적용된 `.table-scroll` 활용).
- editable 테이블만 행 옆 **편집** → 모달/인라인(editableFields) → `PATCH`. 나머지는 읽기 전용(편집 버튼 없음).
- 사용자 문자열은 `_esc` 이스케이프. metaAdmin 아니면 페이지/메뉴 미노출.

## 10. 보안 요약
OWNER/ADMIN 전용 · 레지스트리 화이트리스트(임의 접근 차단) · public 모델 tenantId 강제 · 민감컬럼(password) select 제외 · 쓰기는 4개 안전 테이블 + 허용 필드만 · 전건 감사로그.

## 11. 테스트
- vitest: registry 정합성(편집 테이블만 editableFields, 민감컬럼 정의), query 헬퍼(sensitive 제외·tenant 필터·editableFields 강제).
- smoke-db-explorer: 읽기(컬럼에 password 없음·tenant 필터) · 비허용 테이블 PATCH 거부 · 허용 테이블(OrgOption) 편집+감사 · 비허용 필드 무시.

## 12. 작업량
약 1.5일: registry+query(DMMF) ½d · 3 endpoint ¼d · UI 모듈 ½d · 테스트+문서 ¼d.

## 13. 비고
- AuditLog 조회는 가치 있으나 D1(로그 제외)로 1차 제외 — 필요 시 읽기 전용 추가.
- TenantSetting 편집은 raw — 형식 검증은 설정 페이지가 정식 경로(안내 문구).
- 향후 Tier 3(핵심 도메인)는 직접 편집 대신 전용 도메인 화면 유지(불변식 보호).

---

**참고**: `CLAUDE.md` · `src/lib/team.ts`(권한) · `public/portals/js/data-explorer*.js`(기존 탐색기) · `prisma/schema.prisma`.
