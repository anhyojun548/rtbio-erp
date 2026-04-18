# RTBIO ERP — 마스터 진행 계획 (2026-04-18 최신화)

**작성일**: 2026-04-18
**기준**: 과업내용서 2종(간소화/상세) 확정, 프로토타입 Step A/B/C 완료, 팀별 배포본 완성
**목적**: 계약 체결부터 Phase 1~9 실개발까지 단일 진실 원천(SSOT) 제공

> 이 문서가 이전 계획(`2026-04-17-team-implementation-plan.md`, `2026-04-17-prototype-step-abc.md`)을 **대체**한다. 과거 문서는 이력 참조용으로만 유지.

---

## 0. 타임라인 (한 장 요약)

| 날짜 | 마일스톤 | 산출물 | 상태 |
|------|---------|--------|------|
| ~4/16 | 4차 미팅 종료, 요구사항 확정 | 회의록, 기능 분석서 | ✅ |
| 4/17 | 프로토타입 Step A/B/C | 5개 포털 HTML + 팀 배포본 | ✅ |
| 4/17 | 과업내용서 2종 작성 | 간소화/상세 docx | ✅ |
| **4/18** | **하네스·계획 최신화 (현재)** | 본 문서 | 🟡 |
| 4/21 | 1차 데모 (QC·경영지원 집중) | 피드백 수집 | 🔜 |
| 4/27 | 2차 데모 (영업·거래처·CEO) | 최종 요구사항 확정 | 🔜 |
| ~4/30 | **계약 체결** (과업내용서 선택 발송) | 서명본 | 🔜 |
| 5/4~ | **Phase 1 착수** (Prisma 스키마) | 실개발 개시 | ⏸ |
| ~7/25 | Phase 9 배포 | 프로덕션 오픈 | ⏸ |

**원칙**: 계약 체결 전까지 백엔드/DB/배포 코드 착수 금지. 프로토타입 + Mock JSON 으로만 검증.

---

## 1. 현재 완료된 산출물

### 1.1 프로토타입 (prototype/)
- **포털 5종**: `exec-portal.html`, `admin-portal.html`, `qc-portal.html`, `client-portal.html`, `ceo-portal.html`
- **공통 위젯**: `js/widget-dashboard.js` (대시보드 커스터마이징, 전역 기간 + override)
- **팀 배포본 5종**: `prototype/teams/{거래발주폼,품질경영팀,경영지원팀,영업팀,임원진 대시보드}/` — 각 폴더에 HTML + 사용설명서 + 로컬 css/js/assets 포함 (알티바이오 공용 이메일 전달용)

### 1.2 계약 문서
- `docs/3. 과업내용서_RTBIO_간소화_260417.docx` — 업무영역 큰 단위 (분쟁 예방형)
- `docs/3. 과업내용서_RTBIO_상세_260417.docx` — R01~R24 상세 명세 (스코프 확정형)

### 1.3 설계·기획 문서
- `CLAUDE.md` — 프로젝트 메모리 (도메인 규칙 SSOT)
- `docs/01-plan/tech-stack.md` — 스택 확정본 (Next.js + Azure)
- `docs/01-plan/harness-engineering-plan.md` — 하네스 운영 원칙
- `docs/회의록_260410_알티바이오미팅.md` — 4/10 미팅 원본
- `docs/ERP_기능_분석_및_추가계획.md` — 기능 분석서

---

## 2. 확정된 기능 범위 (R01~R24)

상세 명세는 `3. 과업내용서_RTBIO_상세_260417.docx` 참조. 요약:

| 코드 | 기능명 | 주 사용 팀 |
|------|--------|----------|
| R01 | 거래처 관리 (기본정보 + **복수 배송지 등록**) | 경영지원 |
| R02 | 거래처 할인율 | 경영지원 |
| R03 | 발주 및 DB 자동 반영 (**배송지 선택 + 주문 스냅샷**) | 거래처 · QC |
| R04 | 발주 확정 (출고/예약) | QC |
| R05 | 출고 상태 관리 (칸반 커스터마이징) | QC |
| R06 | 거래처별 출고 조회 | 거래처 |
| R07 | 거래명세서 발행 | 경영지원 |
| R08 | 제품 및 재고 관리 | QC |
| R09 | 거래처별 원장 조회 | 경영지원 |
| R10 | 마감원장 | 경영지원 |
| R11 | 부서별 권한 관리 | 전체 |
| R12 | 수금 관리 (신규) | 경영지원 |
| R13 | 주문 마감 (시간 설정) | QC |
| R14 | 재고량 안내 | QC |
| R15 | 영업 실적 현황 자동 집계 | 영업 |
| R16 | 보고·보고서 양식 | 경영지원 · 영업 |
| R17 | 출고내역 조회 (신규) | QC · 경영지원 |
| R18 | 부가세 계산 자동 적용 | 경영지원 |
| R19 | 거래처별 유통 기한 관리 | QC |
| R20 | 판매 계약서 자동 관리 | 경영지원 |
| R21 | 기간별 영업 이력서 | 영업 |
| R22 | 데이터 사용량 입력 | 경영지원 |
| R23 | 영업팀 학회·방문 관리 (신규) | 영업 |
| R24 | 임원진 대시보드 (위젯 커스터마이징) | CEO |

**본 과업 범위 제외**: 세금계산서 발행, 카카오톡 연동, 재고 예측, 품절 차단 (원본 과업내용서 R22/R24/R25 항목)

### 2.0 Phase 2 완료 — 인증·RBAC (2026-04-18)

- **NextAuth v4 + bcrypt**: `src/lib/auth.ts` credentials provider, 세션 8h JWT
- **타입 확장**: `src/types/next-auth.d.ts` — Session/JWT 에 `role/tenantId/tenantCode` 주입
- **RBAC 매트릭스** (`src/lib/rbac.ts` — Edge 호환 순수 함수):
  - `/admin` → TENANT_OWNER, ADMIN
  - `/qc`    → TENANT_OWNER, QC
  - `/exec`  → TENANT_OWNER, ADMIN, EXEC
  - `/ceo`   → TENANT_OWNER, SUPER_ADMIN
  - `/client`→ CLIENT 만
  - `/system`→ SUPER_ADMIN 만
- **미들웨어 체인** (`src/middleware.ts`): 테넌트 추출 → 인증 게이트 → RBAC redirect (미인증→/login, 권한 없음→/403)
- **세션 헬퍼** (`src/lib/session.ts`): `requireAuth()`, `requireRole(...)`, `requireTenant()`
- **감사 로그** (`src/lib/audit.ts`): `writeAuditLog()` + `logAudit()` (fire-and-forget), `extractRequestMeta()` IP/UA 헬퍼
- **UI**: `/login` 페이지 + 5개 포털 placeholder + `/403` + 공통 TopBar (로그아웃)
- **테스트**: RBAC 매트릭스 15 케이스, 가격 로직 5 케이스 — 총 20 pass

### 2.2 Phase 3A 완료 — 거래처 CRUD + 복수 배송지 (2026-04-18)

- **Zod 검증자** (`src/lib/validators/client.ts`): `clientCreate/Update`, `addressCreate/Update` 스키마.
- **표준 액션 결과** (`src/lib/action-result.ts`): `ActionResult<T>` + `ok()`/`fail()`/`zodFail()` 헬퍼 — 서버 액션이 formState 로 쓰기 좋은 형태.
- **Client 서버 액션** (`src/lib/actions/client.ts`): `listClients / getClient / createClient / updateClient / toggleClientActive` — 코드 unique 체크 + 감사로그 + `revalidatePath`.
- **ClientAddress 서버 액션** (`src/lib/actions/client-address.ts`): `createAddress / updateAddress / deleteAddress / setDefaultAddress` — 기본 배송지 1개 유일성을 `$transaction` 으로 enforce. 삭제 시 기본값이었다면 가장 오래된 활성 배송지를 자동 승격.
- **Admin 레이아웃**: `src/app/admin/layout.tsx` — TopBar + 8메뉴 Sidebar, `requireRole("TENANT_OWNER","ADMIN")` 2중 방어.
- **거래처 페이지 3종** (`/admin/clients`, `/admin/clients/new`, `/admin/clients/[id]`, `/admin/clients/[id]/edit`): URL 쿼리 기반 검색/필터, 상세에서 배송지 CRUD inline (`AddressPanel`).
- **테스트**: 거래처/배송지 validator 12 케이스 — 총 32 pass (pricing 5 + session 15 + client 12).
- **E2E 스모크** (curl): 로그인 → `/admin/clients` 200, `/new` 200, `/:id` 200, `/:id/edit` 200. QC 로 접근 시 307→`/403`.

### 2.3 Phase 3B 완료 — 제품 CRUD + 사이즈 (2026-04-18)

- **ClientType enum**: `PHARMACY` 추가 (마이그레이션 `20260418210000_client_type_pharmacy`). 프로토타입의 "약국" 옵션과 일치. 실데이터엔 아직 미사용.
- **Zod 검증자** (`src/lib/validators/product.ts`): `productCreate/Update`, `productSizeCreate/Update`. `basePrice` 는 Decimal(12,2) 형식 검증(소수점 2자리, 0 이상). `expiryMonths` 1~600 정수. `optionalString` 을 빈 문자열→undefined 변환으로 수정 (공유 헬퍼 건드리지 않고 product 전용).
- **Product 서버 액션** (`src/lib/actions/product.ts`): `listProducts / listProductCategories / getProduct / createProduct / updateProduct / toggleProductActive` — 코드 중복 체크 + Decimal 변환 + 감사로그(PRODUCT_CREATE/UPDATE/REACTIVATE/DEACTIVATE).
- **ProductSize 서버 액션** (`src/lib/actions/product-size.ts`): `createSize / updateSize / deleteSize` — `productId+sizeCode` 유니크 제약 앱 사전 체크. 주문/재고 참조가 있는 사이즈는 하드 삭제 금지(참조 건수 메시지 반환).
- **UI**: 목록 (`/admin/products` · 카테고리·활성 필터, 실재고 합계), 상세 (`/admin/products/[id]` · SizesPanel 인라인 CRUD, 알람기준 미만 실재고 빨간색 ⚠), 신규·편집 (`ProductForm` 공용). 카테고리는 기존 값으로 datalist 자동완성.
- **테스트**: 제품 validator 14 케이스 추가 — 총 47 pass (pricing 5 + session 15 + client 13 + product 14).
- **E2E 스모크**: admin 로그인 → `/admin/products` 200, `/new` 200, `/:id` 200, `/:id/edit` 200. QC 접근 시 307→`/403`.

### 2.4 Phase 3C 완료 — 재고 변동 로그 + 입출고 (2026-04-18)

- **Zod 검증자** (`src/lib/validators/inventory.ts`): `receiveSchema` (qty>0) · `adjustmentSchema` (qty≠0 + reason 별 부호 제약: 반품/입고보정=양수, 폐기=음수, 실사조정=±). ADJUST_REASONS 화이트리스트.
- **불변식 헬퍼** (`src/lib/inventory/invariant.ts`): `assertInvariant(physical, available)` — 변동 후 값에 대해 `physical>=0`, `available>=0`, `physical>=available` 검증. `InventoryError` 클래스 분리. `"use server"` 파일 제약 회피 + 단위 테스트 가능.
- **서버 액션** (`src/lib/actions/inventory.ts`): `receiveStock` · `createAdjustment` · `listInventoryLogs` · `getInventorySummary`.
  - **동시성**: 모든 쓰기 액션은 `$transaction` + `$queryRaw` **SELECT FOR UPDATE** 로 행 잠금 (Prisma 공식 미지원 → raw SQL). Lost Update 방지.
  - **로그 이원화**: `InventoryAdjustment` = 비즈니스 원장 (reason, approvedBy), `InventoryLog` = 수치 감사 (qtyDelta + physicalAfter + availableAfter 스냅샷). resolveLogType: 반품→RETURN, 그 외 부호에 따라 ADJUST_IN/OUT.
  - **RBAC**: TENANT_OWNER/ADMIN/QC 허용 (QC 포털 미구현 — 향후 3D 에서 연결). RESERVE/RELEASE/SHIP 타입은 Phase 3D Order 액션에서만 발생 (여기선 금지).
- **UI**:
  - `/admin/inventory` — 활성 제품 사이즈별 현황 테이블(검색/카테고리/저재고 필터) + 통계 카드(관리 사이즈 수·총 실재고·저재고 알람) + 행당 `+ 입고` / `± 조정` 버튼 → `InventoryDialog` 모달.
  - `/admin/inventory/logs` — 변동 이력 조회 (q/타입/기간 필터). 타입별 배지 색상(RECEIVE 녹색, RETURN 보라 등), qtyDelta 부호별 색상. 최대 500건.
- **테스트**: 총 68 pass 예상 — inventory validator 15 + invariant 6 추가 (기존 47 에 +21).
- **E2E 스모크**: `scripts/smoke-inventory.ts` — prisma 직접 실행. 입고 +7 → 조정 -3(폐기) → 최근 로그 2건 확인 → 불변식 거부 케이스 2건 통과.

### 2.5 Phase 3D-1 완료 — 거래처 가격 규칙 CRUD (2026-04-18)

- **pricing-specialist 리뷰 반영**:
  - `discountRate` — Zod 에서 **exclusive** `(0, 1)` 강제 (0은 row 무의미, 1.0=100% 할인 금지)
  - `fixedPrice` — 0 허용 (무상공급). 감사 로그에 `isFree` 플래그 기록
  - `isSuspiciousDiscount(rate >= 0.5)` — ADMIN 차단, TENANT_OWNER 만 저장 가능
  - 고아 할인(카테고리 매칭 제품 없음)은 보존 (추후 제품 재등록 시 자동 복원). UI 에 "매칭 제품 없음" 배지
- **Zod 검증자** (`src/lib/validators/pricing.ts`): `clientDiscountUpsertSchema` / `clientFixedPriceUpsertSchema` + Decimal 입력 파서 + `isSuspiciousDiscount` 헬퍼.
- **서버 액션** (`src/lib/actions/client-pricing.ts`): `upsertClientDiscount` / `deleteClientDiscount` / `upsertClientFixedPrice` / `deleteClientFixedPrice` — `@@unique([clientId, category])` / `@@unique([clientId, productId])` 기반 upsert 패턴. 50%+ 할인은 role 체크로 차단. 감사 로그 4종(`CLIENT_DISCOUNT_UPSERT/DELETE`, `CLIENT_FIXEDPRICE_UPSERT/DELETE`).
- **조회 헬퍼**: `listProductCategoriesForDiscount` (할인 UI datalist), `searchProductsForFixedPrice` (고정가 자동완성, 최대 20건).
- **UI 패널** (`src/components/admin/clients/`):
  - `DiscountPanel` — 카테고리 + %(UI) ↔ 소수(서버) 양방향 변환. 편집 시 카테고리 잠금. 50%+ 빨간색 ⚠ 표시. 매칭 제품 없음 배지.
  - `FixedPricePanel` — 제품명/코드 자동완성, 중복 제품은 선택 불가 처리. 0원은 "무상공급" 녹색 배지.
  - 거래처 상세 (`/admin/clients/[id]`) 하단에 2-컬럼 레이아웃으로 배치.
- **테스트**: 총 90 pass — pricing validator 22 케이스 추가 (discountRate 8 + fixedPrice 5 + schemas 7 + isSuspicious 2).
- **E2E 스모크**: `scripts/smoke-pricing.ts` — 거래처 A 에 할인 10% + 고정가 99,000원 업서트 → `calculatePriceSnapshot` 로 fixedPrice 우선(99,000), 동일 카테고리 할인(520,000→468,000), 할인만 적용(100,000→90,000) 세 경로 검증 → 청소.

### 2.6 Phase 3D-2a 완료 — 주문 DRAFT CRUD (2026-04-18)

- **pricing-specialist 리뷰 반영**:
  - DRAFT 라인 단가는 **현시점 기준 미리보기** — 확정 시 재계산해 스냅샷 고정 (3D-2b 에서). 다만 3D-2a 에서도 pricing.ts 를 호출해 `unitPrice/basePriceAtOrder/lineTotal/discountRateAtOrder/fixedPriceAppliedAtOrder` 를 계산해 즉시 주입 → UI 합계·감사 일관성 확보.
  - DRAFT 주문번호는 임시값 `DRAFT-{cuid8}` — 확정 단계에서 공식 `ORD-YYYYMMDD-NNN` 재발급 (FOR UPDATE + 동시성).
  - DRAFT 삭제는 하드 삭제 (`OrderItem.onDelete: Cascade`) + `ORDER_DELETE_DRAFT` 감사 로그.
  - 배송지 스냅샷은 DRAFT 생성·수정 시점에 찍힘 (`shipToAddressId` 제공 시 ClientAddress 를 복사, 없으면 입력값 그대로). `shipToMemo` 는 주문별 메모가 배송지 기본 메모보다 우선.
  - 같은 `productSizeId` 중복 라인 허용 (R03 엑셀형 UX). 비활성 거래처·비활성 제품에는 DRAFT 금지.
- **Zod 검증자** (`src/lib/validators/order.ts`): `shipToSchema` · `orderItemCreateSchema` · `orderItemUpdateSchema` · `orderCreateSchema` (items `min(1)`) · `orderUpdateSchema` (`clientId` 변경 금지 — 가격 규칙이 달라지므로).
- **서버 액션** (`src/lib/actions/order.ts`):
  - `listOrders(q/clientId/status/from/to)` — 주문번호·거래처명·코드 검색, 상태·기간 필터.
  - `getOrder` — client + items(product + productSize) 풀로드.
  - `createOrder` — `$transaction` + 거래처 활성검사 + 배송지 스냅샷 + 라인별 pricing 계산 후 nested `items.create`.
  - `updateOrder` / `deleteOrder` — `assertDraft` 가드.
  - `addOrderItem` / `updateOrderItem` / `deleteOrderItem` — DRAFT 에서만. 수량 변경 시 `unitPrice` 불변, `lineTotal` 재계산.
  - 보조 조회: `searchClientsForOrder(q)` (활성만), `searchProductSizesForOrder(clientId, q)` (사이즈 + 현시점 가격 미리보기 + 할인/고정가 배지).
  - 감사 로그 6종: `ORDER_CREATE_DRAFT` · `ORDER_UPDATE_DRAFT` · `ORDER_DELETE_DRAFT` · `ORDER_ITEM_ADD` · `ORDER_ITEM_UPDATE` · `ORDER_ITEM_DELETE`.
- **UI** (`src/app/admin/orders/*`, `src/components/admin/orders/*`):
  - `/admin/orders` — 목록 (상태 배지 8색 · 기간·상태·검색 필터).
  - `/admin/orders/new` — 거래처 자동완성 → 주문일/희망일/메모 → 제품 검색 + 사이즈 버튼으로 라인 추가 (합계 실시간) → DRAFT 저장.
  - `/admin/orders/[id]` — 좌: 거래처 요약, 우: 헤더+배송지 편집 (등록 배송지 드롭다운 or 임시주소 입력), 하단: 라인 CRUD 패널. DRAFT 외 상태는 자동 `disabled`.
  - 사이드바 `/admin/orders` 기존 진입점 연결.
- **테스트**: 115 pass — order validator 25 케이스 추가 (item 6 + shipTo 4 + create 9 + update 4 + update schema 2).
- **E2E 스모크**: `scripts/smoke-order.ts` — 거래처+사이즈 2건 로드 → DRAFT 생성(라인1 qty=2) → 라인2 추가(qty=3) → 수량 변경(qty=5, unitPrice 유지) → 전체 합계 검증 → DRAFT 삭제 + `OrderItem` Cascade 검증. 모든 단계 통과.

### 2.7 Phase 3D-2b-1 완료 — 주문 SUBMIT 전환 (2026-04-18)

3D-2b 를 3단계로 쪼개 첫 조각 `SUBMIT` 만 먼저 완결. CONFIRM/REJECT/HOLD/CANCEL 은 3D-2b-2, SHIP 은 3D-2c.

- **상태 머신(문서화)** (`src/lib/validators/order-transition.ts` 헤더):
  ```
  DRAFT ─SUBMIT→ SUBMITTED ─CONFIRM→ CONFIRMED ─(3D-2c SHIP)→ SHIPPING → COMPLETED
                   │  │
                   │  └─REJECT→ REJECTED (terminal)
                   ├─HOLD→ HOLD ─RESUME→ SUBMITTED
                   └─CANCEL→ CANCELLED (CONFIRMED 였다면 RELEASE)
  ```
  가격 스냅샷 잠금 시점은 **SUBMIT**, 재고 예약(RESERVE)은 **CONFIRM**, 실재고 차감(SHIP)은 3D-2c.
- **Zod**: `orderSubmitSchema` — `note` 선택(최대 500자, 빈 문자열/공백 → undefined). 5 케이스 단위 테스트 (총 120 pass).
- **채번 설계** (마이그레이션 없이): Postgres advisory lock 으로 하루 단위 잠금 → `MAX(seq)+1`.
  ```ts
  const lockKey = Number(`${YYYYMMDD}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
  // SELECT orderNumber FROM Order WHERE orderNumber LIKE 'ORD-YYYYMMDD-%' ORDER BY ... LIMIT 1
  // nextSeq = parseInt(tail)+1 || 1
  return `ORD-YYYYMMDD-${String(seq).padStart(3, "0")}`;
  ```
  같은 날짜에 동시 SUBMIT 이 들어와도 트랜잭션 커밋 전까지 advisory lock 이 유지돼 seq 가 충돌하지 않음. 카운터 테이블 추가 없이 스키마 무변경.
- **서버 액션** (`src/lib/actions/order.ts`):
  - `submitOrder(id, {note?})` — `$transaction` 내부에서
    1) 주문 로드 + `status === "DRAFT"` / `items.length > 0` / `client.active` 가드
    2) `issueOfficialOrderNumber(tx, orderDate)` 채번
    3) 라인별 `computeLineFromPricing(tx, clientId, productSizeId, quantity)` 재실행 → `unitPrice/basePriceAtOrder/discountRateAtOrder/fixedPriceAppliedAtOrder/lineTotal` 재스냅샷 (DRAFT 편집 중 고정가/할인율이 변경됐을 가능성 반영)
    4) `status=SUBMITTED`, `orderNumber=새번호`, `billingMonth=YYYY-MM` 업데이트
  - `OrderError` 사용자 메시지 + `ActionResult` 패턴 유지.
  - 감사 로그 1종 추가: `ORDER_SUBMIT`.
- **UI**: `StatusActions` 컴포넌트 — DRAFT 에서 "발주 제출 →" 버튼(라인 수 0이면 disabled) → amber 확인 모달 → 서버 액션 호출 → `router.refresh()`. 비-DRAFT 상태는 "추가 상태 전이는 다음 단계에서 제공됩니다" 안내. `/admin/orders/[id]` 하단에 배치.
- **E2E 스모크** (`scripts/smoke-order-submit.ts`): DRAFT 2건 생성 → 각각 `submitInline` → 공식 번호 형식/status/billingMonth 검증 → seq 증가(`seq2 === seq1 + 1`) 검증 → 이미 SUBMITTED 인 주문 재제출 거부 검증 → 정리. 모든 단계 통과:
  ```
  ✓ SUBMIT #1 → ORD-20260419-001 (status=SUBMITTED)
  ✓ SUBMIT #2 → ORD-20260419-002 (seq 1 → 2)
  ✓ 이미 SUBMITTED 인 주문은 재제출 거부
  ```

### 2.8 Phase 3D-2b-2 완료 — REJECT/HOLD/RESUME/CANCEL (재고 미영향) (2026-04-19)

3D-2b 2번째 조각. 재고를 건드리지 않는 전이 네 개를 한 번에 구현. CONFIRM(RESERVE) + CANCEL(RELEASE) 은 3D-2b-3 에서.

- **스키마 확장**: `Order` 에 `rejectedAt/rejectedReason/heldAt/heldReason` 4개 컬럼 추가 (`20260419000000_order_transition_columns`). CANCELLED 사유는 빈도 낮아 별도 컬럼 대신 `note` 에 `[취소] 사유` 프리픽스로 기록.
- **Zod** (`orderRejectSchema` / `orderHoldSchema` / `orderResumeSchema` / `orderCancelSchema`):
  - REJECT/HOLD/CANCEL: 사유 필수 (`requiredReason` — trim 후 3~500자).
  - RESUME: note 선택 (`optionalNote`).
  - 16 케이스 테스트 추가 (누적 21 transition tests).
- **서버 액션** (`applyStatusTransition` 공통 헬퍼):
  - REJECT: SUBMITTED/HOLD → REJECTED (terminal). `rejectedAt = now(), rejectedReason = reason`.
  - HOLD: SUBMITTED → HOLD. `heldAt = now(), heldReason = reason`.
  - RESUME: HOLD → SUBMITTED. `heldAt/heldReason = null` (감사로그에는 남음).
  - CANCEL: SUBMITTED/HOLD → CANCELLED. `note = "[취소] 사유"`. **CONFIRMED 에서 호출 시 3D-2b-3 안내 메시지로 차단**.
  - 감사 로그 4종: `ORDER_REJECT` · `ORDER_HOLD` · `ORDER_RESUME` · `ORDER_CANCEL`.
- **UI** (`StatusActions.tsx` 전면 개편):
  - 현재 상태 기반으로 가능한 버튼만 노출 (DRAFT→제출 / SUBMITTED→보류·반려·취소 / HOLD→재개·반려·취소).
  - 사유 필수 전이(REJECT/HOLD/CANCEL): 3줄 textarea 모달, 3자 미만은 클라이언트 가드 + 서버 가드 이중.
  - 단순 확인(SUBMIT/RESUME): amber 확인 모달.
  - 주문 상세 페이지 헤더 아래 REJECT/HOLD 사유 뱃지 (빨강/황색) — 상태 + 사유 + 일시 표시.
- **E2E 스모크** (`scripts/smoke-order-transition.ts`):
  - [A] DRAFT → SUBMIT → HOLD → RESUME → REJECT (모든 필드 셋업/초기화 검증)
  - [B] DRAFT → SUBMIT → CANCEL (`note` 에 `[취소]` 프리픽스)
  - [C] CANCELLED 에서 재-CANCEL → 가드 실패 확인
  - [D] DRAFT 에서 바로 REJECT → 가드 실패 확인
- **테스트**: 누적 136 pass (transition 21).

### 2.9 Phase 3D-2b-3 완료 — CONFIRM(RESERVE) + CANCEL CONFIRMED(RELEASE) (2026-04-19)

주문 상태 머신을 재고와 연결한 첫 단계. `availableStock` 만 움직이고 `physicalStock` 은 실출고(Shipment) 때 차감.

- **Zod** (`orderConfirmSchema`): `note` 선택. 3 케이스 테스트 추가 (transition 총 24 pass).
- **서버 액션** — `confirmOrder(id, {note?})`:
  - 가드: SUBMITTED · 활성 거래처 · 라인 ≥ 1.
  - 각 라인:
    - `SELECT ... FOR UPDATE` 로 ProductSize 행 잠금 (Phase 3C 패턴 재사용).
    - `availableStock -= quantity`. 재고 부족 시 `"재고 부족: {code} {sizeCode} — 가용 N개 / 요청 M개"` 에러 → 전체 트랜잭션 롤백.
    - `assertInvariant(physical, nextAvailable)` 로 불변식 재확인.
    - `InventoryLog` type=RESERVE, qtyDelta=`-quantity`, `relatedOrderId=id`, note=`CONFIRM[: {note}]`.
  - `Order.status=CONFIRMED, confirmedAt=now()`.
  - 감사 로그 `ORDER_CONFIRM` (reserveLines 수 포함).
- **서버 액션 확장** — `cancelOrder` 재작성:
  - 기존 `applyStatusTransition` 헬퍼로는 재고 트랜잭션을 한 번에 못 다뤄서 `$transaction` 로 직접 재구성.
  - SUBMITTED / HOLD → CANCELLED: 재고 영향 없음 (기존 경로 유지).
  - **CONFIRMED → CANCELLED**: 각 라인 `availableStock += quantity` (RELEASE), `InventoryLog` type=RELEASE 기록. `releasedStock=true` 감사 로그.
  - 응답에 `releasedStock: boolean` 포함 → UI 에서 분기 가능.
- **UI** (`StatusActions.tsx`):
  - CONFIRMED 상태에서 "취소" 버튼 활성화. 취소 모달 상단에 **"CONFIRMED 이므로 예약 재고가 RELEASE 됩니다"** 경고 배너.
  - SUBMITTED 에서 "주문 확정 →" 버튼 (indigo). 확정 모달에 재고 부족 가능성 안내.
- **E2E 스모크** (`scripts/smoke-order-confirm.ts`):
  - [A] DRAFT(qty=3) → SUBMIT → CONFIRM: `availableStock` 3 차감, `physicalStock` 불변, `InventoryLog.RESERVE(qtyDelta=-3)` 기록.
  - [B] CONFIRMED → CANCEL: `availableStock` 원복(+3), `InventoryLog.RELEASE(qtyDelta=+3)` 기록.
  - [C] 2라인 주문 (line1 정상, line2 재고 0) → CONFIRM 실패 기대 + line1 재고 롤백 확인 (전체 `$transaction` 원자성).
  - 결과: `avail 114→111→114`, 재고 부족 에러 `"가용 0 < 요청 1"`, 롤백 후 `avail 114 불변`.
- **테스트**: 누적 139 pass.

### 2.1 R01·R03 세부 — 복수 배송지 (2026-04-18 추가)

하나의 거래처가 여러 창고/지점에 배송받을 수 있어야 함 (예: 대리점 본점 + 지방 지점 + 물류센터, 병원 본관 구매팀 + 수술동 긴급창고).

- **스키마**: `ClientAddress` 모델 추가 (1:N, 거래처당 복수 등록). 기본 배송지 플래그 1개 유일성은 앱 로직으로 보장.
- **발주 UX**: page-confirm 에 "배송지 선택" 라디오 리스트 + "이번만 임시주소" 옵션 + "신규 배송지 추가" 모달.
- **스냅샷**: `Order.shipToAddressId` 는 참조용. 실제 배송 정보는 `shipToLabel/Recipient/Phone/PostalCode/Address/AddressDetail/Memo` 플랫 컬럼에 주문 시점 복사 → 이후 배송지가 수정/삭제돼도 기존 주문은 불변.
- **관리 UX**: admin-portal 거래처 상세 모달에 "📍 배송지 관리" 섹션 (추가/수정/삭제, 기본 배송지 변경).

---

## 3. 잔여 작업 (계약 체결 전)

### 3.1 4/21 1차 데모 준비 (현재~4/20)
- [ ] 팀별 배포본 최종 동작 확인 (Chrome DevTools 모바일 뷰 포함)
- [ ] 데모 시나리오 리허설
  1. **QC**: 칸반 열 커스터마이징 → 카드 접기/펼치기 → 보류 처리 → 재고 삭제 → 샘플 자동완성 → 업무시간 설정
  2. **경영지원**: 대시보드 전역 기간 + 위젯 override → 수금 관리 일부입금 → 거래처원장 담당자 필터 → 거래명세서 담당자 검색 → 세금계산서 모달
- [ ] 1차 피드백 수집 양식 준비

### 3.2 4/27 2차 데모 준비 (4/22~4/26)
- [ ] 1차 피드백 반영 (긴급 항목만)
- [ ] 영업·CEO·거래처 포털 시나리오 점검
  1. **영업**: 매출 드릴다운 → 거래처 카드 발주서/명세표 출력 → 학회 방명록 개별 입력
  2. **거래처**: 엑셀형 발주폼 → 4단계 진행상태
  3. **CEO**: 통합 KPI → 위젯 프리셋

### 3.3 계약 체결 (~4/30)
- [ ] 간소화/상세 중 **최종 1종 선택** (분쟁예방 우선=간소화, 스코프확정 우선=상세)
- [ ] 서명본 수령
- [ ] 착수금 입금 확인 → Phase 1 킥오프

---

## 4. Phase 1~9 실개발 로드맵 (14주)

### 4.1 Phase 일정 (계약일 기준)

| Phase | 기간 | 내용 | 주 명령어 |
|-------|------|------|----------|
| **P1 스키마** ✅ | W1-2 | Prisma 스키마, 멀티테넌시, 복수 배송지, 마이그레이션 | `/autopilot` + `schema-designer` |
| **P2 인증** ✅ | W3 | NextAuth, RBAC 매트릭스, 미들웨어 체인, AuditLog util | `/team 3:executor` |
| **P3 마스터** ⏳ | W4-5 | 제품/거래처/재고 CRUD, 할인율, 배송지 UI | `/team 4:executor` |
| **P4 주문** | W6-7 | 발주→확정→출고 칸반, 가격스냅샷 | `/team 4:executor` + `pricing-specialist` |
| **P5 경영지원** | W8-9 | 명세서/원장/수금/보고서 | `/ultrawork` |
| **P6 영업** | W10 | 담당자 매출, 학회 방명록 | `/team 3:executor` |
| **P7 통합·알림** | W11 | 재고알람, 이메일큐, CEO 대시보드 | `/autopilot` |
| **P8 QA** | W12-13 | 통합테스트, PDF, 모바일, 성능 | `/ralph` |
| **P9 배포** | W14 | Azure Container Apps, DB 프로비저닝 | 수동 |

### 4.2 핵심 DB 스키마 (P1)

| 스키마 | 테이블 |
|--------|--------|
| `public` | User, Tenant, AuditLog, SystemSetting |
| `tenant_{id}` | Product, ProductSize |
| `tenant_{id}` | Client, ClientDiscount, ClientFixedPrice |
| `tenant_{id}` | Order, OrderItem (가격 스냅샷 포함) |
| `tenant_{id}` | Inventory, InventoryLog, InventoryAdjustment |
| `tenant_{id}` | Invoice, InvoiceItem, ClosingLedger |
| `tenant_{id}` | Payment, BankTransaction |
| `tenant_{id}` | SalesAssignment, ConferenceVisitor |
| `tenant_{id}` | Notification, EmailQueue |
| `tenant_{id}` | KanbanColumn, DashboardWidget (커스터마이징) |

### 4.3 데이터 파이프라인

```
[거래처] 발주 작성 (R03)
    ↓
[QC팀] 발주확정(R04) → 가용재고 차감 → 칸반 진입(R05, 커스터마이징 가능)
    ↓  단계별 담당자 배정 (R17)
    ↓
[경영지원] 거래명세서(R07) → 원장(R09/R10) → 수금 관리(R12)
    ↓
[영업팀] 실적 자동 집계(R15) → 학회·방문(R23)
    ↓
[CEO] 위젯 대시보드(R24)
```

---

## 5. 우선순위 및 리스크

| 순위 | 팀 | 이유 | 대응 |
|------|----|------|------|
| 1 | 경영지원 | 인력 이슈 가장 긴급 | 4/21 데모 집중, P5 앞당김 검토 |
| 2 | QC | 칸반+재고알람 일일 업무 | 4/21 시연 안정화 |
| 3 | 거래처 | 엑셀 발주 대체 기대 | P4에 완성 |
| 4 | 영업 | 메일 대기 | P6 |
| 5 | CEO | 데이터 누적 후 의미 | P7 |

| 리스크 | 대응 |
|--------|------|
| 경영지원 인력 이탈 | 4/21 데모에 화면 최우선 배치 |
| 영업 요구사항 추가 | 간소화 버전 계약 시 유연 수용, 상세 버전 시 변경관리 프로세스 |
| 재고 이중관리 버그 | P3 완료 시 `inventory-specialist`로 로직 검증 |
| 가격 스냅샷 누락 | P4 완료 시 `pricing-specialist`로 전수 검토 |
| Azure 크레딧 지연 | 법인 등록 후 즉시 신청, 지연 시 자비 운영 2개월 가능 |

---

## 6. 검증 방법

### 6.1 프로토타입 (즉시)
```
브라우저에서 prototype/index.html 열기 →
각 포털 데모 시나리오(§3.1, §3.2) 클릭 →
Chrome DevTools 모바일(375px) 재확인
```

### 6.2 Phase별 (계약 후)
- Phase 완료 시 `/learner` 실행 → 스킬 축적
- 각 API는 curl 테스트 + 프론트 연동 확인
- 도메인 규칙 위반 0건 유지 (`CLAUDE.md` 기준)

---

## 7. 관련 문서 인덱스

| 분류 | 문서 | 용도 |
|------|------|------|
| **SSOT** | `CLAUDE.md` | 프로젝트 메모리 (자동 로드) |
| **계약** | `docs/3. 과업내용서_RTBIO_간소화_260417.docx` | 간소화 버전 |
| **계약** | `docs/3. 과업내용서_RTBIO_상세_260417.docx` | 상세 버전 (R01~R24) |
| **스택** | `docs/01-plan/tech-stack.md` | 기술 스택 확정본 |
| **하네스** | `docs/01-plan/harness-engineering-plan.md` | 하네스 운영 원칙 |
| **하네스 셋업** | `docs/superpowers/plans/2026-04-15-harness-engineering-setup.md` | Day 0 셋업 절차 |
| **미팅** | `docs/회의록_260410_알티바이오미팅.md` | 4/10 원본 |
| **분석** | `docs/ERP_기능_분석_및_추가계획.md` | 기능 분석서 |
| **이력** | `docs/superpowers/plans/2026-04-17-team-implementation-plan.md` | (대체됨, 이력용) |
| **이력** | `docs/superpowers/plans/2026-04-17-prototype-step-abc.md` | (완료됨, 이력용) |
