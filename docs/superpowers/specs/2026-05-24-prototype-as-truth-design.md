# Design — Prototype 그대로 서빙 + 백엔드 API 연동

**작성일**: 2026-05-24
**작성자**: Claude (사용자 결정 기반)
**전환점**: 사용자가 본 서비스의 디자인/메뉴 변경에 불만족 — prototype HTML 을 진실로 삼고 백엔드만 새로 연결하는 방향으로 전환

---

## 0. 한 줄 요약

`prototype/*.html` 5개 파일을 **수정 없이** 서빙하고, JS 내 mock 데이터(`window.CLIENTS` 등) 를 **Next.js API 라우트 fetch 호출** 로 점진 대체. 인증은 NextAuth 가 미들웨어 레벨에서 정적 파일 접근까지 보호.

---

## 1. 아키텍처

### 1-1. 디렉토리 구조

```
public/
  portals/
    index.html              ← prototype/index.html (역할 선택)
    admin-portal.html       ← prototype/admin-portal.html
    qc-portal.html          ← prototype/qc-portal.html
    exec-portal.html        ← prototype/exec-portal.html
    ceo-portal.html         ← prototype/ceo-portal.html
    client-portal.html      ← prototype/client-portal.html (모바일 UI)
    widget-dashboard.html   ← prototype/widget-dashboard.html
    css/                    ← prototype/css/* 전체
    js/                     ← prototype/js/* 전체 (mock 데이터를 fetch 호출로 점진 변경)

src/app/
  layout.tsx                ← 최상위 (NextAuth Provider, 메타데이터)
  page.tsx                  ← / 접근 시 인증 체크 → /portals/index.html 로 redirect
  login/page.tsx            ← NextAuth 로그인 폼 (Server Component, 디자인 단순)
  api/
    auth/[...nextauth]/     ← NextAuth (기존 그대로)
    clients/route.ts        ← prototype 의 window.CLIENTS 대체
    products/route.ts       ← window.PRODUCTS 대체
    orders/route.ts
    invoices/route.ts
    payments/route.ts
    ledger/route.ts
    ... (prototype 이 사용하는 모든 window.* 변수 1:1 매칭)
  
  admin/page.tsx            ← redirect("/portals/admin-portal.html")
  qc/page.tsx               ← redirect("/portals/qc-portal.html")
  exec/page.tsx             ← redirect("/portals/exec-portal.html")
  ceo/page.tsx              ← redirect("/portals/ceo-portal.html")
  client/page.tsx           ← redirect("/portals/client-portal.html")
  
  (admin/clients, admin/products, ... 모두 제거)

src/middleware.ts           ← /portals/*.html 접근 시 NextAuth 세션 + RBAC 체크

src/lib/                    ← 모든 actions/validators/tests 유지 (API 라우트가 thin wrap 함)
prisma/                     ← 스키마·마이그레이션 그대로
```

### 1-2. 변경 범위

| 영역 | 변경 |
|---|---|
| **prototype/*.html** | 0 byte 수정 — `public/portals/` 로 복사만 |
| **prototype/js/data.js** | mock 데이터 정의 부분만 `await fetch('/api/...')` 로 단계 변경 |
| **prototype/js/*.js** | 데이터 의존 함수들이 fetch 결과 사용하도록 어댑터 |
| **src/app/** | 5포털 page.tsx 만 redirect 로 단순화 / 나머지 28+ 페이지 디렉토리 삭제 |
| **src/app/api/** | prototype JS 가 호출할 API 라우트 신규 작성 (~12개) |
| **src/middleware.ts** | `/portals/*` 보호 추가 |
| **prisma/schema.prisma** | **변경 없음** |
| **src/lib/actions/** | **변경 없음** — API 라우트가 thin wrap |
| **src/lib/validators/** | **변경 없음** |
| **src/components/shared/** | 사용 안 함 (prototype HTML 이 자체 컴포넌트) |
| **테스트** | actions/validators 테스트는 그대로 통과해야 함 |

---

## 2. 인증/세션 흐름

```
1. 사용자가 / 접근
   ↓
2. middleware: NextAuth 세션 없으면 → /login redirect
   ↓
3. /login: 이메일/비번 입력 → NextAuth credentials provider
   ↓
4. 세션 발급 후 / 로 복귀
   ↓
5. src/app/page.tsx: 세션 role 확인 → /portals/index.html 또는 단일 포털로 redirect
   - TENANT_OWNER/SUPER_ADMIN → /portals/index.html (역할 선택)
   - 그 외 단일 role → /portals/{role}-portal.html
   ↓
6. /portals/admin-portal.html 접근
   ↓
7. middleware: 세션 + RBAC 체크
   - /portals/admin-portal.html 접근 권한: TENANT_OWNER, ADMIN
   - /portals/qc-portal.html 권한: TENANT_OWNER, QC
   - ... 등
   ↓
8. 정적 HTML 서빙 + 내부 JS 가 /api/* 호출
   ↓
9. /api/* 라우트: getServerSession() 으로 인증 + tenant 컨텍스트 + RBAC 적용
```

### 2-1. NextAuth 세션이 prototype JS 에 노출되는 방법

미들웨어가 HTML 서빙 시 응답 헤더에 사용자 정보 inject 불가능 (정적 HTML).

대안:
- **`/api/me`** 라우트가 현재 세션 정보 반환 → prototype JS 가 진입 시 호출
- prototype/js/shared-ui.js 의 `window.CURRENT_USER` 초기화 부분만 `await fetch('/api/me')` 로 변경

---

## 3. 데이터 흐름

### 3-1. 현재 prototype 의 데이터 패턴

```javascript
// prototype/js/data.js (54K 줄, 모든 도메인 mock)
window.CLIENTS = [
  { id: "C001", name: "서울메디칼 대리점", type: "AGENCY", ... },
  ...
];
window.PRODUCTS = [...];
window.ORDERS = [...];
window.INVOICES = [...];
// ... 30+ 개 전역 변수
```

prototype JS 의 `renderClientsTable()` 같은 함수들이 `window.CLIENTS` 를 직접 참조.

### 3-2. 변경 후 패턴

```javascript
// public/portals/js/data.js (어댑터 추가)
// 기존 hard-coded 데이터를 제거하고 fetch 로 대체
async function loadAllData() {
  const [clients, products, orders, invoices, payments] = await Promise.all([
    fetch('/api/clients').then(r => r.json()),
    fetch('/api/products').then(r => r.json()),
    fetch('/api/orders').then(r => r.json()),
    fetch('/api/invoices').then(r => r.json()),
    fetch('/api/payments').then(r => r.json()),
  ]);
  window.CLIENTS = clients;
  window.PRODUCTS = products;
  window.ORDERS = orders;
  window.INVOICES = invoices;
  window.PAYMENTS = payments;
  // ... 등
}

// HTML body 시작 시 호출
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllData();
  // 기존 init 함수들 호출
  if (typeof initApp === 'function') initApp();
});
```

### 3-3. API 라우트 (모두 신규 작성)

| Endpoint | Method | 백엔드 source | 비고 |
|---|---|---|---|
| `/api/me` | GET | `getServerSession()` | 현재 사용자 + role + tenant |
| `/api/clients` | GET / POST | `listClients` / `createClient` | |
| `/api/clients/[id]` | GET / PATCH / DELETE | `getClient` / `updateClient` / `deactivateClient` | |
| `/api/products` | GET / POST | `listProducts` / `createProduct` | |
| `/api/products/[id]` | GET / PATCH | | |
| `/api/orders` | GET / POST | `listOrders` / `createOrder` | |
| `/api/orders/[id]/transition` | POST | `submitOrder` / `confirmOrder` / `cancelOrder` | |
| `/api/invoices` | GET | `listInvoices` | |
| `/api/invoices/[id]/issue` | POST | `issueInvoice` | |
| `/api/payments` | GET / POST | `listPayments` / `recordPayment` | |
| `/api/ledger` | GET / POST | `listLedgers` / `recomputeLedger` | |
| `/api/notices` | GET / POST / DELETE | `listNotices` / `createNotice` / `deleteNotice` | |
| `/api/udi` | GET / POST | `listUdiReports` / `createUdiReportFromInvoices` | |
| `/api/data-explorer` | GET / POST | `listTransactions` / `bulkInsertTransactions` | 41K 매입매출장 — 조회·입력 |
| `/api/data-explorer/[id]` | PATCH / DELETE | `updateTransaction` / `deleteTransaction` | 단건 수정·삭제 |
| `/api/data-explorer/bulk` | POST / DELETE | `bulkInsertTransactions` / `deleteTransactionsByImportSource` | 엑셀/CSV 업로드, 일괄 삭제 |
| `/api/data-explorer/export` | GET | (route handler) | CSV/Excel 다운로드 |
| `/api/manuals` | GET | `listQualityDocs` | |
| `/api/procurement` | GET | `listProcurementProjects` | |
| `/api/settings` | GET / PATCH | `listSettings` / `updateSetting` | |

→ **약 24개 API 라우트**. 각각 5~10줄 thin wrapper (기존 actions 호출 + JSON 응답).

### 3-4. AI 친화 설계

데이터 탐색기 + 모든 주요 API 가 **AI 도구로 직접 호출 가능**하도록 설계:

- **RESTful 일관성**: `GET /api/{resource}` 조회 · `POST` 생성 · `PATCH /:id` 수정 · `DELETE /:id` 삭제
- **JSON 응답 표준**: `{ ok: true, data: ... }` / `{ ok: false, error: "...", fieldErrors: {...} }` (기존 ActionResult 형식)
- **OpenAPI 스펙 자동 생성** (선택): `/api/openapi.json` 라우트로 모든 endpoint 노출 → ChatGPT/Claude function calling 으로 바로 사용 가능
- **인증**: 세션 쿠키 외에 **API 토큰** 도 허용 (헤더 `Authorization: Bearer <token>`) — AI 가 비대화형으로 호출 가능
- **TransactionLedger 의 모든 컬럼**(20+개) 을 PATCH 로 부분 업데이트 허용 — AI 가 자연어로 "5월 거래 중 거래처 X 라인의 단가를 10% 인상" 같은 요청 처리 가능

### 3-5. 새로 추가할 actions (현재 listTransactions, aggregateTransactions, bulkInsertTransactions 만 있음)

| Action | 책임 |
|---|---|
| `getTransaction(id)` | 단건 조회 (현재 없음) |
| `updateTransaction(id, patch)` | 부분 수정 + 감사 로그 (현재 없음) |
| `deleteTransaction(id)` | 단건 삭제 + 감사 로그 (현재 없음) |
| `bulkUpdateTransactions(filter, patch)` | 필터링된 일괄 수정 (AI 친화) |

검증: 기존 `transactionLedgerSchema` 확장 (부분 PATCH 용 `updateTransactionSchema` 추가).

---

## 4. 핵심 결정 사항

### 4-1. R01~R24 추가 페이지 처리
- prototype 에 없는 메뉴/페이지는 src/app 에서 제거
- 백엔드 actions/validators/tests/스키마는 그대로 유지 (계약 R01~R24 의무 보존)
- URL 직접 접근(`/admin/products` 등) 시 404 (의도된 동작)
- 계약 검수 시 "백엔드 구현됨, UI 는 prototype 매뉴얼 추가 필요" 답변 가능

### 4-2. client portal
- prototype 의 모바일 우선 UI (하단 탭바 3개) 그대로 사용
- 데스크톱 src/app/client/* 모두 제거

### 4-3. 디자인
- prototype HTML 의 CSS/구조 그대로 — Next.js 가 일체 손대지 않음
- src/components/shared 의 React 컴포넌트는 사용 안 함 (login 페이지만 예외)

### 4-4. 세션 만료 시
- API 라우트가 401 반환 → prototype JS 가 `window.location.href = '/login'` 으로 이동

---

## 5. 컴포넌트 분해

### 5-1. Middleware (`src/middleware.ts`)
- **책임**: 인증 + RBAC 체크 (정적 파일 접근까지 보호)
- **입력**: HTTP request (path, cookies)
- **출력**: 통과 / redirect / 401

### 5-2. API 라우트 (`src/app/api/*/route.ts`)
- **책임**: HTTP → 기존 server action 호출 → JSON 응답
- **공통 패턴**:
  ```ts
  export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return new Response("Unauthorized", { status: 401 });
    const data = await listClients(); // 기존 action
    return Response.json(data);
  }
  ```

### 5-3. 데이터 어댑터 (`public/portals/js/data-loader.js`)
- **책임**: 진입 시 모든 데이터 fetch, prototype 의 window.* 변수 채움
- **테스트 가능**: fetch mock 으로 단위 테스트 가능

### 5-4. 로그인 (`src/app/login/page.tsx`)
- **책임**: NextAuth credentials 로그인 폼
- **디자인**: prototype 에는 자체 로그인 화면이 portal HTML 안에 있음 — 일관성 위해 별도 페이지
- 또는 prototype/index.html 의 로그인 화면 그대로 활용 (검토 필요)

---

## 6. 에러 처리

| 상황 | 처리 |
|---|---|
| API 401 (세션 만료) | prototype JS 가 자동 `/login` redirect |
| API 403 (RBAC 실패) | toast 알림 + 기존 화면 유지 |
| API 500 | toast 알림 + retry 버튼 |
| 정적 HTML 로딩 실패 (드물게) | 브라우저 기본 에러 화면 |
| RBAC: TENANT_OWNER 가 /portals/qc-portal.html 접근 | 허용 (전체 권한) |
| RBAC: QC 가 /portals/admin-portal.html 접근 | 403 → /portals/{본인 role}-portal.html redirect |

---

## 7. 테스트 전략

| 레이어 | 테스트 |
|---|---|
| **actions/validators** | 기존 vitest 371건 그대로 통과 (변경 없음) |
| **API 라우트** | 새 신규 vitest — auth 통과/실패, 200/401/403 응답 코드 |
| **middleware** | unit test — 정적 파일 보호 검증 |
| **E2E** | (선택) Playwright 으로 login → portal 진입 → 데이터 표시 |

---

## 8. 마이그레이션 계획 (구현 순서)

1. **Step 1 — 정적 자산 이전** (반나절)
   - `public/portals/` 생성 + prototype/*.html, css/, js/ 복사
   - src/app/admin/page.tsx 등 5개를 redirect 로 변경
   - middleware 가 /portals/* 보호하도록 확장

2. **Step 2 — 핵심 API 라우트** (1일)
   - /api/me, /api/clients, /api/products 3개 먼저
   - 해당 prototype JS 의 window.CLIENTS, window.PRODUCTS 만 fetch 로 변경
   - admin/qc/exec 의 거래처 관리 페이지 동작 확인

3. **Step 3 — 나머지 API 라우트** (1일)
   - orders, invoices, payments, ledger, udi, notices 등
   - 각 메뉴별로 동작 확인

4. **Step 4 — R01~R24 추가 페이지 제거** (반나절)
   - src/app/admin/{products,inventory,alerts,expiry,contracts,reports,data-usage} 디렉토리 삭제
   - src/components/admin/{products,inventory,...} 동일하게 삭제
   - src/components/shared/portalMenus.ts 제거 (prototype HTML 이 자체 메뉴)

5. **Step 5 — 회귀 검증** (반나절)
   - 5포털 모든 메뉴 클릭 → 데이터 로딩 확인
   - typecheck + vitest 통과
   - 커밋 + push

**총 예상**: 3~4일

---

## 9. 위험 요소

| 위험 | 대응 |
|---|---|
| prototype JS 가 너무 복잡해서 fetch 어댑터 작업이 예상보다 큼 | Step 2 후 reassess. 일부는 mock 유지 가능 |
| Next.js 미들웨어가 정적 파일 보호 시 성능 저하 | 캐시 헤더 적절히 설정 |
| prototype 의 인라인 스타일/스크립트가 Next.js 기본 보안 정책(CSP) 과 충돌 | next.config.js 에서 CSP 완화 |
| 기존 R01~R24 UI 페이지 제거 시 import 깨짐 | grep 으로 참조 확인 후 제거 |
| 시드 데이터가 prototype mock 과 형식 다름 | API 라우트에서 변환 또는 시드 보강 |

---

## 10. 미해결 / 사용자 확인 필요

1. **로그인 화면**: src/app/login/page.tsx 유지 vs prototype/index.html 의 mock 로그인 화면 활용 — 결정 필요
2. **CSP 완화 수준**: prototype 의 모든 inline script 허용할지 — 보안 trade-off
3. **API 응답 형식**: 기존 actions 의 반환을 그대로 JSON 화 vs camelCase 정규화
4. **R01~R24 페이지 삭제 시점**: Step 2 데이터 연결 완료 후 vs Step 1 부터 함께
