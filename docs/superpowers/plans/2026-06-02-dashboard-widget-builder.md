# 대시보드 위젯 갤러리 + 빌더 + Flowise 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 완비된 위젯 spec 엔진 위에 실데이터 갤러리(A)·빌더(B)를 붙이고, 외부 Flowise 에이전트가 자연어로 위젯을 생성(C)하도록 토큰 인증 + API 문서를 제공한다.

**Architecture:** 세 입력(갤러리 클릭 / 빌더 폼 / Flowise LLM)이 모두 같은 `WidgetSpec` JSON 을 만들어 동일 파이프라인(`POST /api/dashboard/widgets/spec` → 검증 + `dryRunOnly` 미리보기 + 저장 → `executeWidgetSpec` 렌더)을 탄다. 백엔드 엔진은 이미 존재하므로 A·B 는 프로토타입 프론트(`widget-dashboard.js`/`.html`)를 엔진에 배선하는 작업이고, C 는 `src/middleware.ts` 에 토큰 게이트 + 서비스 세션 브리지를 추가하는 작업이다.

**Tech Stack:** Next.js 14 (App Router, Edge middleware), NextAuth v4 (JWT), Prisma 5.22, 바닐라 JS 프로토타입(GridStack + Chart.js), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-02-dashboard-widget-builder-design.md`

---

## 사전 지식 (구현자가 반드시 알 것)

**이미 존재하는 백엔드 (수정 금지, 재사용만):**
- `src/lib/widget-spec/schema.ts` — `widgetSpecSchema`, `validateWidgetSpec(input)`, 상수 `WIDGET_SOURCES`/`WIDGET_KINDS`/`FILTER_OPERATORS`/`AGGREGATE_TYPES`.
- `src/lib/widget-spec/execute.ts` — `executeWidgetSpec(spec, ctx)`, `ctx = {now, userId, role, clientId?}`. 반환 `WidgetResult = {kind, value?, series?, rows?, comparison?}`.
- `src/lib/widget-spec/presets.ts` — `PREFAB_SPECS: Record<string, WidgetSpec>`(검증된 10종), `PREFAB_KEYS`.
- `GET /api/dashboard/data-catalog` — `{ok, catalog:{[source]:{label, fields:{[name]:{type, agg?, values?, desc}}, note?}}, operators, aggregates, templateVars, kinds}`.
- `GET /api/dashboard/widget-schema` — `{ok, structure, operators, aggregates, kinds, examples: PREFAB_SPECS, tips}`.
- `POST /api/dashboard/widgets/spec` — body `{spec}` 또는 `{spec, dryRunOnly:true}`. 성공: `{ok:true, id?, spec, preview}`. 검증실패: 400 `{ok:false, validationErrors:[{path,message,hint}]}`. dry-run실패: 400 `{ok:false, error, hint}`.

**프로토타입 프론트 (수정 대상):**
- `public/portals/js/widget-dashboard.js` (1770줄) — GridStack 그리드, 저장/로드(`saveDashboard`/`loadDashboard`/`_applyItemsToGrid`), **spec 렌더러 이미 존재**: `renderSpecWidget(elId, widgetId)`, `_renderSpecKpi`, `_renderSpecChart`, `_renderSpecTable`, `_renderSpecGauge`, `_fmtSpecValue`. 그리드는 이미 spec 위젯 지원(`dataset.widgetSpec='1'`, `dataset.widgetId`, `window._specCache`).
- `public/portals/widget-dashboard.html` — `#pickerOverlay`(갤러리 자리), `#editOverlay`(편집/옛 커스텀 빌더), `#gridStack`, `#btnAddWidget`.
- 제거 대상(레거시 MOCK): `PRESETS`, `MOCK`, `PREVIEW_DATA`, `TABLE_COLUMNS`, `addEmptyWidget`, 편집모달의 custom 섹션.

**인증 구조 (C 관련):**
- `src/middleware.ts` — Edge. `getToken({req, secret})` 로 세션 JWT 확인 → 미인증 시 `/login` redirect. matcher 가 `/api/*` 포함.
- `src/lib/auth.ts` — JWT 전략. 토큰 payload: `{userId, role, tenantId, tenantCode, clientId, isTeamAdmin}`. `getAuthSecret()` from `@/lib/auth-secret`.
- API 라우트들은 `getServerSession(authOptions)` 로 세션 확인 → 없으면 401.
- **핵심 아이디어**: 미들웨어가 유효 Bearer 토큰을 보면 서비스 유저용 NextAuth JWT 를 `encode` 로 만들어 요청 쿠키에 주입 → 다운스트림 `getServerSession` 이 정상 세션으로 인식 → 라우트 개별 개조 불필요.

**검증 규약:**
- `src/` 변경 → `npm test`(기존 362 통과 유지) + `npx tsc --noEmit`.
- 프로토타입 JS → 브라우저 스모크(이 코드베이스의 확립된 패턴, 단위테스트 없음).
- DB 필요 시 `docker exec -i rtbio-postgres psql -U rtbio -d rtbio_erp`.

---

# Phase A — 큐레이트 갤러리

목표: "➕ 위젯 추가" → prefab spec 카드 → 클릭 → 실데이터 위젯. "빈 위젯" 함정 제거.

### Task A1: spec 렌더러를 빌더가 재사용하도록 window 노출

**Files:**
- Modify: `public/portals/js/widget-dashboard.js` (IIFE 내부 `window.*` export 블록, 현재 line ~1310)

`renderSpecWidget` 은 `widgetId` 로 `/data/route` 를 fetch 한다. 빌더 미리보기는 **이미 받은 result 를 직접 그려야** 하므로, result→DOM 헬퍼가 필요하다. 기존 `renderSpecWidget` 내부의 `switch(kind)` 분기를 `renderSpecResult(el, payload)` 로 추출한다.

- [ ] **Step 1: `renderSpecResult(el, payload)` 추출**

`renderSpecWidget` 안의 `switch (kind) { case 'kpi': ... }` 블록을 별도 함수로 빼고, `renderSpecWidget` 은 fetch 후 `renderSpecResult(el, payload)` 를 호출하도록 변경.

```js
// payload = { ok, result:{kind,value?,series?,rows?,comparison?}, kind?, title?, subtitle?, format?, style? }
function renderSpecResult(el, payload) {
  var result = payload.result || {};
  var kind = result.kind || payload.kind;
  switch (kind) {
    case 'kpi':   _renderSpecKpi(el, result, payload); break;
    case 'gauge': _renderSpecGauge(el, result.value, payload.style, payload.format); break;
    case 'table': _renderSpecTable(el, result.rows); break;
    case 'bar': case 'hbar': case 'line': case 'pie': case 'donut':
      _renderSpecChart(el, kind, result.series, payload.style); break;
    default:
      el.innerHTML = '<div class="kpi-desc">알 수 없는 위젯 종류: ' + _escapeHtml(kind) + '</div>';
  }
}
```

- [ ] **Step 2: window 노출 추가**

`window.*` export 블록에:
```js
window.renderSpecResult = renderSpecResult;
window.addSpecWidgetToGrid = addSpecWidgetToGrid; // Task A3 에서 정의
window._WIDGET = { COLORS: COLORS }; // 빌더가 색상 토큰 참조
```

- [ ] **Step 3: tsc 무관(JS), 브라우저 콘솔에서 `window.renderSpecResult` 존재 확인**

Run: 브라우저 devtools → `typeof window.renderSpecResult` → `"function"`. `/exec` 또는 `/ceo` 대시보드 기존 위젯이 여전히 정상 렌더(회귀 없음) 확인.

- [ ] **Step 4: Commit**
```bash
git add public/portals/js/widget-dashboard.js
git commit -m "refactor(widget): spec 결과 렌더러 renderSpecResult 추출+노출"
```

### Task A2: 갤러리 모달 — prefab spec 카드 렌더

**Files:**
- Create: `public/portals/js/widget-builder.js`
- Modify: `public/portals/widget-dashboard.html` (스크립트 태그 추가, `#pickerOverlay` 교체)

- [ ] **Step 1: HTML — 갤러리 컨테이너로 교체**

`#pickerOverlay` 내부의 `#presetList`/`#widgetTypeGrid` 두 섹션을 제거하고 단일 갤러리 그리드 + "직접 만들기" 버튼으로 교체:
```html
<div class="picker-overlay" id="pickerOverlay">
  <div class="picker-modal">
    <div class="picker-header">
      <h2>위젯 추가</h2>
      <button class="picker-close" id="pickerClose">✕</button>
    </div>
    <div class="picker-section">
      <div class="picker-section-head">
        <h3>갤러리에서 선택</h3>
        <button class="tb-btn primary" id="btnOpenBuilder">+ 직접 만들기</button>
      </div>
      <div class="gallery-grid" id="galleryGrid"><div class="gallery-loading">불러오는 중…</div></div>
    </div>
  </div>
</div>
```
그리고 `<body>` 끝 스크립트에 `widget-dashboard.js` **앞에** 로드:
```html
<script src="/portals/js/widget-builder.js"></script>
```
(주의: `widget-dashboard.js` 가 `window.addSpecWidgetToGrid` 등을 정의하므로 builder 는 호출 시점에 `window.*` 를 참조 — 로드 순서는 무관하나 함수는 DOMContentLoaded 이후 호출)

- [ ] **Step 2: widget-builder.js — 갤러리 fetch + 렌더**

```js
(function () {
'use strict';
var _catalog = null;       // data-catalog 캐시 (B 에서 사용)
var _galleryCache = null;  // widget-schema.examples 캐시

async function loadGallery() {
  var grid = document.getElementById('galleryGrid');
  try {
    var r = await fetch('/api/dashboard/widget-schema', { credentials: 'same-origin' });
    var j = await r.json();
    _galleryCache = (j && j.examples) || {};
    var keys = Object.keys(_galleryCache);
    if (!keys.length) { grid.innerHTML = '<div class="gallery-loading">갤러리가 비어 있습니다</div>'; return; }
    grid.innerHTML = keys.map(function (key) {
      var spec = _galleryCache[key];
      return '<button class="gallery-card" data-key="' + key + '">' +
        '<span class="gallery-card-kind">' + _kindLabel(spec.kind) + '</span>' +
        '<span class="gallery-card-title">' + _esc(spec.title) + '</span>' +
        '<span class="gallery-card-sub">' + _esc(spec.subtitle || _sourceLabel(spec.data && spec.data.source)) + '</span>' +
        '</button>';
    }).join('');
    grid.querySelectorAll('.gallery-card').forEach(function (btn) {
      btn.addEventListener('click', function () { addFromGallery(btn.dataset.key); });
    });
  } catch (e) {
    grid.innerHTML = '<div class="gallery-loading">갤러리 로드 실패</div>';
  }
}
// _kindLabel/_sourceLabel/_esc: 간단 헬퍼 (kind→한글, source→한글, html escape)
```

- [ ] **Step 3: 갤러리 오픈 시 1회 로드**

`#btnAddWidget` 클릭(openPicker) 시 `_galleryCache` 가 null 이면 `loadGallery()` 호출. (widget-dashboard.js 의 openPicker 가 `window.onPickerOpen?.()` 훅을 호출하도록 1줄 추가하고, builder 가 그 훅에 loadGallery 등록.)

- [ ] **Step 4: 브라우저 — 갤러리에 카드 10개 표시 확인** (아직 클릭 동작은 A3)

- [ ] **Step 5: Commit**
```bash
git add public/portals/js/widget-builder.js public/portals/widget-dashboard.html
git commit -m "feat(widget): 갤러리 모달 — prefab spec 카드 렌더"
```

### Task A3: 갤러리 카드 클릭 → spec 저장 + 그리드 추가

**Files:**
- Modify: `public/portals/js/widget-dashboard.js` (`addSpecWidgetToGrid` 신규)
- Modify: `public/portals/js/widget-builder.js` (`addFromGallery`)

- [ ] **Step 1: widget-dashboard.js — `addSpecWidgetToGrid(spec, savedId)`**

기존 `_applyItemsToGrid` 의 spec 분기를 단건 추가로 재사용. spec 위젯 1개를 그리드에 추가하고 `renderSpecWidget(bodyId, savedId)` 로 렌더, dataset 세팅(`widgetSpec='1'`, `widgetId=savedId`), `_specCache[savedId]=spec`, `saveDashboard()`.

```js
function addSpecWidgetToGrid(spec, savedId) {
  widgetCounter++;
  var id = 'widget-' + widgetCounter, bodyId = 'wbody-' + widgetCounter;
  var w = (spec.layout && spec.layout.w) || 3, h = (spec.layout && spec.layout.h) || 2;
  var content = '<div class="widget-header"><span class="widget-title">' + _escapeHtml(spec.title) +
    '</span><button class="widget-menu-btn" onclick="removeWidget(\'' + id + '\')" title="위젯 삭제">✕</button></div>' +
    '<div class="widget-body" id="' + bodyId + '"></div>';
  grid.addWidget({ id: id, w: w, h: h, content: content, autoPosition: true });
  var el = document.querySelector('[gs-id="' + id + '"]');
  if (el) {
    el.dataset.widgetType = 'spec'; el.dataset.widgetTitle = spec.title;
    el.dataset.widgetSpec = '1'; el.dataset.widgetId = savedId; el.dataset.widgetPreset = 'spec:custom';
    window._specCache = window._specCache || {}; window._specCache[savedId] = spec;
  }
  setTimeout(function () { renderSpecWidget(bodyId, savedId); }, 50);
  saveDashboard();
}
```

- [ ] **Step 2: widget-builder.js — `addFromGallery(key)`**

```js
async function addFromGallery(key) {
  var spec = _galleryCache[key];
  if (!spec) return;
  try {
    var r = await fetch('/api/dashboard/widgets/spec', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: spec }),
    });
    var j = await r.json();
    if (!r.ok || !j.ok) { window.showToast('추가 실패: ' + ((j.validationErrors && j.validationErrors[0] && j.validationErrors[0].message) || j.error || '')); return; }
    window.addSpecWidgetToGrid(j.spec, j.id);
    window.closePicker(); window.showToast('"' + spec.title + '" 위젯을 추가했습니다');
  } catch (e) { window.showToast('네트워크 오류'); }
}
```
(`window.closePicker` 노출 필요 — widget-dashboard.js export 에 추가)

- [ ] **Step 3: 브라우저 E2E** — 갤러리 "이번 달 매출" 클릭 → 그리드에 KPI 추가 + 실금액 표시 → 새로고침 후 유지(DB 저장 확인).

- [ ] **Step 4: DB 확인**
```bash
docker exec -i rtbio-postgres psql -U rtbio -d rtbio_erp -c "SELECT preset, config->'spec'->>'title' FROM tenant_altibio.\"DashboardWidget\" WHERE preset='spec:custom' ORDER BY \"createdAt\" DESC LIMIT 3;"
```
Expected: 방금 추가한 위젯의 title.

- [ ] **Step 5: Commit**
```bash
git add public/portals/js/widget-dashboard.js public/portals/js/widget-builder.js
git commit -m "feat(widget): 갤러리 카드 → spec 저장 + 그리드 추가"
```

### Task A4: "빈 위젯" 함정 제거

**Files:**
- Modify: `public/portals/js/widget-dashboard.js` (`addEmptyWidget` 및 호출부 제거)

- [ ] **Step 1: `addEmptyWidget` 함수 + `window.addEmptyWidget` export + HTML 의 `#widgetTypeGrid` 관련 죽은 코드 제거** (A2 에서 HTML 은 이미 교체됨 — 여기선 JS 잔재 정리)
- [ ] **Step 2: 브라우저 — 갤러리에 "빈 위젯" 경로 없음 확인, 콘솔 에러 없음**
- [ ] **Step 3: Commit**
```bash
git add public/portals/js/widget-dashboard.js
git commit -m "refactor(widget): 빈 위젯(데이터 없는 플레이스홀더) 경로 제거"
```

---

# Phase B — 측정값+분류 빌더

목표: 소스→차트→측정값→분류→필터 가이드 폼 + **dry-run 실시간 미리보기** → 저장. 레거시 MOCK 전면 제거.

### Task B1: data-catalog 로드 + 빌더 모달 골격

**Files:**
- Modify: `public/portals/widget-dashboard.html` (`#builderOverlay` 마크업 신규)
- Modify: `public/portals/js/widget-builder.js`

- [ ] **Step 1: HTML — 빌더 모달**

`#builderOverlay`(모달) 안에: 제목 input, 소스 select(`#bSource`), 차트 select(`#bKind`), 측정값 영역(`#bMeasure` — 집계 select + 필드 select), 분류 select(`#bGroupBy`), 필터 영역(`#bFilters` + "+조건"), 정렬/limit(`#bOrder`/`#bLimit`), 미리보기(`#bPreview`), 푸터(취소/저장).

- [ ] **Step 2: JS — data-catalog 1회 로드 + 소스/차트 옵션 채움**

```js
async function ensureCatalog() {
  if (_catalog) return _catalog;
  var r = await fetch('/api/dashboard/data-catalog', { credentials: 'same-origin' });
  var j = await r.json();
  _catalog = j && j.catalog ? j : null;
  return _catalog;
}
function openBuilder() {
  ensureCatalog().then(function (cat) {
    if (!cat) { window.showToast('카탈로그 로드 실패'); return; }
    _fillSourceSelect(cat.catalog);   // <option> 채우기
    _fillKindSelect(cat.kinds);
    _onSourceChange();                // 측정값/분류/필터 필드 채우기
    document.getElementById('builderOverlay').classList.add('open');
    document.getElementById('pickerOverlay').classList.remove('open');
  });
}
```

- [ ] **Step 3: 소스 변경 시 필드 종속 갱신** — `_onSourceChange()`: 선택 소스의 `catalog[source].fields` 로 측정값 필드(agg:true), 분류 필드(전체), 필터 필드 드롭다운을 다시 채움. 필터행 초기화.

- [ ] **Step 4: 브라우저 — "+직접 만들기" → 빌더 모달, 소스 바꾸면 필드 갱신 확인**

- [ ] **Step 5: Commit**
```bash
git add public/portals/widget-dashboard.html public/portals/js/widget-builder.js
git commit -m "feat(widget): 빌더 모달 골격 + data-catalog 종속 드롭다운"
```

### Task B2: 폼 → WidgetSpec 조립

**Files:**
- Modify: `public/portals/js/widget-builder.js` (`buildSpecFromForm`)

- [ ] **Step 1: `buildSpecFromForm()` 구현**

폼 상태를 읽어 유효한 `WidgetSpec` 으로 조립. 규칙: kpi 는 `groupBy` 생략 + `aggregate` 필수; bar/pie/line 등은 `groupBy` 필수 + `aggregate`; table 은 `aggregate` 생략 + `orderBy`/`limit`.

```js
function buildSpecFromForm() {
  var kind = val('bKind'), source = val('bSource');
  var spec = { version: '1.0', title: val('bTitle') || '제목 없음', kind: kind,
    layout: { w: kind === 'table' ? 6 : (kind === 'kpi' ? 3 : 6), h: kind === 'kpi' ? 2 : 4 },
    data: { source: source } };
  // 필터
  var filter = _collectFilters();      // { field: { op: value } }
  if (Object.keys(filter).length) spec.data.filter = filter;
  // 측정값
  var aggType = val('bAggType'), aggField = val('bAggField');
  if (kind !== 'table' && aggType) spec.data.aggregate = { type: aggType, field: aggField || null };
  // 분류
  var groupBy = val('bGroupBy');
  if (kind !== 'kpi' && kind !== 'table' && groupBy) spec.data.groupBy = [groupBy];
  // 정렬/limit (table/top-N)
  if (kind === 'table' || val('bOrderField')) {
    if (val('bOrderField')) spec.data.orderBy = [{ field: val('bOrderField'), dir: val('bOrderDir') || 'desc' }];
    if (val('bLimit')) spec.data.limit = Math.min(100, parseInt(val('bLimit'), 10) || 20);
  }
  return spec;
}
```
필터 값에 템플릿 변수 도우미: 값 input 옆 select(`이번 달 시작`→`{{now.startOfMonth}}`, `오늘`→`{{today}}`, `30일 전`→`{{now.minus(30,'day')}}`, `직접입력`).

- [ ] **Step 2: 브라우저 콘솔 — 폼 채우고 `buildSpecFromForm()` 호출 → 올바른 spec JSON 출력 확인** (예: invoice + sum totalAmount + groupBy client.name).

- [ ] **Step 3: Commit**
```bash
git add public/portals/js/widget-builder.js
git commit -m "feat(widget): 빌더 폼 → WidgetSpec JSON 조립"
```

### Task B3: 실시간 dry-run 미리보기

**Files:**
- Modify: `public/portals/js/widget-builder.js`

- [ ] **Step 1: debounce 미리보기**

폼 변경 이벤트(소스/차트/측정값/분류/필터/정렬) → 400ms debounce → `previewBuilder()`:
```js
var _pvTimer = null;
function schedulePreview() { if (_pvTimer) clearTimeout(_pvTimer); _pvTimer = setTimeout(previewBuilder, 400); }
async function previewBuilder() {
  var spec = buildSpecFromForm();
  var box = document.getElementById('bPreview');
  try {
    var r = await fetch('/api/dashboard/widgets/spec', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: spec, dryRunOnly: true }),
    });
    var j = await r.json();
    if (!r.ok || !j.ok) {
      box.innerHTML = '<div class="builder-err">' + _esc((j.validationErrors && j.validationErrors[0] && (j.validationErrors[0].hint || j.validationErrors[0].message)) || j.error || '미리보기 실패') + '</div>';
      _setSaveEnabled(false); return;
    }
    box.innerHTML = '<div class="widget-body" id="bPreviewBody"></div>';
    window.renderSpecResult(document.getElementById('bPreviewBody'), { ok: true, result: j.preview, kind: spec.kind, title: spec.title, subtitle: spec.subtitle, format: spec.format, style: spec.style });
    _setSaveEnabled(true);
  } catch (e) { box.innerHTML = '<div class="builder-err">네트워크 오류</div>'; _setSaveEnabled(false); }
}
```
(주의: 미리보기는 세션 쿠키로 호출되므로 일반 사용자 권한으로 실데이터가 나온다. dry-run 실패 시 저장 버튼 비활성 → 잘못된 위젯 저장 방지.)

- [ ] **Step 2: 브라우저 — invoice/sum totalAmount/groupBy client.name 입력 → 미리보기에 실제 거래처별 막대 표시. 잘못된 필드 입력 → 친절 에러 + 저장 비활성.**

- [ ] **Step 3: Commit**
```bash
git add public/portals/js/widget-builder.js
git commit -m "feat(widget): 빌더 실시간 dry-run 미리보기(실데이터)"
```

### Task B4: 저장 → 그리드 추가

**Files:**
- Modify: `public/portals/js/widget-builder.js`

- [ ] **Step 1: 저장 핸들러** — `buildSpecFromForm()` → `POST /widgets/spec {spec}`(dryRunOnly 없음) → `window.addSpecWidgetToGrid(j.spec, j.id)` → 모달 닫고 토스트. (A3 의 addFromGallery 와 동일 경로 재사용 — 공통 `_saveSpec(spec)` 로 DRY.)
- [ ] **Step 2: 브라우저 E2E — 빌더로 만든 위젯 저장 → 그리드 표시 → 새로고침 유지 → DB `config->spec` 확인.**
- [ ] **Step 3: Commit**
```bash
git add public/portals/js/widget-builder.js
git commit -m "feat(widget): 빌더 위젯 저장 + 그리드 추가"
```

### Task B5: 레거시 MOCK 전면 제거 + 기본 레이아웃 spec 화

**Files:**
- Modify: `public/portals/js/widget-dashboard.js`

- [ ] **Step 1: 삭제** — `PRESETS`, `MOCK`, `PREVIEW_DATA`, `TABLE_COLUMNS`, `renderWidgetContent`(레거시 MOCK 렌더), `getVisiblePresets`, `renderPicker`(옛), 편집모달 custom 섹션 핸들러(`renderColumnChips`/`addFilterRow`/`renderPreview` 등) + 관련 export. (spec 렌더러 `_renderSpec*`/`renderSpecWidget`/`renderSpecResult` 는 **유지**.)

  ⚠️ **호출부 동시 수정 필수** — `renderPicker`/`getVisiblePresets` 를 삭제하면 다음 호출부가 `ReferenceError` 를 던져 대시보드 전체가 깨진다. 함께 정리할 것:
  - `DOMContentLoaded` init(현재 `widget-dashboard.js:~1331`)의 `renderPicker();` 호출 → 제거(갤러리는 A2 의 `loadGallery()` 가 openPicker 훅에서 로드).
  - `window.setDashboardRole`(현재 `:~1320`)의 `if (document.getElementById('presetList')) renderPicker();` → 제거(role 필터는 이제 spec/role 기반, 옛 presetList 없음).
  - `#presetList`/`#widgetTypeGrid` 를 참조하던 모든 잔재 제거.

- [ ] **Step 2: `loadDefaultLayout` → prefab spec 4종 저장 호출**

기존 `addWidget('kpi','이번 달 매출','monthly_sales',...)` 들을 제거하고, prefab 4종(`kpi_monthly_sales`/`kpi_total_ar`/`kpi_open_orders`/`kpi_active_clients`)을 순차 `_saveSpec` → `addSpecWidgetToGrid`. (또는 `/widget-schema` examples 에서 해당 키를 뽑아 저장.)

- [ ] **Step 3: `loadDashboard` 레거시 호환** — DB rows 중 `config.spec` 없는 옛 mock-preset 위젯은: `LEGACY_PRESET_MAP[preset]`(예: `monthly_sales`→`kpi_monthly_sales`) 으로 prefab spec 매핑 가능하면 그 spec 으로 렌더, 매핑 없으면(`unread_notifications`/`procurement_*`/`udi_status` 등) **드롭**(그리드에 추가하지 않음). `LEGACY_PRESET_MAP` 상수 신설.

```js
var LEGACY_PRESET_MAP = {
  monthly_sales: 'kpi_monthly_sales', total_ar: 'kpi_total_ar',
  today_orders: 'kpi_open_orders', active_clients: 'kpi_active_clients',
  // 매핑 없는 키(unread_notifications, procurement_status, udi_status, weekly_sales 등)는 드롭
};
```

- [ ] **Step 4: tsc 무관(JS). `npm test` 영향 없음(프로토타입). 브라우저 — 기본 레이아웃 4 KPI 실데이터, 옛 깨진 위젯 사라짐, 콘솔 에러 없음.**

- [ ] **Step 5: Commit**
```bash
git add public/portals/js/widget-dashboard.js
git commit -m "refactor(widget): 레거시 MOCK 전면 제거 + 기본 레이아웃 spec 화"
```

### Task B6: 편집모달 정리 + 통합 브라우저 스모크

**Files:**
- Modify: `public/portals/widget-dashboard.html` (`#editOverlay` custom 섹션 제거 — 제목/타입만 남기거나 편집을 빌더 재오픈으로 대체)
- Modify: `public/portals/js/widget-dashboard.js` (편집 핸들러 정리)

- [ ] **Step 1: 우클릭 "위젯 수정" → 빌더 모달 재오픈(해당 spec 프리필)으로 연결**(스펙 위젯). 단순화를 위해 1차에는 "수정=삭제 후 재생성" 안내 또는 제목만 편집 허용. (YAGNI — spec 역-프리필은 stretch.)
- [ ] **Step 2: 5포털 영향 점검** — `widget-builder.js`/`widget-dashboard.js` 는 exec/ceo/admin 대시보드 공유. 각 포털 대시보드 로드 → 갤러리/빌더 동작, 기존 위젯 정상.
- [ ] **Step 3: Commit**
```bash
git add public/portals/widget-dashboard.html public/portals/js/widget-dashboard.js
git commit -m "refactor(widget): 편집모달 정리 + 빌더 연결"
```

---

# Phase C — Flowise 토큰 인증 + API 문서

목표: Bearer 토큰으로 모든 `GET /api/*` + `POST /widgets/spec` 허용(그 외 쓰기 차단), 라우트 무개조 미들웨어 브리지. + Flowise 연동 문서.

### Task C1: 토큰 검증 헬퍼 + 서비스 principal 상수

**Files:**
- Create: `src/lib/widget-spec/api-auth.ts`
- Test: `src/lib/widget-spec/api-auth.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidApiToken, SERVICE_PRINCIPAL } from "./api-auth";

describe("isValidApiToken", () => {
  beforeEach(() => { vi.stubEnv("WIDGET_API_TOKEN", "secret-abc"); });
  it("정확히 일치하면 true", () => { expect(isValidApiToken("Bearer secret-abc")).toBe(true); });
  it("불일치 false", () => { expect(isValidApiToken("Bearer nope")).toBe(false); });
  it("형식 불량/누락 false", () => {
    expect(isValidApiToken("secret-abc")).toBe(false);
    expect(isValidApiToken(null)).toBe(false);
    expect(isValidApiToken("")).toBe(false);
  });
  it("env 미설정이면 항상 false(기본 비활성)", () => {
    vi.stubEnv("WIDGET_API_TOKEN", "");
    expect(isValidApiToken("Bearer anything")).toBe(false);
  });
});
describe("SERVICE_PRINCIPAL", () => {
  it("고정 서비스 유저 id/role", () => {
    expect(SERVICE_PRINCIPAL.userId).toBe("svc-integration");
    expect(SERVICE_PRINCIPAL.role).toBe("ADMIN");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** — Run: `npx vitest run src/lib/widget-spec/api-auth.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: 구현**
```ts
/**
 * Flowise 등 외부 에이전트용 API 토큰 인증.
 * - 토큰은 WIDGET_API_TOKEN env (미설정 시 기능 비활성 — 안전 기본값).
 * - 상수시간 비교로 타이밍 공격 완화.
 * - 토큰 인증 요청은 SERVICE_PRINCIPAL(고정 서비스 유저)로 동작.
 */
export const SERVICE_PRINCIPAL = {
  userId: "svc-integration",
  role: "ADMIN" as const,
  tenantCode: "altibio",
  tenantId: null as string | null,
  clientId: null as string | null,
  isTeamAdmin: true,
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isValidApiToken(authHeader: string | null): boolean {
  const expected = process.env.WIDGET_API_TOKEN;
  if (!expected) return false; // 미설정 = 비활성
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const provided = authHeader.slice("Bearer ".length);
  if (!provided) return false;
  return timingSafeEqual(provided, expected);
}

/** 토큰 인증 요청이 호출 가능한 쓰기 경로 (위젯 생성만). */
export function isTokenWriteAllowed(method: string, pathname: string): boolean {
  if (method === "GET" || method === "HEAD") return true;
  return pathname === "/api/dashboard/widgets/spec";
}
```

- [ ] **Step 4: 테스트 통과** — Run: `npx vitest run src/lib/widget-spec/api-auth.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/widget-spec/api-auth.ts src/lib/widget-spec/api-auth.test.ts
git commit -m "feat(widget-api): 토큰 검증 헬퍼 + 서비스 principal"
```

### Task C2: 서비스 계정 시드 (static id)

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: integration 유저 upsert 추가** (altibio 테넌트, 명시적 id)
```ts
await prisma.user.upsert({
  where: { id: "svc-integration" },
  update: {},
  create: {
    id: "svc-integration",
    email: "integration@rtbio.com",
    password: await bcrypt.hash(process.env.WIDGET_API_TOKEN || "disabled-" + Date.now(), 10),
    name: "Flowise 연동",
    role: "ADMIN",
    tenantId: tenant.id,   // 기존 seed 의 altibio tenant 객체
    isTeamAdmin: true,
    active: true,
  },
});
```
(이 유저는 직접 로그인용이 아니라 토큰 브리지의 주체 — DashboardWidget.userId FK 충족 + 감사 createdBy 용.)

- [ ] **Step 2: 시드 실행 + 확인**
```bash
npm run prisma:seed
docker exec -i rtbio-postgres psql -U rtbio -d rtbio_erp -c "SELECT id, email, role FROM public.\"User\" WHERE id='svc-integration';"
```
Expected: 1행, role=ADMIN.

- [ ] **Step 3: Commit**
```bash
git add prisma/seed.ts
git commit -m "feat(widget-api): integration 서비스 계정 시드(svc-integration)"
```

### Task C3: widgets/spec — forUser 타겟팅

**Files:**
- Modify: `src/app/api/dashboard/widgets/spec/route.ts`
- Test: `src/app/api/dashboard/widgets/spec/forUser.test.ts`

- [ ] **Step 1: 실패 테스트** — `resolveTargetUserId(sessionUserId, forUser?)` 순수 헬퍼를 라우트에서 분리해 테스트. forUser(email) 주어지면 그 유저 id, 없으면 세션 id. 존재하지 않는 forUser → 에러.

```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
import { resolveTargetUserId } from "./forUser";
import { prisma } from "@/lib/prisma";

describe("resolveTargetUserId", () => {
  it("forUser 없으면 세션 id", async () => {
    expect(await resolveTargetUserId("u-session", undefined)).toBe("u-session");
  });
  it("forUser email → 해당 유저 id", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u-target" });
    expect(await resolveTargetUserId("u-session", "ceo@rtbio.com")).toBe("u-target");
  });
  it("forUser 없는 유저 → throw", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    await expect(resolveTargetUserId("u-session", "ghost@rtbio.com")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/app/api/dashboard/widgets/spec/forUser.test.ts` → FAIL.

- [ ] **Step 3: 구현** `src/app/api/dashboard/widgets/spec/forUser.ts`
```ts
import { prisma } from "@/lib/prisma";
export async function resolveTargetUserId(sessionUserId: string, forUser?: string): Promise<string> {
  if (!forUser) return sessionUserId;
  const u = await prisma.user.findUnique({ where: { email: forUser }, select: { id: true } });
  if (!u) throw new Error(`forUser 사용자를 찾을 수 없습니다: ${forUser}`);
  return u.id;
}
```
그리고 route.ts 의 저장 분기에서 `const userId = await resolveTargetUserId(user.id, body?.forUser);` 로 `DashboardWidget.create({ data: { userId, ... } })` 에 사용. forUser 에러는 400 으로 반환.

- [ ] **Step 4: 테스트 통과 + tsc** — Run: `npx vitest run src/app/api/dashboard/widgets/spec/forUser.test.ts` → PASS. `npx tsc --noEmit` 클린.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/dashboard/widgets/spec/route.ts src/app/api/dashboard/widgets/spec/forUser.ts src/app/api/dashboard/widgets/spec/forUser.test.ts
git commit -m "feat(widget-api): widgets/spec forUser 타겟팅"
```

### Task C4: 미들웨어 브리지 스파이크 (리스크 선검증)

**Files:**
- Modify: `src/middleware.ts` (임시 스파이크 — 다음 태스크에서 정식화)

- [ ] **Step 1: 최소 PoC** — 미들웨어 최상단에 Bearer 검증 시 `next-auth/jwt` `encode` 로 `SERVICE_PRINCIPAL` JWT 를 만들어 요청 쿠키(`next-auth.session-token`)에 주입하고 통과시키는 코드를 임시 작성.
```ts
import { encode } from "next-auth/jwt";
// ... Bearer 유효 시:
const jwt = await encode({
  token: { userId: SERVICE_PRINCIPAL.userId, role: SERVICE_PRINCIPAL.role,
    tenantId: SERVICE_PRINCIPAL.tenantId, tenantCode: SERVICE_PRINCIPAL.tenantCode,
    clientId: SERVICE_PRINCIPAL.clientId, isTeamAdmin: SERVICE_PRINCIPAL.isTeamAdmin },
  secret: getAuthSecret(),
});
const h = new Headers(req.headers);
h.set("cookie", "next-auth.session-token=" + jwt);
return NextResponse.next({ request: { headers: h } });
```

- [ ] **Step 2: 검증** — `.env.local` 에 `WIDGET_API_TOKEN=test-token` 설정, dev 재시작.
```bash
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer test-token" http://localhost:3000/api/clients
```
Expected: `200`. (실패 시: `getServerSession` 이 주입 쿠키를 못 읽는 것 → **폴백 경로**로 전환: `src/lib/api-session.ts` `getApiUser(req)`(세션 OR 토큰→SERVICE_PRINCIPAL) 헬퍼를 만들고 읽기 라우트가 채택. 설계문서 "폴백(2순위)" 참조. 이 경우 C5 를 폴백 기준으로 재작성.)

- [ ] **Step 3: 결과를 계획에 메모** — 스파이크 성공/실패에 따라 C5 경로 확정. (스파이크 코드는 C5 에서 정식화하며 정리)

- [ ] **Step 4: (중간 커밋 없음 — C5 와 합쳐 커밋)**

### Task C5: 미들웨어 토큰 게이트 정식 구현

**Files:**
- Modify: `src/middleware.ts`
- Modify: `.env.example`

- [ ] **Step 1: 토큰 게이트 삽입** — 테넌트 헤더 추출 직후, 일반 `getToken` 인증 게이트 **앞에**:
```ts
import { isValidApiToken, isTokenWriteAllowed, SERVICE_PRINCIPAL } from "@/lib/widget-spec/api-auth";
import { encode } from "next-auth/jwt";

// ── 1.5) API 토큰 게이트 (Flowise 등 외부 에이전트) ──
const authz = req.headers.get("authorization");
if (authz && authz.startsWith("Bearer ")) {
  if (!pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!isValidApiToken(authz)) {
    return NextResponse.json({ ok: false, error: "Invalid API token" }, { status: 401 });
  }
  if (!isTokenWriteAllowed(req.method, pathname)) {
    return NextResponse.json(
      { ok: false, error: "토큰은 읽기 + 위젯 생성만 허용됩니다", path: pathname }, { status: 403 });
  }
  const jwt = await encode({
    token: {
      userId: SERVICE_PRINCIPAL.userId, role: SERVICE_PRINCIPAL.role,
      tenantId: SERVICE_PRINCIPAL.tenantId, tenantCode: SERVICE_PRINCIPAL.tenantCode,
      clientId: SERVICE_PRINCIPAL.clientId, isTeamAdmin: SERVICE_PRINCIPAL.isTeamAdmin,
    },
    secret: getAuthSecret(),
  });
  requestHeaders.set("cookie", "next-auth.session-token=" + jwt);
  requestHeaders.set("x-tenant-id", SERVICE_PRINCIPAL.tenantCode);
  requestHeaders.set("x-api-principal", SERVICE_PRINCIPAL.userId); // 감사용
  return NextResponse.next({ request: { headers: requestHeaders } });
}
```
(스파이크가 폴백으로 결론났다면: 위 대신 헤더 `x-api-principal` 만 주입하고, 읽기 라우트가 `getApiUser(req)` 채택. 설계문서 2순위.)

  ⚠️ **쿠키명은 환경 의존** — 개발(`NEXTAUTH_URL=http://...`, `useSecureCookies=false`)은 `next-auth.session-token` 이 맞다. **운영 HTTPS** 는 NextAuth 기본이 `__Secure-next-auth.session-token` 으로 바뀐다. 하드코딩 대신 `NEXTAUTH_URL` 의 https 여부로 분기하라:
```ts
const secure = (process.env.NEXTAUTH_URL || "").startsWith("https");
const cookieName = (secure ? "__Secure-" : "") + "next-auth.session-token";
requestHeaders.set("cookie", cookieName + "=" + jwt);
```

- [ ] **Step 2: `.env.example`** — 섹션 추가:
```
# --- Flowise 연동 API 토큰 (외부 에이전트가 위젯 생성/데이터 조회) ---
# 설정 시 활성. 절대 커밋 금지. 운영은 회전 가능한 비밀로.
WIDGET_API_TOKEN=""
```

- [ ] **Step 3: tsc + 기존 테스트** — Run: `npx tsc --noEmit` 클린. `npm test` → 기존 362 통과(미들웨어는 vitest 대상 아님, 회귀 없음).

- [ ] **Step 4: Commit**
```bash
git add src/middleware.ts .env.example
git commit -m "feat(widget-api): 미들웨어 Bearer 토큰 게이트 + 서비스 세션 브리지"
```

### Task C6: 토큰 E2E (curl)

**Files:** (없음 — 수동 검증)

- [ ] **Step 1: dev + 토큰 설정** — `.env.local` `WIDGET_API_TOKEN=test-token`, dev 재시작, 시드(C2) 완료 상태.
- [ ] **Step 2: 4 시나리오**
```bash
T="Authorization: Bearer test-token"
# (a) 읽기 GET → 200
curl -s -o /dev/null -w "GET clients: %{http_code}\n" -H "$T" http://localhost:3000/api/clients
# (b) 위젯 생성 POST → 201
curl -s -w "\nspec POST: %{http_code}\n" -H "$T" -H "Content-Type: application/json" \
  -d '{"spec":{"version":"1.0","title":"토큰테스트","kind":"kpi","data":{"source":"invoice","filter":{"status":{"in":["ISSUED","SENT"]}},"aggregate":{"type":"sum","field":"totalAmount"}}},"forUser":"owner@rtbio.com"}' \
  http://localhost:3000/api/dashboard/widgets/spec
# (c) 비-위젯 쓰기 POST → 403
curl -s -o /dev/null -w "order POST(차단): %{http_code}\n" -H "$T" -H "Content-Type: application/json" -d '{}' http://localhost:3000/api/orders
# (d) 무토큰 → 401/302
curl -s -o /dev/null -w "무토큰: %{http_code}\n" http://localhost:3000/api/clients
```
Expected: (a) 200, (b) 201, (c) 403, (d) 401 또는 302(login redirect).
- [ ] **Step 3: forUser 대시보드 반영 확인** — owner 로 로그인 → `/ceo` 또는 `/exec` 대시보드에 "토큰테스트" 위젯 존재.
- [ ] **Step 4: (검증만 — 커밋 없음)**

### Task C7: Flowise 연동 API 문서

**Files:**
- Create: `docs/02-design/dashboard-widget-api.md`

- [ ] **Step 1: 문서 작성** — 섹션:
  1. 개요 + 흐름도(GET 규칙 학습 → spec 작성 → dry-run → 저장)
  2. **인증** — `Authorization: Bearer <WIDGET_API_TOKEN>`, 권한(읽기 GET 전부 + `POST /widgets/spec`, 그 외 쓰기 403), 토큰 발급/보안
  3. **도구 1** `GET /api/dashboard/data-catalog` — 응답 예시(소스/필드/연산자/집계/templateVars)
  4. **도구 2** `GET /api/dashboard/widget-schema` — spec 구조 + examples
  5. **도구 3** `POST /api/dashboard/widgets/spec` — body `{spec, dryRunOnly?, forUser?}`, 성공/검증실패/dry-run실패 응답, 에러 자가교정(`validationErrors[].hint`)
  6. **WidgetSpec 레퍼런스** — schema.ts 전체 필드 표 + 날짜 템플릿 변수
  7. **few-shot 5개** — 이번달매출(kpi)/거래처별매출Top10(hbar)/월별추이(line)/재고부족(table)/미수금합계(kpi) spec JSON
  8. **Flowise 설정** — Requests GET/POST 노드 헤더 설정 + **복붙용 시스템 프롬프트**(규칙: 항상 data-catalog 먼저 조회, source/field 는 카탈로그 내에서만, 저장 전 dryRunOnly:true 로 검증, 에러 hint 로 교정, forUser 에 요청자 이메일)
- [ ] **Step 2: 내부 점검** — 문서의 모든 엔드포인트/필드가 실제 코드(schema.ts/route.ts)와 일치하는지 대조.
- [ ] **Step 3: Commit**
```bash
git add docs/02-design/dashboard-widget-api.md
git commit -m "docs(widget-api): Flowise 연동 가이드(도구 3종+스키마+few-shot+시스템프롬프트)"
```

### Task C8: 전체 회귀 + 마무리

- [ ] **Step 1: 회귀** — Run: `npm test` → 362+ 통과. `npx tsc --noEmit` → 클린.
- [ ] **Step 2: api-reference 갱신** — `docs/02-design/api-reference.md` 에 토큰 인증 + `forUser` + 새 문서 링크 한 줄 추가.
- [ ] **Step 3: Commit**
```bash
git add docs/02-design/api-reference.md
git commit -m "docs: api-reference 에 위젯 토큰 인증/forUser 반영"
```

---

## 검증 체크리스트 (전체 완료 기준)

- [ ] A: 갤러리에서 prefab 위젯 추가 → 실데이터 표시 → 새로고침 유지
- [ ] B: 빌더로 소스·집계·필터 조합 → **실데이터 미리보기** → 저장 → 유지. 잘못된 입력은 친절 에러 + 저장 차단
- [ ] 레거시: 옛 "빈 위젯"/데이터 안 나오던 MOCK 위젯 제거됨
- [ ] C: `curl` 4 시나리오(200/201/403/401) 통과, forUser 대시보드 반영
- [ ] 문서: Flowise 도구 3종 + 스키마 + few-shot + 시스템 프롬프트로 에이전트 제작 가능
- [ ] 회귀: 기존 362 vitest + tsc 클린
- [ ] 보안: `WIDGET_API_TOKEN` env 전용, 커밋 안 됨. `scripts/add-real-client-accounts.ts` 등 비밀 미커밋

## 리스크 & 폴백

- **C4 스파이크 실패(미들웨어 JWT 주입을 getServerSession 이 못 읽음)** → `getApiUser(req)` 폴백: `src/lib/api-session.ts` 신설(세션 OR Bearer→SERVICE_PRINCIPAL), 읽기 라우트가 `getServerSession` 대신 채택. "읽기 전면개방"은 채택 라우트 범위로 한정되므로, 우선 핵심(clients/orders/invoices/payments/ledger/products/inventory) + 대시보드 3종부터 적용하고 점진 확대.
- **갤러리/빌더가 5포털 공유** → 각 포털에서 회귀 확인(Task B6 Step 2).
- **prefab 일부 계산형 한계**(low_stock classifyStock 후처리, 계약 소스) → 설계문서 "범위 밖". 갤러리에는 동작하는 것만 노출.
