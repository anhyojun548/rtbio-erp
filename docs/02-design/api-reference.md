# RTBIO ERP — API 레퍼런스

**상태**: 통합 정리 (2026-06-01 기준)
**범위**: `src/app/api/*` 전체 **76개 route 파일** + 호출 server action RBAC 매트릭스
**대상 독자**: 백엔드 통합 개발자, 프론트 포털 작업자, AI 에이전트 (windyflo 도구 포함)

---

## 0. 표기 규약

- **경로 패러미터** — `[id]`, `[orderId]` 등 대괄호.
- **권한 표기** — `OWNER / ADMIN / EXEC / QC / CLIENT / SUPER_ADMIN`. 콤마는 OR (해당 역할 중 하나라도 부여되면 통과). `OWNER` 는 `TENANT_OWNER` 약칭.
- **응답 상태** — 명시 없으면 `200 OK` (성공) · `400 Bad Request` (검증 실패) · `401 Unauthorized` (세션 없음) · `403 Forbidden` (역할 부족) · `404 Not Found`.
- **단가/금액 필드는 Decimal** — JSON 직렬화 시 string 으로 전달됨 (예: `"34069.00"`). 클라이언트에서 `Number()` 변환 권장.
- **날짜는 ISO 8601** — `2026-05-26T05:28:15.278Z` 형식.

### 0-1. ⚠️ 두 단계 권한 검증 (route guard + action RBAC)

RTBIO 의 도메인 API 는 **route 핸들러에서 인증만 확인**하고, **실제 역할 검증(RBAC)은 server action 내부**에서 `requireRole(...)` 으로 수행한다.

```
route.ts:  if (!session?.user) return 401     // 로그인 여부만
   ↓
action:    await requireRole("TENANT_OWNER","ADMIN")  // 역할 부족 시 redirect("/403") throw
```

따라서 본 문서의 "권한" 컬럼은 **호출 액션이 요구하는 역할** 이다. 로그인은 했지만 역할이 부족하면:

> `requireRole` 거부 → Next.js `NEXT_REDIRECT` throw → **RSC 307 응답 (`vary: RSC`)** → `/403`.
> fetch 클라이언트는 `r.ok` 가 `true` 여도 본문이 HTML 일 수 있으므로 **content-type 을 확인**해야 한다 (§17 참고).

**예외 — 대시보드 위젯 CRUD** (`/api/dashboard/widgets/*`): 역할 게이트가 없다. 로그인한 사용자가 **자기 소유(`userId == session.user.id`) 위젯만** 관리한다.

---

## 1. 인증 (`/api/auth/*`, `/api/me`)

NextAuth.js v4 + Credentials Provider (이메일+비밀번호 / bcrypt) + JWT 세션 (8 시간).

| Method | Path | 권한 | 설명 |
|---|---|---|---|
| GET | `/api/auth/csrf` | Public | CSRF 토큰 발급 |
| GET | `/api/auth/session` | Public | 현재 세션 JSON |
| POST | `/api/auth/callback/credentials` | Public | 자격증명 로그인 — body: `csrfToken`, `email`, `password`, `callbackUrl` |
| POST | `/api/auth/signout` | Public | 로그아웃 — body: `csrfToken`, `callbackUrl` |
| GET | `/api/me` | 인증 | 현재 유저 — `{ id, email, name, role, tenantId, tenantCode, clientId }` |

**세션 페이로드**:
```json
{
  "id": "cuid", "email": "x@y.local", "name": "홍길동",
  "role": "TENANT_OWNER" | "ADMIN" | "EXEC" | "QC" | "CLIENT" | "SUPER_ADMIN",
  "tenantId": "cuid|null",
  "tenantCode": "altibio|null",
  "clientId": "cuid|null"   // CLIENT 역할만 채워짐
}
```

**RBAC 매트릭스 — 포털 경로**:

| 경로 prefix | 허용 역할 |
|---|---|
| `/admin/*`, `/portals/admin-portal.html` | TENANT_OWNER, ADMIN |
| `/qc/*`, `/portals/qc-portal.html` | TENANT_OWNER, QC |
| `/exec/*`, `/portals/exec-portal.html` | TENANT_OWNER, ADMIN, EXEC |
| `/ceo/*`, `/portals/ceo-portal.html` | TENANT_OWNER, SUPER_ADMIN |
| `/client/*`, `/portals/client-portal.html` | TENANT_OWNER, SUPER_ADMIN, CLIENT |
| `/system/*` | SUPER_ADMIN |

미들웨어 `src/middleware.ts` 가 `getToken` 으로 JWT 확인 → 미인증 시 `/login` 리다이렉트, 권한 부족 시 `/403`.

---

## 2. 거래처 (`/api/clients`)

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/clients?q=&type=&active=` | OWNER, ADMIN, QC, EXEC | `listClients` |
| POST | `/api/clients` | OWNER, ADMIN | `createClient` |
| GET | `/api/clients/[id]` | OWNER, ADMIN | `getClient` |
| PATCH | `/api/clients/[id]` | OWNER, ADMIN | `updateClient` (경쟁업체/특이사항 `note` 포함) |
| DELETE | `/api/clients/[id]` | OWNER, ADMIN | `toggleClientActive` (soft delete — `active=false`) |

**Client 모델 주요 필드**: `id, code(unique), name, type(HOSPITAL|AGENCY|OTHER), businessNumber, representative, phone, email, address, postalCode, paymentTerms, note, salesRepId, active, createdAt, updatedAt`.

### 2-1. 배송지 (`/api/clients/[id]/addresses`)

복수 배송지 1:N. 거래처당 `isDefault=true` 최대 1개 (앱 로직 보장). 발주 시 스냅샷되므로 이후 수정/삭제돼도 과거 주문 불변.

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/clients/[id]/addresses` | OWNER, ADMIN | `listAddresses` (isDefault desc → createdAt asc) |
| POST | `/api/clients/[id]/addresses` | OWNER, ADMIN | `createAddress` — 첫 배송지/`isDefault=true` 면 자동 기본 지정. **201** |
| PATCH | `/api/clients/[id]/addresses/[addressId]` | OWNER, ADMIN | `updateAddress` — `isDefault=true` 시 기존 기본 자동 해제 |
| DELETE | `/api/clients/[id]/addresses/[addressId]` | OWNER, ADMIN | `deleteAddress` (soft `active=false`) — 기본이었으면 최고참 활성 배송지 자동 승격 |
| POST | `/api/clients/[id]/addresses/[addressId]/default` | OWNER, ADMIN | `setDefaultAddress` — 트랜잭션으로 기존 기본 해제 (비활성 배송지 불가) |

### 2-2. 카테고리 할인율 (`/api/clients/[id]/discounts`)

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/clients/[id]/discounts` | OWNER, ADMIN | `listClientDiscounts` (category asc) |
| POST | `/api/clients/[id]/discounts` | OWNER, ADMIN | `upsertClientDiscount` — `{ category, discountRate, note? }`, `(clientId+category)` unique. **50% 이상 할인율은 OWNER 만** |
| DELETE | `/api/clients/[id]/discounts/[discountId]` | OWNER, ADMIN | `deleteClientDiscount` (하드 삭제 — 진행 주문은 스냅샷 보호) |

### 2-3. 제품별 고정가 (`/api/clients/[id]/fixed-prices`)

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/clients/[id]/fixed-prices` | OWNER, ADMIN | `listClientFixedPrices` (제품 코드/명/basePrice include) |
| POST | `/api/clients/[id]/fixed-prices` | OWNER, ADMIN | `upsertClientFixedPrice` — `{ productId, fixedPrice, note? }`, `(clientId+productId)` unique. **`fixedPrice=0` 허용 (무상공급, 감사 `isFree=true`)** |
| DELETE | `/api/clients/[id]/fixed-prices/[priceId]` | OWNER, ADMIN | `deleteClientFixedPrice` (하드 삭제) |

> 가격 우선순위: **고정가 > 카테고리 할인 > 기본가** (`pricing.calculatePriceSnapshot`). 주문 확정 시 라인별 스냅샷.

---

## 3. 제품 (`/api/products`)

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/products?q=&category=&active=` | OWNER, ADMIN, QC | `listProducts` (sizes include) |
| POST | `/api/products` | OWNER, ADMIN | `createProduct` (with sizes) |
| GET | `/api/products/[id]` | OWNER, ADMIN, QC | `getProduct` |
| PATCH | `/api/products/[id]` | OWNER, ADMIN | `updateProduct` |
| DELETE | `/api/products/[id]` | OWNER, ADMIN | `toggleProductActive` (soft) |

**Product 주요 필드**: `id, code(unique), name, category, brand, basePrice(Decimal), udiCode, active, sizes: ProductSize[]`.
**ProductSize**: `id, productId, sizeCode, physicalStock, availableStock, reorderPoint`.

---

## 4. 주문 (`/api/orders`)

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/orders?q=&status=&from=&to=` | OWNER, ADMIN, QC | `listOrders` (items 포함) |
| POST | `/api/orders` | OWNER, ADMIN, QC | `createOrder` (DRAFT 생성) |
| GET | `/api/orders/[id]` | OWNER, ADMIN, QC | `getOrder` |
| PATCH | `/api/orders/[id]` | OWNER, ADMIN, QC | `updateOrder` / `addOrderItem` 등 |
| POST | `/api/orders/[id]/transition` | OWNER, ADMIN, QC | 상태 전이 (`SUBMIT`/`REJECT`/`HOLD`/`RESUME`/`CONFIRM`/`CANCEL`) |
| PATCH | `/api/orders/[id]/items/[itemId]` | OWNER, ADMIN, QC | `updateOrderItem` — `{ quantity, note? }`, 가격 스냅샷 서버 재계산 |
| DELETE | `/api/orders/[id]/items/[itemId]` | OWNER, ADMIN, QC | `deleteOrderItem` |

**상태 머신**:
```
DRAFT ──submit──▶ SUBMITTED ──confirm──▶ CONFIRMED ──ship start──▶ SHIPPING ──ship complete──▶ COMPLETED
              │              │                                 │
              └──reject──▶ REJECTED       └──cancel──▶ CANCELLED
              └──hold─────▶ HELD ──resume──▶ SUBMITTED
```

**주문 가격 스냅샷 컬럼** (`OrderItem`): `unitPrice`, `basePriceAtOrder`, `discountRateAtOrder`, `fixedPriceAppliedAtOrder`, `lineTotal` — 발주 확정 후 가격 변동돼도 불변.
**배송지 스냅샷** (`Order`): `shipToAddressId`, `shipToLabel`, `shipToRecipient`, `shipToPhone`, `shipToPostalCode`, `shipToAddress`, `shipToAddressDetail`, `shipToMemo`.
**주문번호 채번**: `ORD-YYYYMMDD-NNN` — Postgres advisory lock (당일 키). SUBMIT 또는 `createClientOrder` 시점.

---

## 5. 출고 (`/api/shipments`)

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/shipments?q=&from=&to=` | OWNER, ADMIN, QC | `listShipmentsForBoard` / `listShipmentHistory` |
| POST | `/api/shipments/[id]/transition` | OWNER, ADMIN, QC | `startShipment` / `moveShipmentStage` / `holdShipment` / `resumeShipment` |

**Shipment 흐름**: Order(CONFIRMED) → `startShipment` (첫 KanbanColumn 진입) → 단계 이동 (`moveShipmentStage`, 정·역방향) → terminal 컬럼 진입 시 자동 SHIP (라인별 `physicalStock` 차감 + `InventoryLog.SHIP` + Order.status=COMPLETED).
**Hold/Resume**: 단계 어디서나. `holdReason` 기록.

### 5-1. 칸반 단계 컬럼 (`/api/shipments/columns`)

`[id]` = KanbanColumn cuid. prototype 의 mock stage id 를 DB cuid 로 매핑하기 위해 `GET` 을 `window.KANBAN_DB_COLUMNS` 로 노출.

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/shipments/columns` | OWNER, ADMIN, QC | `listKanbanColumns` (sortOrder asc) |
| POST | `/api/shipments/columns` | OWNER, ADMIN | `createKanbanColumn` — `{ key, label, sortOrder, isTerminal?, color? }`. **201** |
| PATCH | `/api/shipments/columns/[id]` | OWNER, ADMIN | `updateKanbanColumn` — `{ label?, sortOrder?, isTerminal?, color? }` |
| DELETE | `/api/shipments/columns/[id]` | OWNER, ADMIN | `deleteKanbanColumn` — **연결된 Shipment 있으면 거부** |

### 5-2. 단계별 담당자 (`/api/shipments/[id]/assignees`)

`[id]` = **shipmentId** (Order 아님). stage 별 M:N 배정. 응답은 `{ ok, data }` 래핑.

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/shipments/[id]/assignees` | OWNER, ADMIN, QC | `listShipmentAssignees` |
| POST | `/api/shipments/[id]/assignees` | OWNER, ADMIN, QC | `assignToShipment` — body `{ stage, userId }` |
| DELETE | `/api/shipments/[id]/assignees/[assigneeId]` | OWNER, ADMIN, QC | `removeAssignee` |

---

## 6. 거래명세서 (`/api/invoices`)

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/invoices?status=&clientId=` | OWNER, ADMIN | `listInvoices` |
| POST | `/api/invoices` | OWNER, ADMIN | `createInvoiceFromOrder` (COMPLETED 주문 → DRAFT 명세서) |
| GET | `/api/invoices/[id]` | OWNER, ADMIN | `getInvoice` |
| PATCH | `/api/invoices/[id]` | OWNER, ADMIN | `updateInvoiceDraft` (DRAFT만) |
| POST | `/api/invoices/[id]/issue` | OWNER, ADMIN | `issueInvoice` — `INV-YYYYMMDD-NNN` 채번 + DRAFT→ISSUED |
| POST | `/api/invoices/[id]/send` | OWNER, ADMIN | `markInvoiceSent` — ISSUED→SENT + `sentAt` |
| POST | `/api/invoices/[id]/cancel` | OWNER, ADMIN | `cancelInvoice` — 사유 기록 |

**Invoice 상태**: `DRAFT → ISSUED → SENT` · `CANCELLED` (어디서나).
**VAT 계산**: `calcVatTotal(supply, rate)` — `tenant_setting.vat_rate` 사용 (기본 0.1).
**PDF 출력 (포털 페이지)**: `/admin/invoices/[id]/pdf` · `/client/invoices/[id]/pdf` (`@react-pdf/renderer`).

---

## 7. 수금 / 은행거래 / 원장 (`/api/payments`, `/api/ledger`)

### 7-1. Payment
| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/payments?clientId=&status=` | OWNER, ADMIN | `listPayments` |
| POST | `/api/payments` | OWNER, ADMIN | `recordPayment` |
| DELETE | `/api/payments/[id]` | OWNER, ADMIN | `cancelPayment` (소프트: status=PENDING + `[취소]` note) |

**Payment 상태**: `PENDING | PARTIAL | PAID | OVERDUE`. ClosingLedger 집계는 PARTIAL/PAID 만.

### 7-2. BankTransaction (server action only — REST 미노출)
`listBankTxns` / `createBankTxn` / `updateBankTxn` / `deleteBankTxn` / `matchBankTxn` (Payment.bankTxnId 세팅) / `unmatchBankTxn`.

### 7-3. ClosingLedger
| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/ledger?month=YYYY-MM&clientId=` | OWNER, ADMIN | `listLedgers` |
| POST | `/api/ledger` | OWNER, ADMIN | `recomputeLedger` / `recomputeLedgerMonth` / `closeMonth` / `reopenMonth` (body.action 분기) |

**원장 공식** (per 거래처 × 월):
```
carryOver    = 전월 balance
monthlySales = 당월 ISSUED+SENT Invoice.totalAmount 합
received     = 당월 PARTIAL+PAID Payment.amount 합
balance      = carryOver + monthlySales - received
```
마감 후에는 `recompute` 거부.

---

## 8. 공지 (`/api/notices`)

| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/notices?target=&pinned=` | OWNER, ADMIN, EXEC, QC, SUPER_ADMIN | `listNotices` |
| POST | `/api/notices` | 인증 (`requireAuth`) | `createNotice` — 발송자 팀 분기 |
| DELETE | `/api/notices/[id]` | 인증 (작성자만) | `deleteNotice` |

**Notice.target**: `ALL | DEALER | HOSPITAL | SPECIFIC`. SPECIFIC 은 `NoticeRecipient[]` 로 거래처 매핑.
**우선순위**: `pinned` true > `priority=HIGH` > 최신순.

---

## 9. UDI 공급내역 보고 (`/api/udi`)

| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/udi?month=` | OWNER, ADMIN, EXEC, QC | `listUdiReports` / `getUdiMonthPreview` |
| POST | `/api/udi` | OWNER, ADMIN | `createUdiReportFromInvoices` (월 단위) |
| GET | `/api/udi/[id]` | OWNER, ADMIN, EXEC, QC | `getUdiReport` |
| DELETE | `/api/udi/[id]` | OWNER, ADMIN | `deleteUdiReport` |
| POST | `/api/udi/[id]/submit` | OWNER, ADMIN | `submitUdiReport` (제출 + `receiptNo` 채번) |

**UDI-DI 14자리** — `product.udiCode` 필수. 미등록 제품은 보고서 생성 시 가드 에러.

---

## 10. 테넌트 설정 (`/api/settings`)

| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/settings` | 인증 | `listSettings` |
| PATCH | `/api/settings` | OWNER, ADMIN | `updateSetting` (단일) / `bulkUpdateSettings` |

**알려진 키 5개**: `business_hour_start`, `business_hour_end` (HH:MM 24h) · `shipping_cutoff` (HH:MM) · `reorder_multiplier` (양수 소수) · `vat_rate` (0~1).
검증: 업무시간 `start < end` (DB 값과 결합).

---

## 11. 학회 / 매뉴얼 / 조달 / 영업이력 / 유통기한

### 11-1. 학회 (`/api/conferences`)
| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/conferences?q=&upcoming=&from=&to=` | OWNER, ADMIN, EXEC | `listConferences` (visitors 포함) |
| POST | `/api/conferences` | OWNER, ADMIN, EXEC | `createConference` |
| GET | `/api/conferences/[id]` | OWNER, ADMIN, EXEC | `getConference` (visitors desc) |
| PATCH | `/api/conferences/[id]` | OWNER, ADMIN, EXEC | `updateConference` |
| DELETE | `/api/conferences/[id]` | OWNER, ADMIN, EXEC | `deleteConference` (**CASCADE** visitors) |

#### 방문자 방명록 (`/api/conferences/[id]/visitors`)
| Method | Path | 권한 | 액션 |
|---|---|---|---|
| POST | `/api/conferences/[id]/visitors` | OWNER, ADMIN, EXEC | `createVisitor` (`conferenceId` 경로 주입). **201** |
| PATCH | `/api/conferences/[id]/visitors/[visitorId]` | OWNER, ADMIN, EXEC | `updateVisitor` |
| DELETE | `/api/conferences/[id]/visitors/[visitorId]` | OWNER, ADMIN, EXEC | `deleteVisitor` |

**ConferenceVisitor.contactStatus**: `NEW | CONTACTING | DEAL | LOST` (성공률 = DEAL 비율).

### 11-2. 기타 read-only / 집계
| Method | Path | 권한 | 액션 / 비고 |
|---|---|---|---|
| GET | `/api/manuals` | 인증 | 매뉴얼 목록 (read-only) |
| GET | `/api/procurement` | 인증 | 조달 현황 (read-only) |
| GET | `/api/sales-history?repId=&from=&to=` | 인증 (EXEC 본인만 / OWNER·ADMIN 대리) | `computeSalesHistory` — 주문/명세서/수금/방문자 4종 이벤트 통합 |
| GET | `/api/expiry?stage=&q=` | OWNER, ADMIN, QC | `listExpiryLots` |
| POST | `/api/expiry` | OWNER, ADMIN, QC | `createExpiryLot` |
| PATCH | `/api/expiry/[id]` | OWNER, ADMIN, QC | `updateExpiryLot` |
| DELETE | `/api/expiry/[id]` | OWNER, ADMIN, QC | `deleteExpiryLot` |

**ExpiryLot 4단계** (`classifyExpiry`): `EXPIRED (<0일) | URGENT (≤30일) | SOON (≤90일) | SAFE (>90일)`.

---

## 12. 재고 조정 (`/api/inventory/adjustment`)

prototype qc-portal.html 의 **입고 등록 / 재고조정 / 샘플 출고** 가 모두 호출하는 통합 endpoint.

| Method | Path | 권한 | 분기 |
|---|---|---|---|
| POST | `/api/inventory/adjustment` | OWNER, ADMIN, QC | `type==="RECEIVE"` → `receiveStock`, 그 외 → `createAdjustment` |

**Body 공통**:
```json
{
  "type": "RECEIVE" | "반품" | "폐기" | "실사조정" | "입고보정" | "샘플출고",
  "productSizeId": "cuid",
  "qty": 10,            // 부호는 type 별 validator 가 검증 (폐기·샘플출고는 음수)
  "note": "비고",
  "approvedBy": "이름"  // 조정 분기에서만 사용
}
```

- **RECEIVE** → `physicalStock += qty` + `availableStock += qty` + `InventoryLog.RECEIVE`.
- **조정 5종** → `InventoryAdjustment` (반품/폐기/실사조정/입고보정/샘플출고). 반품 처리는 별도 테이블 없이 `reason='반품'` 으로 통합.

응답: `200 { ok: true, ... }` | `400 { ok: false, error, fieldErrors? }`.

---

## 13. 데이터 사용량 (`/api/data-usage`)

거래처별 월간 사용량/판매액 입력 (영업·경영지원).

| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/data-usage?month=YYYY-MM&category=&limit=` | OWNER, ADMIN | `listDataUsage` |
| POST | `/api/data-usage` | OWNER, ADMIN | `createDataUsage` — `(month+category)` 중복 시 실패. **201** |
| POST | `/api/data-usage?upsert=1` | OWNER, ADMIN | `upsertDataUsage` — 동일 키 존재 시 덮어쓰기 |
| PATCH | `/api/data-usage/[id]` | OWNER, ADMIN | `updateDataUsage` |
| DELETE | `/api/data-usage/[id]` | OWNER, ADMIN | `deleteDataUsage` |

**Body**: `{ month: "YYYY-MM", category, amount, note? }`. 전월 대비 증감(`computeMoMDelta`) UI 표기.

---

## 14. 데이터 탐색기 (`/api/data-explorer`)

41K+ 매입매출 거래원장 (`TransactionLedger`) 의 범용 CRUD + bulk + 업/다운로드.

| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/data-explorer?limit=&q=&kind=&clientCode=&from=&to=` | OWNER, ADMIN, EXEC, QC | `listTransactions` |
| POST | `/api/data-explorer` | OWNER, ADMIN | `bulkInsertTransactions` (단건도 OK) |
| GET | `/api/data-explorer/[id]` | OWNER, ADMIN, EXEC, QC | `getTransaction` |
| PATCH | `/api/data-explorer/[id]` | OWNER, ADMIN | `updateTransaction` |
| DELETE | `/api/data-explorer/[id]` | OWNER, ADMIN | `deleteTransaction` |
| POST | `/api/data-explorer/bulk` | OWNER, ADMIN | `bulkInsertTransactions` |
| PATCH | `/api/data-explorer/bulk` | OWNER, ADMIN | `bulkUpdateTransactions` |
| DELETE | `/api/data-explorer/bulk?importSource=` | OWNER, ADMIN | `deleteTransactionsByImportSource` |
| POST | `/api/data-explorer/upload` | OWNER, ADMIN | XLSX/CSV 업로드 → bulk insert |
| GET | `/api/data-explorer/download?format=csv|xlsx` | OWNER, ADMIN, EXEC, QC | 필터 기준 다운로드 |

---

## 15. 대시보드 위젯 (`/api/dashboard/*`)

두 종류가 공존한다:
- **(A) 프리셋 위젯** — prototype GridStack 레이아웃. `config` 에 좌표/제목만. 사용자별 소유.
- **(B) WidgetSpec 위젯** — LLM(windyflo) 이 생성하는 JSON spec. `config.spec` 에 full spec 보존, 렌더 시 실시간 query.

> **공통 권한**: 역할 게이트 없음. 로그인 사용자가 **자기 소유(`userId == session.user.id`) 행만** CRUD. 단, **(B) 의 데이터 결과는 spec.permissions / rowLevel 규칙으로 추가 제한** (예: `ownClientOnly` → CLIENT 는 본인 거래처만).

### 15-1. (A) 프리셋 위젯 CRUD

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/dashboard/widgets` | 내 위젯 목록 (position asc) |
| POST | `/api/dashboard/widgets` | 위젯 추가 — `{ preset, position?, width?, height?, overrideDateRange?, config? }`. **201** |
| PATCH | `/api/dashboard/widgets/[id]` | 단건 갱신 (소유권 검증, 부분 패치) |
| DELETE | `/api/dashboard/widgets/[id]` | 단건 삭제 (소유권 검증) |
| POST | `/api/dashboard/widgets/bulk` | **전체 교체** (deleteMany + 재삽입, 단일 tx). body `{ items: [...] }` (≤50). GridStack onChange debounce 후 호출 |
| POST | `/api/dashboard/widgets/reset` | 내 위젯 전체 삭제 → `{ ok, deleted }` |

### 15-2. (B) WidgetSpec — LLM-native 위젯

windyflo(외부 LLM) 가 자연어 요청을 WidgetSpec JSON 으로 변환해 위젯을 생성한다. **아래 3개가 windyflo agent 의 도구(tool)로 등록**된다.

#### 도구 ① 데이터 카탈로그
| Method | Path | 권한 | 설명 |
|---|---|---|---|
| GET | `/api/dashboard/data-catalog` | 인증 | "어떤 source·field·집계가 가능한가" — 12 source × 필드/타입/agg/note + operators/aggregates/templateVars/kinds |

#### 도구 ② 위젯 스키마
| Method | Path | 권한 | 설명 |
|---|---|---|---|
| GET | `/api/dashboard/widget-schema` | 인증 | WidgetSpec JSON 형식 가이드 + 검증된 prefab 10종(few-shot examples) + tips |

#### 도구 ③ 위젯 저장
| Method | Path | 권한 | 설명 |
|---|---|---|---|
| POST | `/api/dashboard/widgets/spec` | 인증 | spec 검증 → dry-run 실행 → 저장 (`preset='spec:custom'`). **201** |

**`/api/dashboard/widgets/spec` 처리 순서**:
1. `validateWidgetSpec` (Zod) — 실패 시 **400 + 교정 힌트** `{ validationErrors: [{ path, message, hint }] }`
2. **dry-run** — `executeWidgetSpec` 실제 실행해 query 가능 여부 확인 (잘못된 source/field/filter 여기서 차단)
3. `body.dryRunOnly===true` → 저장 없이 `{ ok, dryRun, spec, preview }` 반환 (미리보기)
4. 저장 → `{ ok, id, spec, preview }` (201)

**WidgetSpec 핵심 구조**:
```jsonc
{
  "version": "1.0",
  "title": "이번 달 매출",
  "kind": "kpi",              // kpi|bar|hbar|line|pie|donut|table|gauge
  "layout": { "w": 3, "h": 2 },
  "data": {
    "source": "invoice",     // 12 whitelist source (read-only)
    "filter": { "status": { "in": ["ISSUED","SENT"] },
                "issueDate": { "gte": "{{now.startOfMonth}}" } },
    "aggregate": { "type": "sum", "field": "totalAmount" },
    "groupBy": null,         // KPI=null, bar/pie=['status'] 등
    "orderBy": [{ "field": "totalAmount", "dir": "desc" }],
    "limit": 10
  },
  "comparison": { "type": "previousPeriod", "format": "delta-percent" },
  "format": { "value": { "type": "currency", "compact": true } },
  "style": { "color": "#00A8B5", "thresholds": [...] },
  "permissions": { "roles": ["TENANT_OWNER"], "rowLevel": "none" }
}
```
- **source(12)**: invoice/order/payment/ledger/client/product/productSize/transaction/shipment/conference/expiry/dataUsage
- **operator(11)**: eq/ne/gt/gte/lt/lte/in/notIn/contains/startsWith/between
- **aggregate(6)**: sum/count/avg/min/max/countDistinct
- **템플릿 변수**: `{{now}}`, `{{now.startOfMonth}}`, `{{now.minus(30,'day')}}`, `{{thisMonth}}` 등 — 런타임 치환.

#### 렌더용 실시간 데이터
| Method | Path | 권한 | 설명 |
|---|---|---|---|
| GET | `/api/dashboard/widgets/[id]/data` | 인증 (소유권) | `config.spec` → `executeWidgetSpec` → `{ ok, kind, title, format, style, comparison, action, result }`. spec 없는 (A) 위젯은 `404 "not a spec widget"` |

**`result` 형태** (kind 별): KPI → `{ kind:'kpi', value, comparison? }` · 차트 → `{ kind, series:[{label,value}] }` · 테이블 → `{ kind:'table', rows:[...] }`.

**실시간 갱신** (`widget-dashboard.js`): Tier 1(새로고침) + **Tier 2(60초 폴링, 페이지 visible 시)** + **Tier 3(액션 후 `window.refreshDashboardWidgets()`)**.

---

## 16. CLIENT 포털 전용 (`/api/client-portal/*`)

CLIENT 역할 + `clientId` 필수. row-level 필터로 본인 거래처 데이터만 노출.

### 16-1. 부트스트랩 (`GET /api/client-portal/bootstrap`)

단일 호출로 prototype client-portal.html 의 `window.*` 변수를 한 번에 채움 (개별 도메인 API 13개가 server action `requireRole` 로 307→/403 되는 문제 회피).

```jsonc
{
  "ok": true,
  "user":     { "id": "...", "email": "...", "clientId": "..." },
  "client":   { /* Client + addresses + discounts + fixedPrices */ },
  "products": [ /* 활성 Product[] (sizes 포함) */ ],
  "orders":   [ /* 본인 Order[] (DRAFT 제외, items + shipment, take=200) */ ],
  "invoices": [ /* 본인 Invoice[] (DRAFT 제외, items, take=100) */ ],
  "payments": [ /* 본인 Payment[] (PARTIAL/PAID/OVERDUE, take=100) */ ],
  "ledgers":  [ /* 본인 ClosingLedger[] (24개월) */ ],
  "notices":  [ /* 본인 대상 Notice[] (ALL/DEALER/HOSPITAL/SPECIFIC + 만료필터) */ ]
}
```

### 16-2. 발주 등록 (`POST /api/client-portal/orders`)

CLIENT 본인 → `SUBMITTED` Order 즉시 생성 (DRAFT 생략).

**요청 body**:
```jsonc
{
  "items": [ { "productId": "cuid", "productSizeId": "cuid", "qty": 2 } ],
  "shipTo": {
    "addressId": "cuid|null", "label": "본사|null", "recipient": "홍길동|null",
    "phone": "010-...|null", "postalCode": "06234|null",
    "address": "서울특별시 ... (필수)", "addressDetail": "5층|null", "memo": "|null"
  },
  "shippingMethod": "택배 | 방문수령 | 퀵",
  "notes": "메모"
}
```

**검증 흐름**: 세션 role=CLIENT+clientId → items≥1·qty>0·address 필수 → Product/Size active → `calculatePriceSnapshot()` → advisory lock `ORD-YYYYMMDD-NNN` 채번 → Order+OrderItem+배송지 스냅샷 → `revalidatePath` + `logAudit("CLIENT_ORDER_CREATE")`.

**응답 (201)**: `{ ok: true, order: { ...items[] } }` · **에러 (400)**: `{ ok: false, error: "주문할 제품을 1개 이상 선택해주세요." }`.

---

## 17. 표준 에러 포맷

성공: 데이터 직접 또는 `{ ok: true, ...payload }`.
실패: `{ ok: false, error: "한글 메시지", fieldErrors?: { field: "..." } }`.

| HTTP | 의미 |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | 검증 실패 / 비즈니스 규칙 위반 |
| 401 | 세션 없음 — 미들웨어가 차단하면 307 → `/login` |
| 403 | 역할 부족 — 미들웨어가 차단하면 307 → `/403`. server action `requireRole` 실패도 307 → `/403` |
| 404 | 리소스 없음 |
| 409 | 충돌 (예: unique 위배) |
| 500 | 서버 오류 |

⚠️ **server action 안의 `requireRole` 거부는 Next.js 가 `NEXT_REDIRECT` 를 throw 하여 RSC 307 응답으로 변환됨** — fetch 클라이언트는 `r.ok` 만 보면 데이터를 null 로 받고 조용히 실패한다. **content-type 이 `application/json` 인지 확인**할 것 (CLIENT 부트스트랩이 단일 endpoint 로 묶인 이유).

---

## 18. 직원 관리 (`/api/users`, `/api/me/password`)

직원 계정의 조회·생성·수정·비활성화·재활성화·비밀번호 관리와 팀 관리자 지정을 담당하는 9개 endpoint.

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/users?role=&active=&q=` | effectiveTeamAdmin | `listUsers` — tenantId 강제, 비메타는 자기 팀 role 만 |
| POST | `/api/users` | effectiveTeamAdmin (canGrantRole) | `createUser` — 임시 비번 bcrypt 저장. **201** |
| GET | `/api/users/[id]` | effectiveTeamAdmin | `getUser` — 타테넌트·타팀(비메타) 차단 |
| PATCH | `/api/users/[id]` | effectiveTeamAdmin | `updateUser` — `{ name?, phone?, role? }` (`active` 미포함) |
| DELETE | `/api/users/[id]` | effectiveTeamAdmin | `deactivateUser` (soft: `active=false`) — 본인/마지막 owner 차단 · EXEC 는 경고 반환 |
| POST | `/api/users/[id]/password` | effectiveTeamAdmin | `resetUserPassword` — body `{ tempPassword }`, 본인 대상 차단 |
| POST | `/api/users/[id]/reactivate` | effectiveTeamAdmin | `reactivateUser` — 비활성 → 활성 전환 |
| POST | `/api/users/[id]/team-admin` | **metaAdmin** | `toggleTeamAdmin` — body `{ grant: true|false }` |
| POST | `/api/me/password` | 본인 (인증) | `changeMyPassword` — body `{ current, next }` |

### 18-1. 권한 모델

```
isMetaAdmin        = role === "ADMIN" || role === "TENANT_OWNER"
isEffectiveTeamAdmin = isTeamAdmin === true || isMetaAdmin
canGrantRole(actor, targetRole):
  - targetRole 이 STAFF_ROLES 밖 (CLIENT/SUPER_ADMIN/VIEWER) → false
  - actor.role === "TENANT_OWNER" (임원진) → 전체 staff role 허용
  - 그 외 effectiveTeamAdmin → 자기 팀 role 만 허용
```

**role → team 매핑** (DB 컬럼 없음, 앱-레벨 상수):

| role | team | 팀 이름 |
|---|---|---|
| TENANT_OWNER | executive | 임원진 |
| ADMIN | finance | 경영지원 |
| QC | quality | 품질관리 |
| EXEC | sales | 영업 |
| CLIENT / SUPER_ADMIN / VIEWER | — | 직원관리 대상 아님 |

**STAFF_ROLES** = `[TENANT_OWNER, ADMIN, QC, EXEC]` — 목록·생성·수정 모두 이 범위만.

### 18-2. 주요 가드

- **본인 대상 차단**: `updateUser`, `deactivateUser`, `resetUserPassword`, `toggleTeamAdmin` 모두 `id === me.id` 이면 `400`. 본인 비밀번호는 `/api/me/password` 에서만.
- **마지막 TENANT_OWNER 비활성화 차단**: 활성 owner 가 1명뿐이면 `deactivateUser` 거부 (`400`).
- **EXEC 비활성화 경고**: 직접담당(`Client.salesRepId`) + 복수배정(`SalesAssignment{active:true}`) 합산 > 0 이면 응답에 `{ warning, affectedCount }` 포함 (차단 아님, 비활성화는 진행됨).
- **tenantId 스코핑**: 모든 조회/변경은 `where.tenantId = me.tenantId` 강제. 타테넌트 접근 시 `404`.
- **비밀번호 평문 미노출**: `SAFE_SELECT` 에 `password` 제외. 응답 어디에도 해시 미포함.

### 18-3. User.isTeamAdmin 플래그

`User.isTeamAdmin boolean` — `/api/me` 세션 페이로드에 `isTeamAdmin` 필드 포함. 프로토타입 사이드바 "직원 관리" 메뉴 게이트 조건: `isTeamAdmin === true || isMetaAdmin(me)`. 팀 관리자 지정/해제는 metaAdmin 만 (`/api/users/[id]/team-admin`).

### 18-4. 부서·직급 옵션 (`/api/org-options`)

테넌트별 드롭다운 목록(부서명 · 직급명)을 관리하는 3개 endpoint. `User.department` / `User.jobTitle` 은 OrgOption 의 **라벨 스냅샷**을 저장하므로, 옵션을 soft-delete 해도 기존 직원 레코드의 값은 변하지 않는다.

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/org-options?kind=DEPARTMENT\|JOB_TITLE` | effectiveTeamAdmin | `listOrgOptions` — tenantId 강제, active=true, sortOrder asc |
| POST | `/api/org-options` | metaAdmin | `createOrgOption` — body `{ kind, label }`, 중복 가드 (같은 tenantId+kind+label 활성 옵션 이미 존재 시 409 / 비활성 옵션은 `active:true` 로 되살림) |
| DELETE | `/api/org-options/[id]` | metaAdmin | `deactivateOrgOption` — soft: `active=false` (라벨 스냅샷 불변 보장) |

**스냅샷 정책**: 직원 생성·수정 시 선택한 옵션의 `label` 문자열을 `User.department` / `User.jobTitle` 에 직접 저장. 이후 옵션이 삭제(비활성)되거나 라벨이 변경돼도 기존 직원 데이터는 영향 없음.

**kind 값**: `DEPARTMENT` (부서) · `JOB_TITLE` (직급) — Prisma enum `OrgOptionKind`.

---

## 19. 호출 흐름 예시

### 18-1. CLIENT 발주 등록 (브라우저)
```
/client → 미들웨어 307 → /portals/client-portal.html
  ├─ data-loader.js: GET /api/me → role=CLIENT
  ├─ data-loader.js: GET /api/client-portal/bootstrap (단일 호출)
  └─ submitOrder() → POST /api/client-portal/orders
      ├─ createClientOrder(): pricing 스냅샷 + advisory lock + Order/OrderItem insert
      └─ 201 → ORDERS.unshift(newOrder) → 발주내역 갱신
```

### 18-2. ADMIN 주문 확정 + 출고
```
GET  /api/orders?status=SUBMITTED
POST /api/orders/[id]/transition   { action: "CONFIRM" }    # CONFIRMED + RESERVE
POST /api/shipments/[id]/transition { action: "start" }
POST /api/shipments/[id]/transition { action: "move", to }  # terminal → 자동 SHIP + COMPLETED
POST /api/invoices                 { orderId }              # DRAFT 명세서
POST /api/invoices/[id]/issue                               # INV 채번
POST /api/invoices/[id]/send
POST /api/payments                 { invoiceId, amount }
POST /api/ledger                   { action: "recompute", month, clientId }
```

### 18-3. windyflo(LLM) 위젯 생성
```
사용자: "이번 달 거래처별 매출 막대그래프 만들어줘"
  ├─ windyflo tool: GET /api/dashboard/data-catalog   # source/field 확인
  ├─ windyflo tool: GET /api/dashboard/widget-schema  # 형식 + examples
  ├─ LLM 이 WidgetSpec JSON 작성
  └─ windyflo tool: POST /api/dashboard/widgets/spec
       ├─ validateWidgetSpec (실패 시 hint 받아 LLM 재시도)
       ├─ dry-run executeWidgetSpec (preview)
       └─ 201 저장 → 대시보드 GET /api/dashboard/widgets/[id]/data 로 실시간 렌더
```

---

## 20. 미정의 / 추후 보강

- **세금계산서 (TaxInvoice)** — 신규 도메인. 국세청 e-Tax 연동 vs DB-only 결정 대기 (#143).
- **이메일 발송** — Nodemailer + Daum SMTP. `.env` `SMTP_USER`/`SMTP_PASS` 필요 (#144).
- **WidgetSpec source 확장** — `salesContract` 미포함 (계약 위젯은 conference 로 근사). 추가 검토.
- **OAuth/SSO** — 현재 Credentials 만. 후속 Phase.
- **OpenAPI 스펙** — 본 문서가 단일 소스 (수기). OpenAPI 3 자동 생성 도입은 별도 작업.
- **Rate Limit** — 미적용. Azure Front Door / WAF 로 운영 단계 부착 예정.

---

**문서 갱신 규칙**: 새 endpoint 추가 또는 RBAC 변경 시 본 파일도 같은 커밋에서 갱신.
**참고**: `CLAUDE.md` (도메인 규칙) · `src/lib/rbac.ts` (RBAC 매트릭스) · `src/lib/session.ts` (세션 헬퍼) · `src/lib/widget-spec/` (WidgetSpec schema/execute/presets).
