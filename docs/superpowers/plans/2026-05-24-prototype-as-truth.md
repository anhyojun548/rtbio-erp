# Prototype-as-Truth Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** prototype HTML 5포털을 수정 없이 그대로 서빙하고 백엔드만 Next.js API 라우트로 연결한다. R01~R24 추가 UI 페이지는 마지막에 제거하되 DB·actions·tests 는 유지.

**Architecture:** prototype/*.html, css/, js/ → public/portals/ 정적 복사. src/app/{admin,qc,exec,ceo,client}/page.tsx 는 redirect. middleware 가 /portals/* 까지 NextAuth 세션 + RBAC 보호. 기존 src/lib/actions/* 를 ~28개 API 라우트가 thin wrap. prototype JS 의 `window.CLIENTS` 등 mock 을 fetch 호출로 교체 — DOMContentLoaded gate 로 race 방지.

**Tech Stack:** Next.js 14 App Router · Prisma 5.22 + PostgreSQL 16 · NextAuth v4 · Vanilla JS (prototype 그대로) · Vitest

**사용자 결정 사항 (Spec §10 미해결 해결):**
1. **로그인 화면**: 현재 NextAuth `/login` 유지 (변경 없음)
2. **CSP 헤더**: Next.js 기본 그대로 (자체 설정 안 함)
3. **API 응답 형식**: 성공 = 바로 JSON · 실패 = `{ ok: false, error, fieldErrors }`
4. **R01~R24 UI 제거 시점**: 마지막 (Task 21)

**기존 코드 확인 (rbac.ts):** `UserRole` enum = `TENANT_OWNER | ADMIN | QC | EXEC | CLIENT | SUPER_ADMIN`. `requireRole()` 는 가변인자.

---

## File Structure

(spec §1-1 참조 — 변경 없음)

추가 endpoint 28개로 확정:
- /api/me, /api/clients{,/[id]}, /api/products{,/[id]}, /api/orders{,/[id]{,/transition}}, /api/invoices{,/[id]{,/issue}}, /api/payments{,/[id]}, /api/ledger, /api/notices{,/[id]}, /api/udi{,/[id]{,/submit}}, /api/settings, /api/manuals, /api/procurement, /api/data-explorer{,/[id],/bulk}, **/api/conferences{,/[id]}**, **/api/sales-history**, **/api/expiry**, **/api/shipments{,/[id]/transition}**

---

## Tasks

### Task 1: prototype 자산을 public/portals/ 복사

**Files:**
- Create: `public/portals/*.html` (7개)
- Create: `public/portals/css/*` + `public/portals/js/*`

- [ ] **Step 1: 복사**

```bash
mkdir -p public/portals
cp prototype/*.html public/portals/
cp -r prototype/css public/portals/css
cp -r prototype/js public/portals/js
```

- [ ] **Step 2: 정적 경로 확인**

```bash
ls public/portals/css/ public/portals/js/ | head -10
```

Expected: shared.css/data.js 등이 보임.

- [ ] **Step 3: dev 서버에서 직접 접근**

```bash
pnpm dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/portals/admin-portal.html
```

Expected: 200 OR 302 (인증 미설정 시 redirect). 404 면 복사 실패.

- [ ] **Step 4: 커밋**

```bash
git add public/portals
git commit -m "feat(portals): prototype HTML 자산 public/portals/ 복사"
```

---

### Task 2: rbac.ts 에 portal HTML 경로 RBAC 추가

**Files:**
- Modify: `src/lib/rbac.ts`
- Create: `src/lib/rbac.test.ts`

- [ ] **Step 1: 테스트 작성 (failing)**

```typescript
// src/lib/rbac.test.ts
import { describe, expect, it } from "vitest";
import { canAccessPath } from "./rbac";

describe("canAccessPath — /portals/*.html", () => {
  it("TENANT_OWNER 는 모든 포털 HTML 접근", () => {
    for (const p of ["admin", "qc", "exec", "ceo", "client"]) {
      expect(canAccessPath("TENANT_OWNER", `/portals/${p}-portal.html`)).toBe(true);
    }
  });
  it("SUPER_ADMIN 도 모든 포털 HTML 접근", () => {
    for (const p of ["admin", "qc", "exec", "ceo", "client"]) {
      expect(canAccessPath("SUPER_ADMIN", `/portals/${p}-portal.html`)).toBe(true);
    }
  });
  it("ADMIN → admin-portal 만, qc/exec/ceo/client 차단", () => {
    expect(canAccessPath("ADMIN", "/portals/admin-portal.html")).toBe(true);
    expect(canAccessPath("ADMIN", "/portals/qc-portal.html")).toBe(false);
    expect(canAccessPath("ADMIN", "/portals/exec-portal.html")).toBe(false);
    expect(canAccessPath("ADMIN", "/portals/ceo-portal.html")).toBe(false);
    expect(canAccessPath("ADMIN", "/portals/client-portal.html")).toBe(false);
  });
  it("QC → qc-portal 만", () => {
    expect(canAccessPath("QC", "/portals/qc-portal.html")).toBe(true);
    expect(canAccessPath("QC", "/portals/admin-portal.html")).toBe(false);
    expect(canAccessPath("QC", "/portals/ceo-portal.html")).toBe(false);
  });
  it("EXEC → exec-portal 만", () => {
    expect(canAccessPath("EXEC", "/portals/exec-portal.html")).toBe(true);
    expect(canAccessPath("EXEC", "/portals/admin-portal.html")).toBe(false);
  });
  it("CLIENT → client-portal 만", () => {
    expect(canAccessPath("CLIENT", "/portals/client-portal.html")).toBe(true);
    expect(canAccessPath("CLIENT", "/portals/admin-portal.html")).toBe(false);
  });
  it("정적 자원(css/js) 과 index/widget-dashboard 는 인증된 모든 역할 허용", () => {
    for (const role of ["TENANT_OWNER", "ADMIN", "QC", "EXEC", "CLIENT", "SUPER_ADMIN"] as const) {
      expect(canAccessPath(role, "/portals/css/shared.css")).toBe(true);
      expect(canAccessPath(role, "/portals/js/data.js")).toBe(true);
      expect(canAccessPath(role, "/portals/index.html")).toBe(true);
      expect(canAccessPath(role, "/portals/widget-dashboard.html")).toBe(true);
    }
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

```bash
pnpm vitest run src/lib/rbac.test.ts
```

Expected: FAIL

- [ ] **Step 3: 구현**

`src/lib/rbac.ts` 의 `canAccessPath` 위에 다음 추가:

```typescript
const PORTAL_HTML_ACCESS: Record<string, UserRole[]> = {
  "/portals/admin-portal.html":  ["TENANT_OWNER", "SUPER_ADMIN", "ADMIN"],
  "/portals/qc-portal.html":     ["TENANT_OWNER", "SUPER_ADMIN", "QC"],
  "/portals/exec-portal.html":   ["TENANT_OWNER", "SUPER_ADMIN", "ADMIN", "EXEC"],
  "/portals/ceo-portal.html":    ["TENANT_OWNER", "SUPER_ADMIN"],
  "/portals/client-portal.html": ["TENANT_OWNER", "SUPER_ADMIN", "CLIENT"],
};

export function canAccessPath(role: UserRole, pathname: string): boolean {
  // 1) 정적 자원·index·widget-dashboard: 인증만 통과하면 허용
  if (
    pathname.startsWith("/portals/css/") ||
    pathname.startsWith("/portals/js/") ||
    pathname === "/portals/index.html" ||
    pathname === "/portals/widget-dashboard.html"
  ) {
    return true;
  }
  // 2) Portal HTML — 역할별 접근
  if (pathname in PORTAL_HTML_ACCESS) {
    return PORTAL_HTML_ACCESS[pathname]!.includes(role);
  }
  // 3) 기존 prefix 매트릭스
  for (const [prefix, allowed] of Object.entries(ROLE_PORTAL_ACCESS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return allowed.includes(role);
    }
  }
  return true;
}
```

- [ ] **Step 4: 통과**

```bash
pnpm vitest run src/lib/rbac.test.ts
```

Expected: 7 tests passed.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/rbac.ts src/lib/rbac.test.ts
git commit -m "feat(rbac): /portals/*.html 경로 RBAC 룰 추가"
```

---

### Task 3: src/app 5포털 page.tsx → redirect

**Files:**
- Modify: `src/app/admin/page.tsx`, `qc/page.tsx`, `exec/page.tsx`, `ceo/page.tsx`, `client/page.tsx`

- [ ] **Step 1: admin/page.tsx 교체**

```typescript
// src/app/admin/page.tsx
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";

export default async function AdminPortalRedirect() {
  await requireRole("TENANT_OWNER", "SUPER_ADMIN", "ADMIN");
  redirect("/portals/admin-portal.html");
}
```

- [ ] **Step 2: 4개 동일 적용**

| 파일 | requireRole | redirect 대상 |
|---|---|---|
| `qc/page.tsx` | `"TENANT_OWNER", "SUPER_ADMIN", "QC"` | `/portals/qc-portal.html` |
| `exec/page.tsx` | `"TENANT_OWNER", "SUPER_ADMIN", "ADMIN", "EXEC"` | `/portals/exec-portal.html` |
| `ceo/page.tsx` | `"TENANT_OWNER", "SUPER_ADMIN"` | `/portals/ceo-portal.html` |
| `client/page.tsx` | `"TENANT_OWNER", "SUPER_ADMIN", "CLIENT"` | `/portals/client-portal.html` |

- [ ] **Step 3: typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4: 커밋**

```bash
git add src/app/{admin,qc,exec,ceo,client}/page.tsx
git commit -m "feat(portals): 5포털 page.tsx → prototype HTML redirect"
```

---

### Task 4: /api/me 엔드포인트

**Files:**
- Create: `src/app/api/me/route.ts`
- Create: `src/app/api/me/route.test.ts`

- [ ] **Step 1: 테스트 작성 (failing)**

```typescript
import { describe, expect, it, vi } from "vitest";
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { GET } from "./route";
import { getServerSession } from "next-auth";

describe("/api/me", () => {
  it("세션 없으면 401 + envelope", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "Unauthorized" });
  });
  it("세션 있으면 사용자 정보 그대로 JSON", async () => {
    (getServerSession as any).mockResolvedValue({
      user: { id: "u1", email: "owner@altibio.local", name: "이대표", role: "TENANT_OWNER", tenantCode: "altibio" },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe("TENANT_OWNER");
    expect(data.email).toBe("owner@altibio.local");
  });
});
```

- [ ] **Step 2: 실행 → 실패 → 구현**

```typescript
// src/app/api/me/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    id:         session.user.id,
    email:      session.user.email,
    name:       session.user.name,
    role:       session.user.role,
    tenantCode: session.user.tenantCode,
    clientId:   session.user.clientId ?? null,
  });
}
```

- [ ] **Step 3: 통과 → 커밋**

```bash
pnpm vitest run src/app/api/me/route.test.ts
git add src/app/api/me
git commit -m "feat(api): /api/me — 세션 사용자 정보"
```

---

### Task 5: /api/clients — GET / POST

**Files:** `src/app/api/clients/route.ts` + 테스트

- [ ] **Step 1: 테스트 (4 케이스: GET 401/200, POST 201/400)**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/actions/client", () => ({ listClients: vi.fn(), createClient: vi.fn() }));
import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import { listClients, createClient } from "@/lib/actions/client";

beforeEach(() => vi.clearAllMocks());

describe("/api/clients", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/clients"));
    expect(res.status).toBe(401);
  });
  it("GET 성공 시 배열 그대로 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listClients as any).mockResolvedValue([{ id: "c1", name: "X" }]);
    const res = await GET(new Request("http://x/api/clients?q=X&active=ACTIVE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "c1", name: "X" }]);
  });
  it("POST 성공 시 생성 데이터 201", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createClient as any).mockResolvedValue({ ok: true, data: { id: "c2", code: "NEW" } });
    const res = await POST(new Request("http://x/api/clients", { method: "POST", body: JSON.stringify({ code: "NEW", name: "신규" }), headers: { "Content-Type": "application/json" } }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "c2", code: "NEW" });
  });
  it("POST validator 실패 시 400 envelope", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createClient as any).mockResolvedValue({ ok: false, error: "이름 필수", fieldErrors: { name: ["필수"] } });
    const res = await POST(new Request("http://x/api/clients", { method: "POST", body: JSON.stringify({}), headers: { "Content-Type": "application/json" } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "이름 필수", fieldErrors: { name: ["필수"] } });
  });
});
```

- [ ] **Step 2: 실행 → 실패 → 구현**

```typescript
// src/app/api/clients/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listClients, createClient } from "@/lib/actions/client";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const rows = await listClients({
    q: url.searchParams.get("q") ?? undefined,
    type: (url.searchParams.get("type") as any) ?? undefined,
    active: (url.searchParams.get("active") as any) ?? undefined,
  });
  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const res = await createClient(body);
  if (!res.ok) {
    return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  }
  return Response.json(res.data, { status: 201 });
}
```

- [ ] **Step 3: 통과 → 커밋**

```bash
git add src/app/api/clients
git commit -m "feat(api): /api/clients GET/POST"
```

---

### Task 6: /api/clients/[id] — GET / PATCH / DELETE

**Files:** `src/app/api/clients/[id]/route.ts` + 테스트

- [ ] **Step 1: 테스트 작성**

3 method × {401, 200/404, validation} = 9 케이스. `getClient`/`updateClient`/`deactivateClient` mock.

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/actions/client", () => ({
  getClient: vi.fn(), updateClient: vi.fn(), deactivateClient: vi.fn(),
}));
import { GET, PATCH, DELETE } from "./route";
import { getServerSession } from "next-auth";
import { getClient, updateClient, deactivateClient } from "@/lib/actions/client";

const ctx = { params: { id: "c1" } };
beforeEach(() => vi.clearAllMocks());

describe("/api/clients/[id]", () => {
  it("GET 401 세션 없음", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(401);
  });
  it("GET 404 없는 id", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (getClient as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(404);
  });
  it("GET 200 client 반환", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (getClient as any).mockResolvedValue({ id: "c1", name: "X" });
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("c1");
  });
  it("PATCH 200 success", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (updateClient as any).mockResolvedValue({ ok: true, data: { id: "c1" } });
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "갱신" }), headers: { "Content-Type": "application/json" } }), ctx);
    expect(res.status).toBe(200);
  });
  it("PATCH 400 validation", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (updateClient as any).mockResolvedValue({ ok: false, error: "X", fieldErrors: {} });
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: "{}", headers: { "Content-Type": "application/json" } }), ctx);
    expect(res.status).toBe(400);
  });
  it("DELETE 200 deactivate", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (deactivateClient as any).mockResolvedValue({ ok: true, data: { id: "c1" } });
    const res = await DELETE(new Request("http://x"), ctx);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: 구현**

```typescript
// src/app/api/clients/[id]/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClient, updateClient, deactivateClient } from "@/lib/actions/client";

type Ctx = { params: { id: string } };
const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const row = await getClient(params.id);
  if (!row) return Response.json({ ok: false, error: "Not Found" }, { status: 404 });
  return Response.json(row);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const res = await updateClient(params.id, body);
  if (!res.ok) return Response.json({ ok: false, error: res.error, fieldErrors: res.fieldErrors }, { status: 400 });
  return Response.json(res.data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const res = await deactivateClient(params.id);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });
  return Response.json(res.data);
}
```

- [ ] **Step 3: 통과 → 커밋**

```bash
git add src/app/api/clients/[id]
git commit -m "feat(api): /api/clients/[id] GET/PATCH/DELETE"
```

---

### Task 7-15: 나머지 API endpoint (각 task = 별도 commit)

각 Task 는 Task 5/6 패턴을 따른다. 모든 task 는 다음 step 구조:

> Step 1: 테스트 작성 (failing) → Step 2: 실행 실패 확인 → Step 3: route.ts 구현 → Step 4: 통과 → Step 5: 커밋

각 Task 의 endpoint 와 사용 action:

| Task | Files | Endpoints | Actions |
|---|---|---|---|
| **7. /api/products** | `route.ts`, `[id]/route.ts` | GET/POST, GET/PATCH/DELETE | listProducts, getProduct, createProduct, updateProduct, deactivateProduct |
| **8. /api/orders** | `route.ts`, `[id]/route.ts`, `[id]/transition/route.ts` | GET/POST, GET/PATCH, POST | listOrders, getOrder, createOrder, applyStatusTransition (`{ to, reason? }`) |
| **9. /api/invoices** | `route.ts`, `[id]/route.ts`, `[id]/issue/route.ts` | GET, GET, POST | listInvoices, getInvoice, createInvoiceFromOrder, issueInvoice, markInvoiceSent, cancelInvoice |
| **10. /api/payments** | `route.ts`, `[id]/route.ts` | GET/POST, DELETE | listPayments, recordPayment, cancelPayment |
| **11. /api/ledger** | `route.ts` | GET (list 또는 단건), POST (recompute) | listLedgers, recomputeLedger, recomputeLedgerMonth, closeMonth (`?month=YYYY-MM&action=close`), reopenMonth |
| **12. /api/notices** | `route.ts`, `[id]/route.ts` | GET/POST, DELETE | listNotices, createNotice, deleteNotice |
| **13. /api/udi** | `route.ts`, `[id]/route.ts`, `[id]/submit/route.ts` | GET/POST, GET/DELETE, POST | listUdiReports, getUdiReport, createUdiReportFromInvoices, submitUdiReport, deleteUdiReport, getUdiMonthPreview (`?month=YYYY-MM&preview=1`) |
| **14. /api/settings** | `route.ts` | GET, PATCH (bulk) | listSettings, updateSetting, bulkUpdateSettings |
| **15. /api/manuals, /api/procurement, /api/conferences, /api/sales-history, /api/expiry, /api/shipments** | 각 `route.ts` + `[id]/route.ts` (필요 시) | 대부분 GET; /api/conferences 와 /api/shipments 는 POST/PATCH 추가 | listQualityDocs / listProcurementProjects / listConferences, createConference, createVisitor / computeSalesHistory / listExpiryLots, createExpiryLot, updateExpiryLot, deleteExpiryLot / startShipment, moveShipmentStage, holdShipment, resumeShipment |

**구현 시 주의 (각 task 공통)**:
- 응답 형식: 성공 = JSON 그대로, 실패 = `{ ok: false, error, fieldErrors }`
- 401: 모든 endpoint 가 세션 체크
- 4xx: ActionResult.ok=false 시 400
- 5xx: try/catch 로 감싸지 말 것 (Next.js 가 기본 500 처리)

각 Task 끝 커밋:
```bash
git commit -m "feat(api): /api/<resource> <methods>"
```

---

### Task 16: 데이터 탐색기 actions 확장 — get/update/delete/bulkUpdate

**Files:**
- Modify: `src/lib/validators/transaction-ledger.ts` (updateTransactionSchema 추가)
- Modify: `src/lib/actions/transaction-ledger.ts` (4개 action 추가)
- Modify: `src/lib/validators/transaction-ledger.test.ts` (없으면 create)

- [ ] **Step 1: validator 테스트 (failing)**

```typescript
import { describe, expect, it } from "vitest";
import { updateTransactionSchema } from "./transaction-ledger";

describe("updateTransactionSchema", () => {
  it("부분 패치 허용 (note 만)", () => {
    expect(updateTransactionSchema.safeParse({ note: "수정" }).success).toBe(true);
  });
  it("qty 음수 거부", () => {
    expect(updateTransactionSchema.safeParse({ qty: -1 }).success).toBe(false);
  });
  it("kind 알 수 없는 값 거부", () => {
    expect(updateTransactionSchema.safeParse({ kind: "INVALID" }).success).toBe(false);
  });
  it("빈 객체 통과 (no-op patch)", () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(true);
  });
});
```

- [ ] **Step 2: validator 구현**

```typescript
// src/lib/validators/transaction-ledger.ts
// 기존 transactionLedgerSchema 아래에 추가
export const updateTransactionSchema = transactionLedgerSchema.partial();
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
```

- [ ] **Step 3: validator 통과 확인**

```bash
pnpm vitest run src/lib/validators/transaction-ledger.test.ts
```

- [ ] **Step 4: actions 구현 (테스트 없이 직접, smoke 로 검증)**

```typescript
// src/lib/actions/transaction-ledger.ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";
import { updateTransactionSchema, type UpdateTransactionInput } from "@/lib/validators/transaction-ledger";

export async function getTransaction(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  return prisma.transactionLedger.findUnique({ where: { id } });
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const updated = await prisma.transactionLedger.update({
      where: { id }, data: parsed.data, select: { id: true },
    });
    await logAudit({
      tenantId: user.tenantId, userId: user.id,
      action: "TXN_LEDGER_UPDATE", resource: `TransactionLedger:${id}`,
      metadata: { patch: parsed.data },
    });
    return ok(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return fail("거래를 찾을 수 없습니다");
    }
    throw err;
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  try {
    await prisma.transactionLedger.delete({ where: { id } });
    await logAudit({
      tenantId: user.tenantId, userId: user.id,
      action: "TXN_LEDGER_DELETE", resource: `TransactionLedger:${id}`,
    });
    return ok({ id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return fail("거래를 찾을 수 없습니다");
    }
    throw err;
  }
}

export async function bulkUpdateTransactions(
  filter: { ids?: string[]; clientCode?: string; from?: Date; to?: Date },
  patch: UpdateTransactionInput,
): Promise<ActionResult<{ updatedCount: number }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = updateTransactionSchema.safeParse(patch);
  if (!parsed.success) return zodFail(parsed.error);
  const where: Prisma.TransactionLedgerWhereInput = {};
  if (filter.ids?.length) where.id = { in: filter.ids };
  if (filter.clientCode) where.clientCode = filter.clientCode;
  if (filter.from || filter.to) {
    where.txnDate = {};
    if (filter.from) where.txnDate.gte = filter.from;
    if (filter.to)   where.txnDate.lte = filter.to;
  }
  const res = await prisma.transactionLedger.updateMany({ where, data: parsed.data });
  await logAudit({
    tenantId: user.tenantId, userId: user.id,
    action: "TXN_LEDGER_BULK_UPDATE", resource: "TransactionLedger",
    metadata: { filter, count: res.count },
  });
  return ok({ updatedCount: res.count });
}
```

- [ ] **Step 5: 커밋**

```bash
git add src/lib/{validators,actions}/transaction-ledger.ts src/lib/validators/transaction-ledger.test.ts
git commit -m "feat(transaction-ledger): get/update/delete/bulkUpdate actions"
```

---

### Task 17: /api/data-explorer CRUD endpoints

**Files:**
- Modify: `src/app/api/data-explorer/route.ts` (GET 확장 + POST 추가)
- Create: `src/app/api/data-explorer/[id]/route.ts` (GET/PATCH/DELETE)
- Create: `src/app/api/data-explorer/bulk/route.ts` (POST/PATCH/DELETE)

기존 `upload/route.ts`, `download/route.ts` 는 그대로 유지.

- [ ] **Step 1: 테스트 작성**

각 endpoint 의 인증/성공/실패 케이스 (16~20 case).

- [ ] **Step 2: 구현**

```typescript
// src/app/api/data-explorer/route.ts (기존 + POST 추가)
import { listTransactions, aggregateTransactions } from "@/lib/actions/transaction-ledger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const filter = {
    q: url.searchParams.get("q") ?? undefined,
    kind: (url.searchParams.get("kind") as any) ?? undefined,
    clientCode: url.searchParams.get("clientCode") ?? undefined,
    productCode: url.searchParams.get("productCode") ?? undefined,
    from: url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined,
    to:   url.searchParams.get("to")   ? new Date(url.searchParams.get("to")!)   : undefined,
    limit:  Number(url.searchParams.get("limit") ?? 100),
    offset: Number(url.searchParams.get("offset") ?? 0),
  };
  const [list, agg] = await Promise.all([
    listTransactions(filter),
    aggregateTransactions(filter),
  ]);
  return Response.json({ ...list, aggregates: agg });
}
// POST 는 단건 insert 가능 (선택 — bulk 가 더 일반적이므로 생략 가능)
```

```typescript
// src/app/api/data-explorer/[id]/route.ts
import { getTransaction, updateTransaction, deleteTransaction } from "@/lib/actions/transaction-ledger";
// GET/PATCH/DELETE 패턴은 Task 6 동일
```

```typescript
// src/app/api/data-explorer/bulk/route.ts
import { bulkInsertTransactions, bulkUpdateTransactions, deleteTransactionsByImportSource } from "@/lib/actions/transaction-ledger";

export async function POST(req: Request) {
  // body: { rows: [...] } → bulkInsertTransactions(rows, importSource)
}
export async function PATCH(req: Request) {
  // body: { filter: {...}, patch: {...} } → bulkUpdateTransactions(filter, patch)
}
export async function DELETE(req: Request) {
  // body: { importSource: "..." } → deleteTransactionsByImportSource
}
```

- [ ] **Step 3: 통과 → 커밋**

```bash
git commit -m "feat(api): /api/data-explorer CRUD (단건/일괄/AI 친화)"
```

---

### Task 18: data-loader.js — prototype mock → fetch (race condition fix)

**Files:**
- Create: `public/portals/js/data-loader.js`
- Modify: `public/portals/admin-portal.html`, `qc-portal.html`, `exec-portal.html`, `ceo-portal.html`, `client-portal.html` (script tag 추가)
- Modify: `public/portals/js/data.js` (hard-coded mock data 부분 무력화)

- [ ] **Step 1: 어느 line 의 mock 을 제거할지 정확히 파악**

```bash
grep -nE "^window\.(CLIENTS|PRODUCTS|ORDERS|INVOICES|PAYMENTS|LEDGERS|NOTICES|UDI_REPORTS|SETTINGS|QUALITY_DOCS|PROCUREMENTS|CONFERENCES|CURRENT_USER)\s*=\s*\[" public/portals/js/data.js
```

→ 출력된 라인 번호들이 mock 정의 시작점. 각 정의 끝(닫는 `];`) 까지가 무력화 대상.

- [ ] **Step 2: data-loader.js 신규 — DOMContentLoaded gate 적용**

```javascript
// public/portals/js/data-loader.js
// prototype 의 window.CLIENTS 등 mock 데이터를 /api/* fetch 결과로 채움.
// DOMContentLoaded 전에 fetch 시작 → DOMContentLoaded 까지 await
// (race condition 방지: prototype 의 init 함수들은 DOMContentLoaded 후 실행)

(function () {
  const loadPromise = (async () => {
    try {
      const [me, clients, products, orders, invoices, payments, ledger, notices, udi, settings, manuals, procurement, txns, conferences, expiry] = await Promise.all([
        fetch('/api/me').then(r => r.ok ? r.json() : null),
        fetch('/api/clients').then(r => r.ok ? r.json() : []),
        fetch('/api/products').then(r => r.ok ? r.json() : []),
        fetch('/api/orders').then(r => r.ok ? r.json() : []),
        fetch('/api/invoices').then(r => r.ok ? r.json() : []),
        fetch('/api/payments').then(r => r.ok ? r.json() : []),
        fetch('/api/ledger').then(r => r.ok ? r.json() : []),
        fetch('/api/notices').then(r => r.ok ? r.json() : []),
        fetch('/api/udi').then(r => r.ok ? r.json() : []),
        fetch('/api/settings').then(r => r.ok ? r.json() : []),
        fetch('/api/manuals').then(r => r.ok ? r.json() : []),
        fetch('/api/procurement').then(r => r.ok ? r.json() : []),
        fetch('/api/data-explorer?limit=200').then(r => r.ok ? r.json() : { rows: [] }),
        fetch('/api/conferences').then(r => r.ok ? r.json() : []),
        fetch('/api/expiry').then(r => r.ok ? r.json() : []),
      ]);
      window.CURRENT_USER = me;
      window.CLIENTS      = clients;
      window.PRODUCTS     = products;
      window.ORDERS       = orders;
      window.INVOICES     = invoices;
      window.PAYMENTS     = payments;
      window.LEDGERS      = ledger;
      window.NOTICES      = notices;
      window.UDI_REPORTS  = udi;
      window.SETTINGS     = settings;
      window.QUALITY_DOCS = manuals;
      window.PROCUREMENTS = procurement;
      window.TRANSACTIONS = txns.rows ?? [];
      window.CONFERENCES  = conferences;
      window.EXPIRY_LOTS  = expiry;
      console.info('[data-loader] all data loaded');
    } catch (err) {
      console.error('[data-loader] failed', err);
      if (err.status === 401) window.location.href = '/login';
    }
  })();

  // DOMContentLoaded 가 이미 발생한 후에도 동작하도록
  const ready = (cb) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb);
    } else {
      cb();
    }
  };
  ready(async () => {
    await loadPromise;
    // prototype 이 정의한 진입 함수가 있다면 호출
    if (typeof window.initApp === 'function')      window.initApp();
    if (typeof window.renderInitialPage === 'function') window.renderInitialPage();
    // 이미 active 인 nav 의 페이지 렌더링 트리거
    const activeNav = document.querySelector('.nav-item.active[data-page], .nav-item.active[onclick]');
    if (activeNav) {
      const dp = activeNav.getAttribute('data-page');
      if (dp && typeof window.goTo === 'function') window.goTo(dp);
      else if (dp && typeof window.navigateTo === 'function') window.navigateTo(dp);
    }
  });
})();
```

- [ ] **Step 3: 5개 portal HTML 에 script 추가**

각 HTML 의 `<script src="js/data.js"></script>` 바로 위에:

```html
<script src="js/data-loader.js"></script>
```

- [ ] **Step 4: data.js 의 hard-coded mock 부분 무력화**

Step 1 에서 찾은 라인들을 빈 배열로 변경:

```javascript
// Before:
window.CLIENTS = [
  { id: "C001", ... },
  ...
];
// After:
window.CLIENTS = window.CLIENTS || [];  // data-loader 가 채움
```

각 변수에 대해 동일 패턴. data.js 의 helper 함수 (`getClientById` 등) 는 변경 없음.

- [ ] **Step 5: 브라우저 검증**

```bash
pnpm dev
```

owner@altibio.local 로그인 → /admin → /portals/admin-portal.html → 거래처 메뉴 클릭 → 실제 DB 의 9개 거래처 표시 확인.

- [ ] **Step 6: 커밋**

```bash
git add public/portals/js/data-loader.js public/portals/js/data.js public/portals/*.html
git commit -m "feat(portals): mock 데이터를 /api/* fetch 로 대체 (data-loader, DOMContentLoaded gate)"
```

---

### Task 19: prototype JS 의 mutating action → fetch 변환

**Files:**
- Modify: `public/portals/js/*.js` (각 onSave/onDelete/onSubmit 함수)

prototype 의 각 모듈 (`shared-ui.js`, `client-mgmt.js`, `widget-dashboard.js`, `notice.js`, `data-explorer.js` 등) 에서 `window.CLIENTS.push(...)` 같은 mutation 을 `await fetch('/api/clients', { method: 'POST', body })` 로 변환.

- [ ] **Step 1: 변환 대상 함수 도출**

```bash
grep -nE "window\.\w+\.(push|splice|filter\b|find\()|window\.\w+\s*=\s*window\.\w+\.filter" public/portals/js/*.js | head -50
```

- [ ] **Step 2: 모듈별 어댑터 함수 작성**

`public/portals/js/api-adapter.js` 신규:

```javascript
// 공통 fetch helper
window.apiClient = {
  async get(path, params) {
    const url = params ? `${path}?${new URLSearchParams(params)}` : path;
    const r = await fetch(url);
    if (!r.ok) throw await r.json().catch(() => ({ error: r.statusText }));
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) throw await r.json().catch(() => ({ error: r.statusText }));
    return r.json();
  },
  async patch(path, body) {
    const r = await fetch(path, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!r.ok) throw await r.json().catch(() => ({ error: r.statusText }));
    return r.json();
  },
  async delete(path) {
    const r = await fetch(path, { method: 'DELETE' });
    if (!r.ok) throw await r.json().catch(() => ({ error: r.statusText }));
    return r.json();
  }
};
```

- [ ] **Step 3: 각 prototype JS 의 mutation 호출 부분 점진 변환**

예) `client-mgmt.js` 의 `saveClient()` 안:

```javascript
// Before:
window.CLIENTS.push(newClient);
showToast('저장됨');
// After:
const saved = await window.apiClient.post('/api/clients', newClient);
window.CLIENTS.push(saved);
showToast('저장됨');
```

이 변환은 모듈별로 수십 곳에서 발생. 점진적으로 진행, 한 모듈 끝낼 때마다 commit.

- [ ] **Step 4: 모듈별 분할 커밋**

```bash
# 거래처 관리 모듈 끝
git commit -m "feat(portals/js): client-mgmt 의 CUD 호출을 /api/clients 로 변환"

# 공지 모듈 끝
git commit -m "feat(portals/js): notice 모듈의 CUD 호출을 /api/notices 로 변환"

# ... 등
```

---

### Task 20: 누락 endpoint 보강 점검

**Files:**
- Audit: `public/portals/js/*.js` 에서 호출하는 모든 fetch URL
- Audit: 정의된 `/api/*/route.ts` 와 매칭

- [ ] **Step 1: fetch 호출 URL 추출**

```bash
grep -hoE "fetch\(['\"]/api/[^'\"]+" public/portals/js/*.js | sort -u
```

- [ ] **Step 2: 정의된 라우트와 비교**

```bash
find src/app/api -name "route.ts" | sed -E 's|src/app/api(.*)/route.ts|/api\1|' | sort -u
```

- [ ] **Step 3: 누락 endpoint 보강**

특히 다음 후보 확인:
- /api/shipments — kanban 칸반 이동 시 호출 (POST /api/shipments/start, /api/shipments/[id]/transition)
- /api/widget-dashboard — ceo customize 화면 (Phase 3G-4 이미 존재)
- /api/sales-history — exec 영업 이력서
- /api/expiry — 유통기한 로트
- /api/conferences — 학회 방명록

각 누락분에 대해 Task 7-15 패턴 반복.

- [ ] **Step 4: 통합 브라우저 검증**

모든 5포털 메뉴 클릭 시 console 에러 0건 확인.

- [ ] **Step 5: 커밋**

---

### Task 21: R01~R24 추가 UI 제거 (마지막)

**Files:**
- Delete: src/app/admin/{products,inventory,alerts,expiry,contracts,data-usage,shipments}
- Delete: src/app/admin/reports/{sales,sales-history,monthly}
- Delete: src/app/qc/{alerts,expiry,udi,samples,receiving,adjustments,shipments,inventory,reports,confirm,clients,notices,settings,data-explorer}
- Delete: src/app/exec/{usage,reports,assignments,rep-master,sales-status,data-explorer,clients,orders,conferences,notices}
- Delete: src/app/ceo/{overview,staff-metrics,customize,notices}
- Delete: src/app/client/{orders,invoices,payments,contracts,profile}
- Delete: src/components/{admin,qc,exec,ceo,client}
- Delete: src/components/shared/portalMenus.ts, Sidebar.tsx, TopBar.tsx, PortalShell.tsx (사용처 grep 후)

- [ ] **Step 1: import 참조 사전 점검**

```bash
grep -rn "from \"@/components/admin\|@/components/qc\|@/components/exec\|@/components/ceo\|@/components/client" src --include="*.tsx" --include="*.ts" | head -20
grep -rn "from \"@/components/shared/portalMenus\|/shared/Sidebar\|/shared/TopBar\|/shared/PortalShell" src --include="*.tsx" --include="*.ts" | head -20
```

→ 출력 결과의 파일들 (login/page.tsx 등) 에서 해당 import 제거 필요.

- [ ] **Step 2: 디렉토리 삭제**

```bash
rm -rf src/app/admin/{products,inventory,alerts,expiry,contracts,data-usage,shipments}
rm -rf src/app/admin/reports/{sales,sales-history,monthly}
rm -rf src/app/qc/{alerts,expiry,udi,samples,receiving,adjustments,shipments,inventory,reports,confirm,clients,notices,settings,data-explorer}
rm -rf src/app/exec/{usage,reports,assignments,rep-master,sales-status,data-explorer,clients,orders,conferences,notices}
rm -rf src/app/ceo/{overview,staff-metrics,customize,notices}
rm -rf src/app/client/{orders,invoices,payments,contracts,profile}
rm -rf src/components/{admin,qc,exec,ceo,client}
```

- [ ] **Step 3: shared UI 파일 사용처 마지막 확인 후 삭제**

```bash
grep -rn "portalMenus\|Sidebar\|TopBar\|PortalShell" src --include="*.tsx" --include="*.ts"
```

남는 참조 없으면:

```bash
rm -f src/components/shared/portalMenus.ts src/components/shared/Sidebar.tsx src/components/shared/TopBar.tsx src/components/shared/PortalShell.tsx
```

- [ ] **Step 4: typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 5: vitest run**

```bash
pnpm vitest run
```

Expected: 모든 actions/validators 테스트 통과. R01~R24 백엔드는 그대로.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "remove(ui): R01~R24 추가 UI 페이지·컴포넌트 제거 (백엔드·스키마 유지)"
```

---

### Task 22: 회귀 검증 + push

- [ ] **Step 1: typecheck + vitest**

```bash
pnpm typecheck && pnpm vitest run
```

- [ ] **Step 2: dev 서버 + 5포털 수동 검증**

각 계정 로그인 후 메뉴 모두 클릭. console 에러 0건.

| 계정 | URL | 확인 |
|---|---|---|
| owner@altibio.local | /admin → /portals/admin-portal.html | 매입매출장 등 모든 메뉴 |
| qc@altibio.local | /qc → /portals/qc-portal.html | 칸반 + 입고 + 출고 등 |
| sales1@altibio.local | /exec → /portals/exec-portal.html | 영업 현황 + 학회 등 |
| owner (ceo 임시) | /ceo → /portals/ceo-portal.html | 위젯 + 통합 현황 |
| c-agen-001@client.local | /client → /portals/client-portal.html | 모바일 UI 발주 |

- [ ] **Step 3: push**

```bash
git push origin main
```

---

## 검증 기준 (Acceptance Criteria)

- ✅ /admin, /qc, /exec, /ceo, /client URL 접근 시 prototype HTML 표시
- ✅ prototype 메뉴 클릭 시 페이지 전환 정상 (console 에러 0건)
- ✅ window.CLIENTS, PRODUCTS, ORDERS 등 변수가 실제 DB 데이터로 채워짐
- ✅ NextAuth 세션 없으면 /login redirect, API 401 시 prototype 도 /login 으로
- ✅ TENANT_OWNER 외 사용자가 다른 포털 HTML 접근 시 /403
- ✅ /api/me 가 현재 사용자 정보 반환
- ✅ /api/data-explorer CRUD 가 모두 동작 (GET/POST 단건/[id] PATCH/DELETE/bulk POST·PATCH·DELETE)
- ✅ /api/conferences, sales-history, expiry, shipments 등 누락 없음
- ✅ pnpm typecheck 0 errors
- ✅ pnpm vitest run 모든 테스트 통과 (회귀 0건)
- ✅ R01~R24 백엔드 actions/validators/tests 전부 유지 (계약 의무 보존)
- ✅ prototype의 inline style/script 동작 (Next.js 기본 CSP 헤더로 충분)

---

## 위험 요소

| 위험 | 대응 |
|---|---|
| data-loader race condition | DOMContentLoaded gate + Promise.all (Task 18) |
| prototype JS 의 정확한 데이터 형식 의존 | API 응답을 prototype 의 mock 형식과 일치하도록 정규화. 첫 검증 후 조정 |
| NextAuth 세션 쿠키가 fetch 에 자동 포함 안 됨 | same-origin 이라 자동. 필요시 `credentials: 'same-origin'` 명시 |
| 큰 prototype HTML 파일 정적 서빙 성능 | Next.js public/ 자동 정적 캐싱 |
| 기존 R01~R24 UI 제거 시 import 깨짐 | Task 21 Step 1 에서 grep 사전 점검 |
| API 응답 401/500 시 prototype JS 의 행동 | api-adapter 가 401 → /login redirect (Task 19) |

---

## 작업 분량 추정 (수정)

| Task | 시간 |
|---|---:|
| 1. 자산 복사 | 30분 |
| 2. RBAC | 1시간 |
| 3. redirect | 30분 |
| 4. /api/me | 30분 |
| 5-6. /api/clients | 1.5시간 |
| 7-15. 나머지 API (~9개 그룹) | 6-8시간 |
| 16. transaction-ledger actions | 1.5시간 |
| 17. data-explorer CRUD | 2시간 |
| 18. data-loader (race fix) | 2시간 |
| 19. mutating JS → fetch 변환 | 4-6시간 |
| 20. 누락 endpoint 보강 | 1-2시간 |
| 21. R01~R24 UI 제거 | 1시간 |
| 22. 회귀 + push | 30분 |
| **합계** | **22-27 시간 (3-4일)** |
