# DB 탐색기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ERP 의 의미있는 업무 테이블 ~20개를 OWNER/ADMIN 이 한 곳에서 **조회**하고, 도메인 로직 없는 설정성 4개 테이블(OrgOption·KanbanColumn·TenantSetting·Notice)은 **인라인 편집**하는 DB 탐색기. 서버 레지스트리가 보안 경계.

**Architecture:** 서버 레지스트리(`registry.ts`)가 화이트리스트(테이블·민감컬럼·편집필드·tenant스코핑)를 정의 → query 헬퍼가 Prisma DMMF 로 컬럼 자동 추출 + `prisma[model]` 동적 호출(안전컬럼 select·tenant 필터) → 3개 REST endpoint(`/api/db-explorer`) → 프로토타입 `db-admin.js` UI. 기존 `/api/data-explorer`(TransactionLedger)와 경로 분리.

**Tech Stack:** Next.js 14 · Prisma 5.22 (DMMF 런타임) · NextAuth · Vitest · 프로토타입 vanilla JS

**Spec:** `docs/superpowers/specs/2026-06-01-db-explorer-design.md`

---

## 사전 메모 (구현자 필독)

- 권한: **OWNER/ADMIN** = `requireMetaAdmin()` (from `@/lib/session`, = `isMetaAdmin` ADMIN/TENANT_OWNER). 읽기·쓰기 공통.
- action 반환은 이 기능에선 안 씀 — 직접 `prisma` + Response. 감사: `logAudit` from `@/lib/audit`.
- **Prisma DMMF**: `import { Prisma } from "@prisma/client"; Prisma.dmmf.datamodel.models` → 각 모델 `.name`(PascalCase) + `.fields[{name,kind,type,isList}]`. accessor(camelCase)=`name[0].toLowerCase()+name.slice(1)`.
- **민감컬럼**: `User.password` 만. registry `sensitiveFields` 로 select 자체에서 제외.
- **tenant 스코핑**: `public` 스키마 모델(User·AuditLog·OrgOption)만 `tenantId` 컬럼 보유 → 필터. `tenant_altibio` 모델은 스키마 격리(필터 불필요). registry `tenantScoped` 로 표기.
- **PK 주의**: 대부분 `id`. 단 **TenantSetting 은 `key`**. registry `pkField`.
- **KanbanColumn 필드 검증**: 스키마 확인 결과 `label·sortOrder·color`(+ id/createdAt 등). `isTerminal`/`key` 가 실제 존재하는지 `prisma/schema.prisma` 에서 재확인 후 editableFields 확정(없으면 제외, pk/참조필드는 편집 금지).
- 커밋: 한국어 ≤50자. 본문 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. push 금지.
- 로컬: Docker `rtbio-postgres` + `npm run dev`(현재 가동중 b8rj1hy0a).

---

## File Structure

**신규**
| 경로 | 책임 |
|---|---|
| `src/lib/db-explorer/registry.ts` | 테이블 정의 = 보안 경계 (whitelist) |
| `src/lib/db-explorer/registry.test.ts` | 레지스트리 정합성 테스트 |
| `src/lib/db-explorer/query.ts` | DMMF 컬럼추출 + queryTable/updateRow 헬퍼 |
| `src/lib/db-explorer/query.test.ts` | 헬퍼 단위 테스트(컬럼 추출·민감 제외) |
| `src/app/api/db-explorer/route.ts` | GET 테이블 목록 |
| `src/app/api/db-explorer/[table]/route.ts` | GET 테이블 조회 |
| `src/app/api/db-explorer/[table]/[id]/route.ts` | PATCH 편집 |
| `public/portals/js/db-admin.js` | 전체 테이블 브라우저 UI |
| `scripts/smoke-db-explorer.ts` | 실 DB 스모크 |

**수정**
| 경로 | 변경 |
|---|---|
| `public/portals/admin-portal.html` | 데이터 탐색기 페이지에 "전체 테이블" 섹션 + db-admin.js |
| `docs/02-design/api-reference.md` | DB 탐색기 섹션 |

---

## Phase A — 레지스트리 + query 헬퍼

### Task A1: registry.ts (TDD)

**Files:** `src/lib/db-explorer/registry.ts`, `src/lib/db-explorer/registry.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
import { describe, it, expect } from "vitest";
import { DB_TABLES, getTableDef, EDITABLE_KEYS } from "./registry";

describe("DB_TABLES registry", () => {
  it("has ~20 tables, all with pkField", () => {
    expect(DB_TABLES.length).toBeGreaterThanOrEqual(18);
    DB_TABLES.forEach((t) => { expect(t.pkField).toBeTruthy(); expect(t.model).toBeTruthy(); });
  });
  it("getTableDef looks up by key, undefined for unknown", () => {
    expect(getTableDef("order")?.label).toBeTruthy();
    expect(getTableDef("__nope__")).toBeUndefined();
  });
  it("User table excludes password via sensitiveFields", () => {
    expect(getTableDef("user")?.sensitiveFields).toContain("password");
    expect(getTableDef("user")?.tenantScoped).toBe(true);
  });
  it("only the 4 config tables are editable, each with editableFields", () => {
    const editable = DB_TABLES.filter((t) => t.editable).map((t) => t.key).sort();
    expect(editable).toEqual(["kanbanColumn", "notice", "orgOption", "tenantSetting"].sort());
    DB_TABLES.filter((t) => t.editable).forEach((t) => {
      expect(Object.keys(t.editableFields ?? {}).length).toBeGreaterThan(0);
    });
  });
  it("TenantSetting pk is key (not id)", () => {
    expect(getTableDef("tenantSetting")?.pkField).toBe("key");
  });
  it("non-editable tables have no editableFields", () => {
    DB_TABLES.filter((t) => !t.editable).forEach((t) => expect(t.editableFields).toBeUndefined());
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/db-explorer/registry.test.ts` → FAIL.

- [ ] **Step 3: 구현**
```ts
/**
 * DB 탐색기 보안 경계 — 화이트리스트 레지스트리.
 * 여기 정의된 테이블/컬럼/편집필드만 API 가 건드린다. 임의 모델/SQL 접근 불가.
 */
export type DbFieldType = "string" | "int" | "boolean" | "datetime";

export type DbTableDef = {
  key: string;            // url-safe (예: 'order')
  label: string;          // 한글
  model: string;          // Prisma accessor (camelCase, prisma[model])
  group: string;          // 메뉴 그룹
  pkField: string;        // 기본 'id', TenantSetting='key'
  tenantScoped: boolean;  // public 스키마 + tenantId 필터
  sensitiveFields: string[];
  searchFields: string[];
  defaultOrderBy: Record<string, "asc" | "desc">;
  editable: boolean;
  editableFields?: Record<string, DbFieldType>;
};

// 읽기 전용 정의 헬퍼 (장황함 축소)
function ro(
  key: string, label: string, model: string, group: string,
  opts: Partial<Pick<DbTableDef, "pkField" | "tenantScoped" | "sensitiveFields" | "searchFields" | "defaultOrderBy">> = {},
): DbTableDef {
  return {
    key, label, model, group,
    pkField: opts.pkField ?? "id",
    tenantScoped: opts.tenantScoped ?? false,
    sensitiveFields: opts.sensitiveFields ?? [],
    searchFields: opts.searchFields ?? [],
    defaultOrderBy: opts.defaultOrderBy ?? { createdAt: "desc" },
    editable: false,
  };
}

export const DB_TABLES: DbTableDef[] = [
  // 거래처
  ro("client", "거래처", "client", "거래처", { searchFields: ["name", "code"] }),
  ro("clientAddress", "거래처 배송지", "clientAddress", "거래처", { searchFields: ["label", "recipientName"] }),
  ro("clientDiscount", "거래처 할인율", "clientDiscount", "거래처", { searchFields: ["category"] }),
  ro("clientFixedPrice", "거래처 고정가", "clientFixedPrice", "거래처", {}),
  // 제품/재고
  ro("product", "제품", "product", "제품", { searchFields: ["name", "code"] }),
  ro("productSize", "제품 사이즈/재고", "productSize", "제품", { searchFields: ["sizeCode"] }),
  ro("expiryLot", "유통기한 로트", "expiryLot", "제품", { searchFields: ["lotNumber"], defaultOrderBy: { receivedAt: "desc" } }),
  // 주문/출고
  ro("order", "주문", "order", "주문", { searchFields: ["orderNumber"], defaultOrderBy: { orderDate: "desc" } }),
  ro("orderItem", "주문 품목", "orderItem", "주문", {}),
  ro("shipment", "출고", "shipment", "주문", {}),
  ro("shipmentAssignee", "출고 담당자", "shipmentAssignee", "주문", { defaultOrderBy: { assignedAt: "desc" } }),
  // 정산
  ro("invoice", "거래명세서", "invoice", "정산", { searchFields: ["invoiceNumber"], defaultOrderBy: { issueDate: "desc" } }),
  ro("invoiceItem", "명세서 품목", "invoiceItem", "정산", { defaultOrderBy: { id: "desc" } }), // createdAt 없음
  ro("payment", "수금", "payment", "정산", { defaultOrderBy: { paidAt: "desc" } }),
  ro("bankTransaction", "은행거래", "bankTransaction", "정산", {}),
  ro("closingLedger", "마감원장", "closingLedger", "정산", { searchFields: ["closingMonth"] }),
  // 영업
  ro("conference", "학회", "conference", "영업", { searchFields: ["name"] }),
  ro("salesContract", "판매계약", "salesContract", "영업", { searchFields: ["title"] }),
  ro("dataUsage", "데이터 사용량", "dataUsage", "영업", { searchFields: ["category"] }),
  // 기타 업무
  ro("udiReport", "UDI 보고", "udiReport", "기타", {}),
  ro("transactionLedger", "매입매출원장(41K)", "transactionLedger", "기타", { searchFields: ["clientName", "productName"], defaultOrderBy: { txnDate: "desc" } }),
  // 직원 (public 스키마, 민감)
  ro("user", "직원", "user", "시스템", { tenantScoped: true, sensitiveFields: ["password"], searchFields: ["name", "email"] }),

  // ── 편집 가능 (설정성 4개) ──
  {
    key: "orgOption", label: "부서·직급", model: "orgOption", group: "설정",
    pkField: "id", tenantScoped: true, sensitiveFields: [], searchFields: ["label"],
    defaultOrderBy: { sortOrder: "asc" }, editable: true,
    editableFields: { label: "string", sortOrder: "int", active: "boolean" },
  },
  {
    key: "kanbanColumn", label: "출고 단계", model: "kanbanColumn", group: "설정",
    pkField: "id", tenantScoped: false, sensitiveFields: [], searchFields: ["label"],
    defaultOrderBy: { sortOrder: "asc" }, editable: true,
    editableFields: { label: "string", sortOrder: "int", color: "string", isTerminal: "boolean" },
  },
  {
    key: "tenantSetting", label: "테넌트 설정", model: "tenantSetting", group: "설정",
    pkField: "key", tenantScoped: false, sensitiveFields: [], searchFields: ["key"],
    defaultOrderBy: { key: "asc" }, editable: true,
    editableFields: { value: "string", description: "string" },
  },
  {
    key: "notice", label: "공지", model: "notice", group: "설정",
    pkField: "id", tenantScoped: false, sensitiveFields: [], searchFields: ["title"],
    defaultOrderBy: { createdAt: "desc" }, editable: true,
    editableFields: { title: "string", body: "string", pinned: "boolean", expiresAt: "datetime" },
  },
];

export const EDITABLE_KEYS = DB_TABLES.filter((t) => t.editable).map((t) => t.key);

export function getTableDef(key: string): DbTableDef | undefined {
  return DB_TABLES.find((t) => t.key === key);
}
```

> **검증**: KanbanColumn 의 `defaultOrderBy: { sortOrder }` 와 user 의 `defaultOrderBy`(기본 createdAt) 등 각 모델에 해당 컬럼이 실제 있는지 확인(없으면 orderBy 를 존재 컬럼으로). orderItem/invoiceItem 등 createdAt 없으면 defaultOrderBy 조정.

- [ ] **Step 4: 통과** — `npx vitest run src/lib/db-explorer/registry.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/db-explorer/registry.ts src/lib/db-explorer/registry.test.ts
git commit -m "feat(db-explorer): 테이블 화이트리스트 레지스트리"
```

---

### Task A2: query.ts — DMMF 컬럼추출 + queryTable/updateRow (TDD on 컬럼추출)

**Files:** `src/lib/db-explorer/query.ts`, `src/lib/db-explorer/query.test.ts`

- [ ] **Step 1: 실패 테스트 (컬럼 추출 순수부)**
```ts
import { describe, it, expect } from "vitest";
import { getScalarColumns } from "./query";

describe("getScalarColumns (DMMF)", () => {
  it("returns scalar fields for a model, excludes sensitive + relations", () => {
    const cols = getScalarColumns("user", ["password"]);
    const names = cols.map((c) => c.name);
    expect(names).toContain("email");
    expect(names).toContain("role");         // ★ enum 컬럼 포함되어야 함 (가장 중요한 컬럼)
    expect(names).not.toContain("password"); // 민감 제외
    expect(names).not.toContain("tenant");   // relation 제외
  });
  it("includes enum columns (status/type) — not just String scalars", () => {
    expect(getScalarColumns("order", []).map((c) => c.name)).toContain("status");
    expect(getScalarColumns("client", []).map((c) => c.name)).toContain("type");
  });
  it("empty for unknown model", () => {
    expect(getScalarColumns("__nope__", [])).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/db-explorer/query.test.ts` → FAIL.

- [ ] **Step 3: 구현**
```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbTableDef, DbFieldType } from "./registry";

export type ColMeta = { name: string; type: string };

/** accessor(camelCase) → DMMF 모델 찾기 → scalar 필드(민감 제외) */
export function getScalarColumns(model: string, sensitive: string[]): ColMeta[] {
  const m = Prisma.dmmf.datamodel.models.find(
    (x) => x.name.charAt(0).toLowerCase() + x.name.slice(1) === model,
  );
  if (!m) return [];
  return m.fields
    // scalar + enum 포함 (status/role/type 같은 enum 이 빠지면 가장 중요한 컬럼이 사라짐).
    // relation(kind==='object')·list 는 제외.
    .filter((f) => (f.kind === "scalar" || f.kind === "enum") && !f.isList && !sensitive.includes(f.name))
    .map((f) => ({ name: f.name, type: f.type }));
}

function coerce(type: DbFieldType, v: unknown): unknown {
  if (v === null || v === undefined || v === "") return type === "string" ? "" : null;
  switch (type) {
    case "int": return Math.trunc(Number(v));
    case "boolean": return v === true || v === "true" || v === 1 || v === "1";
    case "datetime": return new Date(String(v));
    default: return String(v);
  }
}

/** 읽기 — 안전컬럼 select + tenant 필터 + 검색 + 페이지 */
export async function queryTable(
  def: DbTableDef,
  opts: { q?: string; limit: number; offset: number; tenantId: string | null },
) {
  const cols = getScalarColumns(def.model, def.sensitiveFields);
  const select = Object.fromEntries(cols.map((c) => [c.name, true]));
  const where: Record<string, unknown> = {};
  if (def.tenantScoped && opts.tenantId) where.tenantId = opts.tenantId;
  if (opts.q && def.searchFields.length) {
    where.OR = def.searchFields.map((f) => ({ [f]: { contains: opts.q, mode: "insensitive" } }));
  }
  const model = (prisma as unknown as Record<string, any>)[def.model];
  const [rows, total] = await Promise.all([
    model.findMany({ where, select, orderBy: def.defaultOrderBy, take: opts.limit, skip: opts.offset }),
    model.count({ where }),
  ]);
  return { rows, columns: cols, total };
}

/** 편집 — editable 테이블 + editableFields 만. tenant 가드. */
export async function updateRow(
  def: DbTableDef, id: string, patch: Record<string, unknown>, tenantId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!def.editable || !def.editableFields) return { ok: false, error: "편집할 수 없는 테이블입니다." };
  const data: Record<string, unknown> = {};
  for (const [field, ftype] of Object.entries(def.editableFields)) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) data[field] = coerce(ftype, patch[field]);
  }
  if (Object.keys(data).length === 0) return { ok: false, error: "변경할 필드가 없습니다." };

  const model = (prisma as unknown as Record<string, any>)[def.model];
  // 소유권/테넌트 가드 — pk + (tenantScoped ? tenantId)
  const findWhere: Record<string, unknown> = { [def.pkField]: id };
  if (def.tenantScoped && tenantId) findWhere.tenantId = tenantId;
  const existing = await model.findFirst({ where: findWhere, select: { [def.pkField]: true } });
  if (!existing) return { ok: false, error: "대상 행을 찾을 수 없습니다." };

  await model.update({ where: { [def.pkField]: id }, data });
  return { ok: true };
}
```

- [ ] **Step 4: 통과** — `npx vitest run src/lib/db-explorer/query.test.ts` → PASS. `npx tsc --noEmit` 클린.

- [ ] **Step 5: Commit**
```bash
git add src/lib/db-explorer/query.ts src/lib/db-explorer/query.test.ts
git commit -m "feat(db-explorer): DMMF 컬럼추출 + queryTable/updateRow 헬퍼"
```

---

## Phase B — API routes

### Task B1: GET 목록 + GET 테이블 + PATCH

**Files:** `src/app/api/db-explorer/route.ts`, `src/app/api/db-explorer/[table]/route.ts`, `src/app/api/db-explorer/[table]/[id]/route.ts`

- [ ] **Step 1: GET 목록 (`route.ts`)**
```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMetaAdmin } from "@/lib/team";
import { DB_TABLES } from "@/lib/db-explorer/registry";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!isMetaAdmin(session.user as any)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return Response.json(
    DB_TABLES.map((t) => ({ key: t.key, label: t.label, group: t.group, editable: t.editable })),
  );
}
```

- [ ] **Step 2: GET 테이블 (`[table]/route.ts`)**
```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMetaAdmin } from "@/lib/team";
import { getTableDef } from "@/lib/db-explorer/registry";
import { queryTable } from "@/lib/db-explorer/query";

type Ctx = { params: { table: string } };
export async function GET(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const u = session.user as { role: string; tenantId?: string | null };
  if (!isMetaAdmin(u)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const def = getTableDef(params.table);
  if (!def) return Response.json({ ok: false, error: "Unknown table" }, { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const q = url.searchParams.get("q") ?? undefined;

  const result = await queryTable(def, { q, limit, offset, tenantId: u.tenantId ?? null });
  return Response.json({ ok: true, ...result, editable: def.editable, editableFields: def.editableFields ?? null, pkField: def.pkField });
}
```

- [ ] **Step 3: PATCH (`[table]/[id]/route.ts`)**
```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMetaAdmin } from "@/lib/team";
import { logAudit } from "@/lib/audit";
import { getTableDef } from "@/lib/db-explorer/registry";
import { updateRow } from "@/lib/db-explorer/query";

type Ctx = { params: { table: string; id: string } };
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id: string; role: string; tenantId?: string | null };
  if (!isMetaAdmin(u)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const def = getTableDef(params.table);
  if (!def) return Response.json({ ok: false, error: "Unknown table" }, { status: 404 });
  if (!def.editable) return Response.json({ ok: false, error: "읽기 전용 테이블입니다." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const res = await updateRow(def, params.id, body, u.tenantId ?? null);
  if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 400 });

  logAudit({
    tenantId: u.tenantId ?? null, userId: u.id, action: "DB_EXPLORER_EDIT",
    resource: `${def.model}:${params.id}`, metadata: { table: def.key, fields: Object.keys(body) },
  });
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: tsc + curl** — `npx tsc --noEmit` 클린. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/db-explorer` → 307/401(라우트 존재). `npx vitest run` 전체 그린.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/db-explorer
git commit -m "feat(api): /api/db-explorer 목록·조회·편집 endpoint"
```

---

## Phase C — 스모크 + 프로토타입 UI

### Task C1: scripts/smoke-db-explorer.ts

**Files:** `scripts/smoke-db-explorer.ts`

- [ ] **Step 1: 스모크 작성** (smoke-users.ts 패턴) — 세션 우회, prisma+헬퍼 직접:
  1. `queryTable(getTableDef('user'), {limit:5,offset:0,tenantId:<altibio>})` → rows 의 어떤 행에도 `password` 키 없음 + tenant 필터됨.
  2. `queryTable(getTableDef('order'),...)` → columns 에 orderNumber 포함, rows 반환.
  3. `updateRow(getTableDef('order'), <someId>, {status:'X'}, tid)` → editable=false 라 `{ok:false}` (편집 거부).
  4. OrgOption 임시 행 생성 → `updateRow(getTableDef('orgOption'), id, {label:'__smoke_edit__'}, tid)` → ok, DB 반영 확인 → 정리.
  5. `updateRow(getTableDef('orgOption'), id, {kind:'JOB_TITLE'}, tid)` → kind 는 editableFields 아님 → 변경 안 됨(무시) 확인.
  Run: `npx tsx scripts/smoke-db-explorer.ts` → PASS, 잔여 0.

- [ ] **Step 2: Commit**
```bash
git add scripts/smoke-db-explorer.ts
git commit -m "test(smoke): db-explorer 읽기/편집 가드 검증"
```

---

### Task C2: db-admin.js + admin-portal 연결

**Files:** `public/portals/js/db-admin.js`, `public/portals/admin-portal.html`

> 참고 패턴: `public/portals/js/staff-mgmt.js` (`_esc`, `_staffSafeJson` 류 content-type 가드, fetch, 모달). 표는 `class="data-table"` 로 만들어 기존 `.table-scroll` 자동 래핑 + 가로 스크롤 활용.

- [ ] **Step 1: db-admin.js 작성**
  - `_dbSafeJson(r)` content-type 가드.
  - `loadDbTables()` → `GET /api/db-explorer` → 그룹별 테이블 피커 렌더(select 또는 좌측 리스트).
  - `renderDbTable(key, {q,offset})` → `GET /api/db-explorer/{key}?q=&limit=50&offset=` → `<table class="data-table">` 그리드(서버가 준 `columns` 자동 헤더, rows 셀 `_esc`). editable 면 행마다 "편집" 버튼. 페이지네이션(total 기반).
  - `editDbRow(key, id)` → 현재 행 값으로 모달(editableFields 만 입력, 타입별 input) → `PATCH /api/db-explorer/{key}/{id}` → toast + 재렌더.
  - 값 포맷: Decimal/숫자 toLocaleString, Date ISO slice, boolean ✓/✗. null → '-'.
  - `window.X` 노출.

- [ ] **Step 2: admin-portal.html 연결**
  - `<script src="/portals/js/db-admin.js"></script>` 추가(절대경로 — 클린 URL 대응).
  - 데이터 탐색기 페이지(page-data-explorer)에 "전체 테이블" 섹션/탭 추가: 테이블 피커 + `<div id="db-admin-grid">`. 진입 시 `loadDbTables()`.
  - metaAdmin 게이트: `['ADMIN','TENANT_OWNER'].includes(window.CURRENT_USER.role)` 아니면 섹션 숨김.

- [ ] **Step 3: node --check + 브라우저** — admin 로그인 → 데이터 탐색기 "전체 테이블" → 주문/직원 등 조회(직원에 password 컬럼 없음) → 표 가로 스크롤 → OrgOption 편집 반영. 일반 QC 는 섹션 안 보임.

- [ ] **Step 4: Commit**
```bash
git add public/portals/js/db-admin.js public/portals/admin-portal.html
git commit -m "feat(portal): DB 탐색기 전체 테이블 브라우저 + 설정성 편집"
```

---

## Phase D — 문서 + 회귀

### Task D1: api-reference + 전체 회귀/QA

- [ ] **Step 1: api-reference §DB 탐색기** — 3 endpoint(표) + 권한(metaAdmin) + 레지스트리 보안경계 + 민감컬럼 제외 + 편집 4테이블 명시. route 수 헤더 현재값+3.
- [ ] **Step 2: 회귀** — `npx tsc --noEmit` 클린 · `npx vitest run` 그린 · `npx tsx scripts/smoke-db-explorer.ts` PASS · `node --check public/portals/js/db-admin.js`.
- [ ] **Step 3: 브라우저 QA** (`Ctrl+Shift+R`):

| 검증 | 기대 |
|---|---|
| admin 데이터 탐색기 "전체 테이블" | 섹션 보임 / 일반 QC 안 보임 |
| 직원(User) 조회 | password 컬럼 없음, 본인 테넌트만 |
| 주문 조회 | 컬럼 자동 렌더 + 표만 가로 스크롤 |
| OrgOption "편집" → label 변경 | 반영 + 감사로그 |
| 주문(읽기전용) 편집 시도 | 편집 버튼 없음 / API 직접 PATCH → 403 |

- [ ] **Step 4: Commit**
```bash
git add docs/02-design/api-reference.md
git commit -m "docs(api): DB 탐색기 endpoint 추가"
```

---

## 완료 기준 (DoD)
- [ ] 레지스트리(보안경계) + DMMF 컬럼추출 + query/update 헬퍼, 단위테스트 그린
- [ ] 3 endpoint(목록/조회/편집), metaAdmin 게이트, tenant 스코핑, 민감컬럼 제외
- [ ] 편집은 4개 설정 테이블 + editableFields 만, 전건 감사
- [ ] 프로토타입 UI: 전체 테이블 브라우저 + 설정성 편집 + metaAdmin 게이트
- [ ] smoke + 회귀 그린

## 리스크 / 주의
1. **각 모델 defaultOrderBy/searchFields 컬럼 실재 확인** — 없는 컬럼이면 Prisma 런타임 에러. (리뷰 반영분: expiryLot→receivedAt · invoiceItem→id · shipmentAssignee→assignedAt · clientAddress→recipientName. 나머지도 schema 와 대조.)
6. **필수 컬럼 빈값 편집 가드** — `coerce` 가 빈 문자열을 string→`""`/그 외→`null` 로 변환. Notice.title/body, OrgOption.label 같은 NOT NULL 컬럼에 빈값 제출 시 컬럼이 비거나(string) update 실패(null). C2 편집 모달에서 필수 필드 빈값 제출 차단(클라 검증) + 서버는 에러 메시지 반환.
2. **KanbanColumn editableFields**(color/isTerminal) 실제 스키마 재확인.
3. **Decimal/BigInt 직렬화** — Prisma Decimal → JSON string. UI 가 number 변환/포맷.
4. **`prisma[model]` 동적 호출** — 반드시 registry 화이트리스트 key 로만 접근(getTableDef 통과분). 사용자 입력 table 문자열을 직접 prisma 에 넘기지 말 것.
5. **경로 분리 확인** — 기존 `/api/data-explorer`(TransactionLedger) 와 신규 `/api/db-explorer` 충돌 없음.
