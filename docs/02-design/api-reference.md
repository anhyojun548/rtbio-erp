# RTBIO ERP — API 레퍼런스

**상태**: 통합 정리 (2026-05-26 기준)
**범위**: `src/app/api/*` 전체 39개 route 파일 + 호출 server action RBAC 매트릭스
**대상 독자**: 백엔드 통합 개발자, 프론트 포털 작업자, AI 에이전트

---

## 0. 표기 규약

- **경로 패러미터** — `[id]`, `[orderId]` 등 대괄호.
- **권한 표기** — `OWNER / ADMIN / EXEC / QC / CLIENT / SUPER_ADMIN`. 콤마는 OR (해당 역할 중 하나라도 부여되면 통과).
- **응답 상태** — 명시 없으면 `200 OK` (성공) · `400 Bad Request` (검증 실패) · `401 Unauthorized` (세션 없음) · `403 Forbidden` (역할 부족) · `404 Not Found`.
- **단가/금액 필드는 Decimal** — JSON 직렬화 시 string 으로 전달됨 (예: `"34069.00"`). 클라이언트에서 `Number()` 변환 권장.
- **날짜는 ISO 8601** — `2026-05-26T05:28:15.278Z` 형식.

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
| PATCH | `/api/clients/[id]` | OWNER, ADMIN | `updateClient` |
| DELETE | `/api/clients/[id]` | OWNER, ADMIN | `toggleClientActive` (soft delete — `active=false`) |

**Client 모델 주요 필드**: `id, code(unique), name, type(HOSPITAL|AGENCY|OTHER), businessNumber, representative, phone, email, address, postalCode, paymentTerms, salesRepId, active, createdAt, updatedAt`.

**관련 서브 리소스** (server action 만 — REST 미노출):
- `ClientAddress` — `listAddresses(clientId)`, `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`
- `ClientDiscount`, `ClientFixedPrice` — `upsertClientDiscount`, `upsertClientFixedPrice`, `deleteClientDiscount`, `deleteClientFixedPrice`

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
| GET | `/api/orders?q=&status=&from=&to=` | OWNER, ADMIN, QC | `listOrders` |
| POST | `/api/orders` | OWNER, ADMIN, QC | `createOrder` (DRAFT 생성) |
| GET | `/api/orders/[id]` | OWNER, ADMIN, QC | `getOrder` |
| PATCH | `/api/orders/[id]` | OWNER, ADMIN, QC | `updateOrder` / `addOrderItem` / `updateOrderItem` / `deleteOrderItem` |
| POST | `/api/orders/[id]/transition` | OWNER, ADMIN, QC | 상태 전이 (`SUBMIT` / `REJECT` / `HOLD` / `RESUME` / `CONFIRM` / `CANCEL`) |

**상태 머신**:
```
DRAFT ──submit──▶ SUBMITTED ──confirm──▶ CONFIRMED ──ship start──▶ SHIPPING ──ship complete──▶ COMPLETED
              │              │                                 │
              └──reject──▶ REJECTED       └──cancel──▶ CANCELLED
              └──hold─────▶ HELD ──resume──▶ SUBMITTED
```

**주문 가격 스냅샷 컬럼** (`OrderItem`): `unitPrice`, `basePriceAtOrder`, `discountRateAtOrder`, `fixedPriceAppliedAtOrder`, `lineTotal` — 발주 확정 후 가격 변동되어도 불변.
**배송지 스냅샷** (`Order`): `shipToAddressId`, `shipToLabel`, `shipToRecipient`, `shipToPhone`, `shipToPostalCode`, `shipToAddress`, `shipToAddressDetail`, `shipToMemo`.

**주문번호 채번**: `ORD-YYYYMMDD-NNN` — Postgres advisory lock (당일 키) 으로 동시성 직렬화. SUBMIT 시점 또는 `createClientOrder` 시점에 채번.

---

## 5. 출고 (`/api/shipments`)

| Method | Path | 권한 | 호출 액션 |
|---|---|---|---|
| GET | `/api/shipments` | OWNER, ADMIN, QC | `listShipmentsForBoard` / `listShipmentHistory` (q/from/to) |
| POST | `/api/shipments/[id]/transition` | OWNER, ADMIN, QC | `startShipment` / `moveShipmentStage` / `holdShipment` / `resumeShipment` |

**Shipment 흐름**: Order(CONFIRMED) → `startShipment` (첫 KanbanColumn 진입, RESERVE 재고) → 단계 이동 (`moveShipmentStage`) → terminal 컬럼 진입 시 자동 SHIP (라인별 `physicalStock` 차감 + `InventoryLog.SHIP` + Order.status=COMPLETED).
**Hold/Resume**: 단계 어디에서나 가능. `holdReason` 기록.

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
**PDF 출력 (포털 페이지)**: `/admin/invoices/[id]/pdf` (`@react-pdf/renderer`).

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
- `listBankTxns` / `createBankTxn` / `updateBankTxn` / `deleteBankTxn` / `matchBankTxn` (Payment.bankTxnId 세팅) / `unmatchBankTxn`.

### 7-3. ClosingLedger
| Method | Path | 권한 | 액션 |
|---|---|---|---|
| GET | `/api/ledger?month=YYYY-MM&clientId=` | OWNER, ADMIN | `listLedgers` |
| POST | `/api/ledger` | OWNER, ADMIN | `recomputeLedger` / `recomputeLedgerMonth` / `closeMonth` / `reopenMonth` (body.action 으로 분기) |

**원장 공식** (per 거래처 × 월):
```
carryOver        = 전월 balance
monthlySales     = 당월 ISSUED+SENT Invoice.totalAmount 합
received         = 당월 PARTIAL+PAID Payment.amount 합
balance          = carryOver + monthlySales - received
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

**알려진 키 5개**:
- `business_hour_start`, `business_hour_end` — HH:MM 24h
- `shipping_cutoff` — HH:MM 택배 마감
- `reorder_multiplier` — 양수 소수
- `vat_rate` — 0~1 ratio

검증: 업무시간 `start < end` 비즈니스 규칙 (DB 값과 결합).

---

## 11. 학회 / 매뉴얼 / 조달 / 영업이력 / 유통기한

| Method | Path | 권한 | 액션 / 비고 |
|---|---|---|---|
| GET | `/api/conferences?q=&upcoming=` | OWNER, ADMIN, EXEC | `listConferences` (visitors 포함) |
| POST | `/api/conferences` | OWNER, ADMIN, EXEC | `createConference` |
| GET/PATCH/DELETE | `/api/conferences/[id]` | OWNER, ADMIN, EXEC | `getConference` / `updateConference` / `deleteConference` (CASCADE visitors) |
| GET | `/api/manuals` | 인증 | (read-only) |
| GET | `/api/procurement` | 인증 | (read-only) |
| GET | `/api/sales-history?repId=&from=&to=` | 인증 (EXEC 본인만 / OWNER·ADMIN 대리) | `computeSalesHistory` — 주문/명세서/수금/방문자 4종 이벤트 통합 |
| GET | `/api/expiry?stage=&q=` | OWNER, ADMIN, QC | `listExpiryLots` |
| POST | `/api/expiry` | OWNER, ADMIN, QC | `createExpiryLot` |
| PATCH | `/api/expiry/[id]` | OWNER, ADMIN, QC | `updateExpiryLot` |
| DELETE | `/api/expiry/[id]` | OWNER, ADMIN, QC | `deleteExpiryLot` |

**ExpiryLot 4단계 분류** (`classifyExpiry`): `EXPIRED (<0일) | URGENT (≤30일) | SOON (≤90일) | SAFE (>90일)`.

---

## 12. 데이터 탐색기 (`/api/data-explorer`)

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

## 13. 칸반 단계 관리 (server action only — REST 미노출)

`listKanbanColumnsWithUsage` / `createKanbanColumn` / `updateKanbanColumn` / `deleteKanbanColumn` (사용 중인 컬럼 가드) / `reorderKanbanColumns`.
포털 페이지 `/admin/shipments/columns` 에서 사용.

---

## 14. CLIENT 포털 전용 (`/api/client-portal/*`)

CLIENT 역할 + `clientId` 필수. row-level 필터로 본인 거래처 데이터만 노출.

### 14-1. 부트스트랩 (`GET /api/client-portal/bootstrap`)

단일 호출로 prototype client-portal.html 의 `window.*` 변수를 한 번에 채움.

**응답 페이로드**:
```json
{
  "ok": true,
  "user":     { "id": "...", "email": "...", "clientId": "..." },
  "client":   { /* Client + addresses + discounts + fixedPrices */ },
  "products": [ /* 활성 Product[] (sizes 포함) */ ],
  "orders":   [ /* 본인 Order[] (DRAFT 제외, items + shipment 포함, take=200) */ ],
  "invoices": [ /* 본인 Invoice[] (DRAFT 제외, items 포함, take=100) */ ],
  "payments": [ /* 본인 Payment[] (PARTIAL/PAID/OVERDUE만, take=100) */ ],
  "ledgers":  [ /* 본인 ClosingLedger[] (24개월) */ ],
  "notices":  [ /* 본인 대상 Notice[] (target ALL/DEALER/HOSPITAL/SPECIFIC + 만료필터, targetIds 평탄화) */ ]
}
```

### 14-2. 발주 등록 (`POST /api/client-portal/orders`)

CLIENT 본인 → `SUBMITTED` 상태 Order 즉시 생성. DRAFT 단계 생략.

**요청 body**:
```json
{
  "items": [
    { "productId": "cuid", "productSizeId": "cuid", "qty": 2 }
  ],
  "shipTo": {
    "addressId":     "cuid | null",
    "label":         "본사 | null",
    "recipient":     "홍길동 | null",
    "phone":         "010-... | null",
    "postalCode":    "06234 | null",
    "address":       "서울특별시 ... (필수)",
    "addressDetail": "5층 503호 | null",
    "memo":          "오후만 가능 | null"
  },
  "shippingMethod": "택배 | 방문수령 | 퀵",
  "notes":          "메모"
}
```

**검증 흐름**:
1. 세션 → role=CLIENT + clientId 확인
2. items 1건 이상, qty > 0, shipTo.address 필수
3. Product/ProductSize active 검증
4. `calculatePriceSnapshot()` 으로 라인별 가격 스냅샷 (우선순위 고정가 > 할인 > 기본가)
5. Postgres advisory lock 으로 `ORD-YYYYMMDD-NNN` 채번
6. Order + OrderItem 일괄 생성 + 배송지 스냅샷
7. `revalidatePath("/admin/orders")` + `/client` 캐시 무효화
8. `logAudit({ action: "CLIENT_ORDER_CREATE" })`

**응답 (201 Created)**:
```json
{ "ok": true, "order": { /* Order + items[] */ } }
```

**에러 (400)**:
```json
{ "ok": false, "error": "주문할 제품을 1개 이상 선택해주세요." }
```

---

## 15. 표준 에러 포맷

성공: 데이터 직접 또는 `{ ok: true, ...payload }`.
실패: `{ ok: false, error: "한글 메시지", fieldErrors?: { field: "..." } }`.

| HTTP | 의미 |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | 검증 실패 / 비즈니스 규칙 위반 |
| 401 | 세션 없음 — 미들웨어가 차단하면 307 → `/login` |
| 403 | 역할 부족 — 미들웨어가 차단하면 307 → `/403`. server action `requireRole` 실패도 307 → `/403` (Next.js redirect throw) |
| 404 | 리소스 없음 |
| 409 | 충돌 (예: unique 위배) |
| 500 | 서버 오류 |

⚠️ **server action 안의 `requireRole` 거부는 Next.js 가 NEXT_REDIRECT 를 throw 하여 RSC 307 응답으로 변환됨** — fetch 클라이언트는 `r.status === 307` 도 권한 거부 신호로 처리해야 한다 (`r.ok` 만 보면 데이터를 null 로 받고 조용히 실패함).

---

## 16. 호출 흐름 예시

### 16-1. CLIENT 발주 등록 (브라우저)

```
[브라우저] /client → 미들웨어 307 → /portals/client-portal.html
  ├─ data-loader.js: GET /api/me → role=CLIENT
  ├─ data-loader.js: GET /api/client-portal/bootstrap (단일 호출, 모든 데이터)
  └─ 사용자 입력 → submitOrder() → POST /api/client-portal/orders
      ├─ 서버: createClientOrder() 액션
      │    ├─ pricing.calculatePriceSnapshot() → 가격 고정
      │    ├─ tx: advisory_xact_lock + Order/OrderItem insert
      │    └─ logAudit + revalidatePath
      └─ 응답 201 → ORDERS.unshift(newOrder) → 모달 → 발주내역 갱신
```

### 16-2. ADMIN 주문 확정 + 출고

```
GET  /api/orders?status=SUBMITTED                          # SUBMITTED 목록
POST /api/orders/[id]/transition  { action: "CONFIRM" }    # CONFIRMED + RESERVE 재고
POST /api/shipments/[id]/transition { action: "start" }    # 첫 KanbanColumn 진입
POST /api/shipments/[id]/transition { action: "move", to } # 단계 이동
   # terminal 컬럼 → 자동 SHIP (physicalStock 차감 + Order=COMPLETED)
POST /api/invoices              { orderId }                # DRAFT 명세서 생성
POST /api/invoices/[id]/issue                              # INV-YYYYMMDD-NNN 채번
POST /api/invoices/[id]/send                               # sentAt 기록
POST /api/payments              { invoiceId, amount }      # 수금
POST /api/ledger                { action: "recompute", month, clientId }
```

---

## 17. 미정의 / 추후 보강

- **CLIENT-FACING 주문 수정/취소** — 현재 발주 후 수정 불가 (admin이 status 전이로만 처리). UI 의 "수정" 링크는 mock.
- **OAuth/SSO** — 현재는 Credentials 만. 후속 Phase 에서 추가 예정.
- **OpenAPI 스펙** — 본 문서가 단일 소스 (수기). OpenAPI 3 자동 생성 도구 (예: `next-openapi-ts`) 도입은 별도 작업.
- **Rate Limit** — 현재 미적용. Azure Front Door / WAF 로 운영 단계에서 부착 예정.

---

**문서 갱신 규칙**: 새 endpoint 추가 또는 RBAC 변경 시 본 파일도 같은 PR 에서 갱신.
**참고**: `CLAUDE.md` (도메인 규칙), `docs/superpowers/plans/2026-04-18-master-plan.md` (Phase 로드맵), `src/lib/rbac.ts` (RBAC 매트릭스 코드), `src/lib/session.ts` (세션 헬퍼).
