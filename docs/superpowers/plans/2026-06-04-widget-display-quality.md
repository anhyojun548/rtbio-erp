# 위젯 표시 품질 정상화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위젯 엔진이 자동으로 사람이 읽는 라벨/컬럼을 내도록(groupBy id→이름, table 컬럼 큐레이션) + SalesContract 소스 추가 + 데이터 채우기 + 실무 prefab 보강 + 우클릭 "위젯 수정" 시 빌더가 현재 spec으로 프리필.

**Architecture:** 신규 순수-데이터 모듈 `display.ts`(LABEL_RESOLVERS/DISPLAY_COLUMNS)를 `execute.ts`가 읽어 groupBy 시리즈 라벨을 배치조회로 이름 해석하고 table 행을 큐레이트 컬럼으로 투영한다. SalesContract는 whitelist/delegate/catalog 확장. 빌더는 `fillFormFromSpec`(buildSpecFromForm 역방향)으로 편집 프리필.

**Tech Stack:** Next.js API routes, Prisma 5.22, Vitest, 바닐라 JS 프로토타입.

**Spec:** `docs/superpowers/specs/2026-06-04-widget-display-quality-design.md`

---

## 사전 지식 (구현자 필독)

**엔진 핵심 구조 (`src/lib/widget-spec/execute.ts`):**
- `executeWidgetSpec(spec, ctx)` 분기: groupBy 있으면 `runGroupBy`(차트 series), aggregate면 KPI value, 아니면 `findMany`+`serializeRows`(table rows).
- `runGroupBy`(L571): `delegate.groupBy({by, where, ...agg})` → `series = grouped.map(g => ({label: String(g[labelKey]), value}))`, `labelKey = groupBy[0]`. **여기 라벨이 cuid.**
- table 분기(L562): `findMany({where, orderBy, take})` → `serializeRows(rows)` (모든 키 그대로). **여기 원시 컬럼.**
- `prisma` 이미 import됨. `serializeValue`(L646: Date→ISO, Decimal→number) 재사용.
- delegate 맵(L83~105): source→`prisma.X`. whitelist 검증.
- rowLevel: `SOURCES_WITH_CLIENT_ID` set이 clientId 보유 소스 정의(L343).

**빌더(`public/portals/js/widget-builder.js`):**
- `buildSpecFromForm`(L302): 폼→spec. `_onSourceChange`(L171): 소스의 카탈로그 필드로 bAggType/bAggField/bGroupBy/bOrderField 채우고 필터행 초기화. `_addFilterRow`(L223): `.bf-field/.bf-op/.bf-tpl/.bf-val` 행. `_collectFilters`(L281): 행→`{field:{op:value}}`. `openBuilder`(L400), `saveBuilder`(L423)→`_saveSpec`+`addSpecWidgetToGrid`. `_TPL_OPTS`(L216).

**대시보드(`public/portals/js/widget-dashboard.js`):**
- 컨텍스트 edit(L907): `openEditModal(ctxTargetId)`(L938, title-only). `_specCache[widgetId]`=spec(L584). `addSpecWidgetToGrid`(L~710). `saveDashboard`(bulk 동기화, config.spec 영속).

**검증 규약:** `npx vitest run <file>` 단건, `npm test` 전체(현 607), `npx tsc --noEmit`. 프로토타입 JS는 `node --check` + 브라우저 dry-run. DB: `docker exec -i rtbio-postgres psql -U rtbio -d rtbio_erp`. 운영 토큰/`scripts/add-real-client-accounts.ts` 절대 커밋 금지.

---

# Phase 1 — 표시 품질 엔진

### Task 1: display.ts (표시 설정 레지스트리)

**Files:** Create `src/lib/widget-spec/display.ts` + `src/lib/widget-spec/display.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
import { describe, it, expect } from "vitest";
import { LABEL_RESOLVERS, getDisplayColumns, getValueByPath } from "./display";

describe("LABEL_RESOLVERS", () => {
  it("clientId → client.name 해석 메타", () => {
    expect(LABEL_RESOLVERS.clientId).toEqual({ model: "client", labelField: "name" });
  });
});
describe("getDisplayColumns", () => {
  it("정의된 소스는 컬럼 배열", () => {
    const cols = getDisplayColumns("order");
    expect(cols && cols.length).toBeGreaterThan(0);
    expect(cols![0]).toHaveProperty("field");
    expect(cols![0]).toHaveProperty("label");
  });
  it("미정의 소스는 null", () => { expect(getDisplayColumns("dataUsage")).toBeNull(); });
});
describe("getValueByPath", () => {
  it("dot 경로 해석", () => {
    expect(getValueByPath({ client: { name: "메디칼" } }, "client.name")).toBe("메디칼");
    expect(getValueByPath({ status: "ISSUED" }, "status")).toBe("ISSUED");
    expect(getValueByPath({}, "client.name")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/widget-spec/display.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: 구현** `display.ts`
```ts
/** ID 필드 → 참조 모델·라벨필드 (groupBy 라벨 해석용). prisma 모델 키 사용. */
export const LABEL_RESOLVERS: Record<string, { model: string; labelField: string }> = {
  clientId: { model: "client", labelField: "name" },
  productId: { model: "product", labelField: "name" },
};

/** 소스별 table 표시 컬럼(순서·한글 라벨; 관계는 dot). 미정의 소스는 폴백(원시 6컬럼). */
export const DISPLAY_COLUMNS: Record<string, Array<{ field: string; label: string }>> = {
  order: [
    { field: "orderNumber", label: "주문번호" }, { field: "client.name", label: "거래처" },
    { field: "status", label: "상태" }, { field: "orderDate", label: "주문일" },
  ],
  invoice: [
    { field: "invoiceNumber", label: "번호" }, { field: "client.name", label: "거래처" },
    { field: "status", label: "상태" }, { field: "totalAmount", label: "합계" },
    { field: "issueDate", label: "발행일" },
  ],
  payment: [
    { field: "client.name", label: "거래처" }, { field: "amount", label: "입금액" },
    { field: "status", label: "상태" }, { field: "paidAt", label: "입금일" },
  ],
  salesContract: [
    { field: "title", label: "계약명" }, { field: "client.name", label: "거래처" },
    { field: "startDate", label: "시작일" }, { field: "endDate", label: "종료일" },
    { field: "signed", label: "서명" },
  ],
  productSize: [
    { field: "product.name", label: "제품" }, { field: "sizeCode", label: "사이즈" },
    { field: "availableStock", label: "가용재고" }, { field: "reorderPoint", label: "안전재고" },
  ],
};

export function getDisplayColumns(source: string) {
  return DISPLAY_COLUMNS[source] ?? null;
}

/** dot 경로로 중첩 값 추출 (관계 컬럼). */
export function getValueByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

/** displayColumns 의 dot 컬럼들 → Prisma include (예: client.name → {client:{select:{name:true}}}). */
export function buildIncludeForColumns(
  cols: Array<{ field: string }>,
): Record<string, unknown> | undefined {
  const include: Record<string, { select: Record<string, true> }> = {};
  for (const { field } of cols) {
    const parts = field.split(".");
    if (parts.length === 2) {
      const [rel, sub] = parts as [string, string];
      include[rel] = include[rel] ?? { select: {} };
      include[rel].select[sub] = true;
    }
  }
  return Object.keys(include).length ? include : undefined;
}
```

- [ ] **Step 4: 통과** — Run: `npx vitest run src/lib/widget-spec/display.test.ts` → PASS. `npx tsc --noEmit` 클린.
- [ ] **Step 5: Commit** `git commit -m "feat(widget): 표시 설정 레지스트리 display.ts"`

### Task 2: execute.ts — groupBy 라벨 이름 해석

**Files:** Modify `src/lib/widget-spec/execute.ts` (`runGroupBy` L571-608); Test: `src/lib/widget-spec/execute-display.test.ts`

- [ ] **Step 1: 실패 테스트** (prisma 모킹 — groupBy + client.findMany)
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {
  invoice: { groupBy: vi.fn() }, client: { findMany: vi.fn() },
}}));
import { prisma } from "@/lib/prisma";
import { executeWidgetSpec } from "./execute";

beforeEach(() => vi.clearAllMocks());
it("groupBy clientId → 거래처명 라벨", async () => {
  (prisma.invoice.groupBy as any).mockResolvedValue([
    { clientId: "c1", _sum: { totalAmount: 100 } },
    { clientId: "c2", _sum: { totalAmount: 50 } },
  ]);
  (prisma.client.findMany as any).mockResolvedValue([
    { id: "c1", name: "메디칼" }, { id: "c2", name: "한빛" },
  ]);
  const r = await executeWidgetSpec(
    { version:"1.0", title:"x", kind:"hbar", data:{ source:"invoice", aggregate:{type:"sum",field:"totalAmount"}, groupBy:["clientId"] } } as any,
    { now: new Date(), userId:"u", role:"ADMIN" });
  expect(r.series!.map(s=>s.label)).toEqual(["메디칼","한빛"]);
  expect(prisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: { in: ["c1","c2"] } }, select: { id: true, name: true } }));
});
it("resolver 없는 groupBy(status)는 값 유지", async () => {
  (prisma.invoice.groupBy as any).mockResolvedValue([{ status:"ISSUED", _count: 3 }]);
  const r = await executeWidgetSpec(
    { version:"1.0", title:"x", kind:"bar", data:{ source:"invoice", groupBy:["status"] } } as any,
    { now: new Date(), userId:"u", role:"ADMIN" });
  expect(r.series![0].label).toBe("ISSUED");
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/widget-spec/execute-display.test.ts` → FAIL.

- [ ] **Step 3: 구현** — `import { LABEL_RESOLVERS } from "./display";` 추가. `runGroupBy` 의 series 생성 직후(L601 이후, sort 전), 라벨 해석:
```ts
  // 라벨 해석: groupBy 필드가 ID면 참조 모델에서 이름 배치 조회
  const resolver = LABEL_RESOLVERS[labelKey];
  if (resolver) {
    const ids = series.map((s) => s.label).filter((x) => x && x !== "—");
    if (ids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refs = (await (prisma as any)[resolver.model].findMany({
        where: { id: { in: ids } },
        select: { id: true, [resolver.labelField]: true },
      })) as Array<Record<string, unknown>>;
      const nameById = new Map(refs.map((r) => [String(r.id), String(r[resolver.labelField] ?? r.id)]));
      series = series.map((s) => ({ ...s, label: nameById.get(s.label) ?? s.label }));
    }
  }
```
(`series` 를 `let` 으로 — 이미 `let series` L595. sort/slice 는 그 뒤 유지.)

- [ ] **Step 4: 통과** — Run: `npx vitest run src/lib/widget-spec/execute-display.test.ts` → PASS. `npx tsc --noEmit` 클린.
- [ ] **Step 5: Commit** `git commit -m "feat(widget): groupBy 라벨 id→이름 해석"`

### Task 3: execute.ts — table 컬럼 큐레이션

**Files:** Modify `src/lib/widget-spec/execute.ts` (table 분기 L562-567 + 신규 `curateRows`); Test: 같은 `execute-display.test.ts` 추가

- [ ] **Step 1: 실패 테스트 추가**
```ts
it("table 위젯은 displayColumns 로 큐레이트 + 관계 이름", async () => {
  vi.mocked((prisma as any).order = { findMany: vi.fn() });
  ((prisma as any).order.findMany as any).mockResolvedValue([
    { id:"o1", orderNumber:"ORD-1", clientId:"c1", client:{name:"메디칼"}, status:"COMPLETED", orderDate:new Date("2026-06-01T00:00:00Z"), note:"x", billingMonth:"2026-06" },
  ]);
  const r = await executeWidgetSpec(
    { version:"1.0", title:"x", kind:"table", data:{ source:"order", limit:5 } } as any,
    { now: new Date(), userId:"u", role:"ADMIN" });
  expect(Object.keys(r.rows![0])).toEqual(["주문번호","거래처","상태","주문일"]);
  expect(r.rows![0]["거래처"]).toBe("메디칼");
  expect((prisma as any).order.findMany).toHaveBeenCalledWith(expect.objectContaining({
    include: { client: { select: { name: true } } } }));
});
```

- [ ] **Step 2: 실패 확인** → FAIL (현재는 원시 키 반환).

- [ ] **Step 3: 구현** — `import { getDisplayColumns, getValueByPath, buildIncludeForColumns } from "./display";`. table 분기(L562) 교체:
```ts
  // ── (C) aggregate 없음 → 행 목록 (table/list) ──────────
  const cols = getDisplayColumns(source);
  if (cols) {
    const include = buildIncludeForColumns(cols);
    const rawRows = (await delegate.findMany({
      where, orderBy: buildOrderBy(spec.data.orderBy), take: limit ?? 50,
      ...(include ? { include } : {}),
    })) as Record<string, unknown>[];
    const rows = rawRows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const { field, label } of cols) out[label] = serializeValue(getValueByPath(row, field));
      return out;
    });
    return { kind: spec.kind, rows };
  }
  const rows = (await delegate.findMany({
    where, orderBy: buildOrderBy(spec.data.orderBy), take: limit ?? 50,
  })) as Record<string, unknown>[];
  return { kind: spec.kind, rows: serializeRows(rows) };
```

- [ ] **Step 4: 통과** — Run: `npx vitest run src/lib/widget-spec/execute-display.test.ts` → PASS. `npm test`(607+ 통과) + `npx tsc --noEmit` 클린.
- [ ] **Step 5: Commit** `git commit -m "feat(widget): table 컬럼 큐레이션+관계 이름"`

---

# Phase 2 — SalesContract 소스

### Task 4: salesContract whitelist + delegate + catalog + display

**Files:** Modify `schema.ts`, `execute.ts`, `data-catalog/route.ts` (display.ts 컬럼은 Task1에 이미 포함)

- [ ] **Step 1: schema.ts** — `WIDGET_SOURCES` 배열에 `"salesContract", // 판매계약` 추가(`conference` 뒤).
- [ ] **Step 2: execute.ts delegate 맵** — `case "salesContract": return prisma.salesContract as unknown as AnyDelegate;` 추가. 그리고 `SOURCES_WITH_CLIENT_ID` set에 `"salesContract"` 추가(clientId 보유 → rowLevel).
- [ ] **Step 3: data-catalog/route.ts** — `DATA_CATALOG` 에 항목:
```ts
  salesContract: {
    label: "판매 계약",
    fields: {
      title: { type: "string", desc: "계약명" },
      startDate: { type: "date", desc: "시작일" },
      endDate: { type: "date", desc: "종료일" },
      signed: { type: "boolean", desc: "서명 여부" },
      "client.name": { type: "string", desc: "거래처명" },
    },
    note: "만료 임박 = endDate gte {{now.startOfDay}} lte {{now.startOfDay.plus(30,'day')}}. count 또는 endDate asc table.",
  },
```
- [ ] **Step 4: 검증** — `npx tsc --noEmit` 클린. dev 재기동 후 `GET /api/dashboard/data-catalog` 에 salesContract 포함(브라우저/curl). salesContract dryRun(count, endDate 필터) 동작.
- [ ] **Step 5: Commit** `git commit -m "feat(widget): SalesContract 소스 추가(whitelist/delegate/catalog)"`

### Task 5: presets — 계약 위젯 소스 수정 + 신규 prefab

**Files:** Modify `src/lib/widget-spec/presets.ts`

- [ ] **Step 1: 계약 2종 소스 교체** — `kpi_expiring_contracts` 와 `list_ending_contracts` 의 `source: "conference"` → `source: "salesContract"`. 필터(endDate gte/lte)·orderBy 그대로. 주석의 "근사" 문구 갱신. ※ endDate gte/lte 필터는 **endDate=null(무기한) 계약을 자동 제외**한다 — "만료 임박"엔 정상(버그 아님), 주석에 명시.
- [ ] **Step 2: 신규 prefab 3종 추가** (`RAW_PREFABS` 에):
```ts
  kpi_daily_sales: { version:"1.0", title:"오늘 매출", kind:"kpi", layout:{w:3,h:2},
    data:{ source:"invoice", filter:{ status:{in:["ISSUED","SENT"]}, issueDate:{ gte:"{{now.startOfDay}}" } }, aggregate:{type:"sum",field:"totalAmount"} },
    format:{ value:{type:"currency",prefix:"₩",compact:true} }, style:{icon:"🗓️",color:"#1B3A5C"}, action:{type:"navigate",to:"/admin/invoices"} },
  kpi_weekly_sales: { version:"1.0", title:"주간 매출(최근 7일)", kind:"kpi", layout:{w:3,h:2},
    data:{ source:"invoice", filter:{ status:{in:["ISSUED","SENT"]}, issueDate:{ gte:"{{now.minus(7,'day')}}" } }, aggregate:{type:"sum",field:"totalAmount"} },
    format:{ value:{type:"currency",prefix:"₩",compact:true} }, style:{icon:"📈",color:"#1B3A5C"}, action:{type:"navigate",to:"/admin/invoices"} },
  kpi_received: { version:"1.0", title:"이번 달 수금", kind:"kpi", layout:{w:3,h:2},
    data:{ source:"payment", filter:{ status:{in:["PARTIAL","PAID"]}, paidAt:{ gte:"{{now.startOfMonth}}", lt:"{{now.startOfMonth.plus(1,'month')}}" } }, aggregate:{type:"sum",field:"amount"} },
    format:{ value:{type:"currency",prefix:"₩",compact:true} }, style:{icon:"💵",color:"#047857"}, action:{type:"navigate",to:"/admin/payments"} },
```
- [ ] **Step 3: 통과** — `npx vitest run`(presets parse — prefab 정의 오류 시 모듈 로드에서 throw). `npm test` 전체 통과. `npx tsc --noEmit`.
- [ ] **Step 4: Commit** `git commit -m "feat(widget): 계약 위젯 소스 정상화 + 일/주매출·수금 prefab"`

---

# Phase 3 — 데이터 채우기

### Task 6: reorderPoint 시드 + 실DB

**Files:** Modify `prisma/seed.ts`

- [ ] **Step 1: 시드 확인/보강** — `prisma/seed.ts` 는 **이미** 사이즈에 `reorderPoint: 20`(L191 부근) 부여한다. 따라서 fresh 시드는 정상. **실제 빈 곳은 41K-파생 교체 데이터가 들어간 live DB 뿐**이다. 시드 코드는 그대로 두거나(이미 충족) 값만 점검. (별도 추가 코드 불필요 — 핵심은 Step 2의 live DB UPDATE.)
- [ ] **Step 2: 실DB 적용**(핵심 — live DB의 누락 보정. 시드 전체 재실행은 위험 → 직접 UPDATE):
```bash
docker exec -i rtbio-postgres psql -U rtbio -d rtbio_erp -c "UPDATE tenant_altibio.\"ProductSize\" SET \"reorderPoint\"=80 WHERE \"reorderPoint\" IS NULL OR \"reorderPoint\"=0;"
```
- [ ] **Step 3: 확인** — kpi_low_stock dryRun > 0 (classifyStock 후처리 전이라 reorderPoint>0 모집단 수). `SELECT count(*) FROM tenant_altibio."ProductSize" WHERE "reorderPoint">0;` > 0.
- [ ] **Step 4: Commit** `git commit -m "feat(widget): reorderPoint 시드 — 재고 알림 데이터"`

### Task 7: 원장 재계산 (미수금 실DB)

**Files:** 없음 — 실DB 작업(스크립트/액션 호출)

- [ ] **Step 1: 현재월 원장 재계산** — `recomputeLedgerMonth` 액션을 현재월(`YYYY-MM`)로 실행. 방법: `scripts/` 에 일회성 `tsx` 스니펫 또는 기존 `/admin/ledger` "이달 일괄 재계산" 버튼(브라우저). (스크립트는 커밋 불필요/금지 대상 아님 — 일회성이면 실행만.)
- [ ] **Step 2: 확인** — `kpi_total_ar` dryRun > 0 (또는 원장 balance 합 확인). `SELECT sum(balance) FROM tenant_altibio."ClosingLedger" WHERE "closingMonth"=to_char(CURRENT_DATE,'YYYY-MM');`
- [ ] **Step 3:** (커밋 없음 — 데이터 작업)

---

# Phase 4 — 빌더 편집 프리필

### Task 8: fillFormFromSpec + 편집모드 openBuilder

**Files:** Modify `public/portals/js/widget-builder.js`

- [ ] **Step 1: `fillFormFromSpec(spec)`** 구현 (`buildSpecFromForm` 역방향). 순서 중요:
  1. `_setVal('bSource', spec.data.source)` → `_onSourceChange()` (필드 옵션 채움 + 필터행 초기화)
  2. `_setVal('bKind', spec.kind)` → `_onKindChange()` (측정/분류 표시제어)
  3. aggregate: `_setVal('bAggType', spec.data.aggregate?.type||'')`, `_setVal('bAggField', spec.data.aggregate?.field||'')`
  4. groupBy: `_setVal('bGroupBy', (spec.data.groupBy&&spec.data.groupBy[0])||'')`
  5. orderBy/limit: `_setVal('bOrderField', spec.data.orderBy?.[0]?.field||'')`, `bOrderDir`, `bLimit`
  6. title: `_setVal('bTitle', spec.title||'')`
  7. 필터행 재구성: `spec.data.filter` 의 각 field×op → `_addFilterRow()` 후 마지막 행의 `.bf-field/.bf-op/.bf-val`(+배열은 콤마조인, 템플릿 `{{...}}`면 `.bf-tpl` 세팅+val disable) 채움.
  (`_setVal(id,v)` = element.value=v; 헬퍼 추가.)
- [ ] **Step 2: `openBuilder(editSpec, editWidgetId)`** 확장 — 인자 있으면 모듈 변수 `_editingWidgetId=editWidgetId` 세팅하고 `_onSourceChange()` 대신 `fillFormFromSpec(editSpec)` 호출, 제목 영역에 "위젯 수정" 표기(선택). 없으면 기존(신규) 동작 + `_editingWidgetId=null`.
- [ ] **Step 3: `window.openBuilderForEdit(widgetId)`** export — `var spec=(window._specCache||{})[widgetId]; if(spec) openBuilder(spec, widgetId); else window.showToast('스펙을 찾을 수 없습니다');`. ensureCatalog 먼저 보장.
- [ ] **Step 4: `node --check`** + 브라우저: 콘솔에서 `window.openBuilderForEdit(<id>)` → 빌더가 해당 위젯 설정으로 채워져 열림 확인.
- [ ] **Step 5: Commit** `git commit -m "feat(widget): 빌더 편집 프리필 fillFormFromSpec"`

### Task 9: saveBuilder 편집모드 → 위젯 갱신

**Files:** Modify `public/portals/js/widget-builder.js`; Modify `public/portals/js/widget-dashboard.js`

- [ ] **Step 1: widget-dashboard.js `window.updateSpecWidget(widgetId, spec)`** 신규:
```js
function updateSpecWidget(widgetId, spec) {
  // widgetId 는 DB spec id (gs-id=widget-N 아님) → dataset.widgetId 로 그리드 아이템 탐색
  var el = Array.from(document.querySelectorAll('.grid-stack-item')).find(function(e){return e.dataset.widgetId===widgetId;});
  if (!el) return;
  window._specCache = window._specCache || {}; window._specCache[widgetId] = spec;
  el.dataset.widgetTitle = spec.title;
  var t = el.querySelector('.widget-title'); if (t) t.textContent = spec.title;
  // 즉시 재렌더(dry-run) + 영속(bulk)
  var body = el.querySelector('.widget-body');
  if (body) fetch('/api/dashboard/widgets/spec',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({spec:spec,dryRunOnly:true})})
    .then(function(r){return r.json();}).then(function(j){ if(j&&j.ok) window.renderSpecResult(body,{ok:true,result:j.preview,kind:spec.kind,title:spec.title,subtitle:spec.subtitle,format:spec.format,style:spec.style}); });
  saveDashboard();
}
```
+ `window.updateSpecWidget = updateSpecWidget;` export.
- [ ] **Step 2: widget-builder.js `saveBuilder`** — `_editingWidgetId` 있으면 신규생성 대신: `window.updateSpecWidget(_editingWidgetId, buildSpecFromForm())` → closeBuilder + toast("수정됨") + `_editingWidgetId=null`. 없으면 기존(생성) 경로.
- [ ] **Step 3: `node --check` 양쪽.** 브라우저: 편집 → 저장 → 위젯 즉시 갱신 + 새로고침 후에도 유지(DB 영속).
- [ ] **Step 4: Commit** `git commit -m "feat(widget): 빌더 편집 저장 → 위젯 갱신"`

### Task 10: 컨텍스트 메뉴 "위젯 수정" → 빌더 연결

**Files:** Modify `public/portals/js/widget-dashboard.js` (L907 edit action)

- [ ] **Step 1: edit 액션 변경** — `else if (action === 'edit') { ... }` 를:
```js
} else if (action === 'edit') {
  var elx = document.querySelector('[gs-id="' + ctxTargetId + '"]');
  var wid = elx && elx.dataset.widgetId;
  if (wid && window._specCache && window._specCache[wid] && window.openBuilderForEdit) {
    window.openBuilderForEdit(wid);
  } else {
    openEditModal(ctxTargetId); // 폴백: 제목만(레거시/비-spec)
  }
}
```
- [ ] **Step 2: `node --check`.** 브라우저 E2E: 위젯 우클릭 → "위젯 수정" → 빌더가 현재 소스·집계·필터·제목으로 채워져 열림 → 필터 추가/제목 변경 → 저장 → 반영·유지.
- [ ] **Step 3: Commit** `git commit -m "feat(widget): 우클릭 위젯 수정 → 빌더 프리필 연결"`

---

# Phase 5 — 검증

### Task 11: 전체 회귀 + 브라우저 재실측

- [ ] **Step 1: 회귀** — `npm test`(607+신규 통과), `npx tsc --noEmit` 클린.
- [ ] **Step 2: prefab 13종 dry-run 재실측**(브라우저 JS, admin 세션): `/widget-schema` examples 전부 dryRun → **cuid 라벨·원시컬럼 사라짐**(Top거래처=이름, 최근주문=4컬럼 한글), **계약 위젯이 salesContract 조회**(데이터 있으면 표시), 재고/미수금 데이터 채움 후 값 표시.
- [ ] **Step 3: 편집 프리필 E2E** — 갤러리에서 "Top 5 거래처" 추가 → 우클릭 수정 → 빌더에 invoice/sum totalAmount/groupBy clientId/필터가 채워져 있는지 확인 → limit 5→8 변경·저장 → 반영.
- [ ] **Step 4: 5포털 회귀** — exec/ceo/qc 대시보드도 갤러리/빌더/편집 정상(공유 파일).
- [ ] **Step 5: Commit**(잔여) + api-reference 갱신 `git commit -m "docs/test: 위젯 표시품질 검증 + api-reference 갱신"`

---

## 검증 체크리스트 (완료 기준)
- [ ] groupBy 위젯 라벨이 이름(거래처명 등), table 위젯이 한글 큐레이트 컬럼
- [ ] 계약 위젯 2종이 SalesContract 조회(학회 아님)
- [ ] 재고·미수금 위젯 데이터 표시(reorderPoint/원장 채운 뒤)
- [ ] 신규 prefab(일/주 매출·수금) dry-run 값 정상
- [ ] 우클릭 "위젯 수정" → 빌더가 현재 spec으로 프리필 + 편집·저장·유지
- [ ] 빌더로 만든 표/그룹 위젯도 자동 이름/컬럼(동일 엔진)
- [ ] 회귀: 기존 vitest + tsc 클린

## 범위 밖 (후속)
시드 현재날짜 앵커링 · 제품별매출/시계열(OrderItem+버킷) · 담당자별(salesRep)/목표 · spec.columns 명시 override + 빌더 컬럼 UI.

## 리스크
- groupBy 라벨 배치조회: in 절 1회(N+1 아님). table include: 정의된 관계만 정확히 include.
- 편집 저장의 bulk 동기화는 deleteMany→create 로 id 재발급 → 즉시 재렌더는 dry-run 으로 처리(저장은 영속). `_resyncSpecWidgetIds` 가 새 id 매핑.
- salesContract rowLevel: clientId 보유 확인됨(CLIENT 격리 정상).
