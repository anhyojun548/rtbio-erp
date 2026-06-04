# AI 챗 위젯 생성 입구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `➕ 위젯 추가` 모달 상단에 AI 챗 입력창을 더해, 비개발자가 말로 요청하면 가장 비슷한 템플릿을 미리보기와 함께 추천받아 원클릭으로 추가하게 한다.

**Architecture:** 브라우저 → 세션 인증 라우트 `POST /api/dashboard/widgets/ai` 하나만 호출. 지금은 순수함수 매처(`suggestWidgets`)가 PREFAB_SPECS 13종을 점수화해 top-3 추천. 나중에 `FLOWISE_PREDICTION_URL` env 설정 시 같은 라우트가 Flowise 프록시로 승격(UI·계약 불변). 위젯 저장은 만들지 않고 **기존** `POST /api/dashboard/widgets/spec` 를 재사용.

**Tech Stack:** Next.js 14 route handler, Zod(기존 widgetSpecSchema), Vitest, NextAuth(getServerSession), 바닐라 JS 프로토타입(widget-builder.js).

**선행 사실(탐색 완료):**
- `PREFAB_SPECS`(`src/lib/widget-spec/presets.ts`) = `Record<string, WidgetSpec>` 13키. 각 spec 에 `.title`, `.kind`, `.data.source`, `.data.groupBy?`. `PREFAB_KEYS` 도 export.
- 기존 spec 라우트(`src/app/api/dashboard/widgets/spec/route.ts`): `getServerSession(authOptions)` → 없으면 401. `dryRunOnly:true` 면 저장 없이 `{ok,preview}` 반환.
- 피커(`public/portals/js/widget-dashboard.js`): `openPicker()`(L709)=`#pickerOverlay`에 `.open`+`window.onPickerOpen()`, `closePicker()`(L713), `#btnAddWidget`→openPicker.
- 갤러리(`widget-builder.js`): `addFromGallery(key)`→`_saveSpec(spec)`→`window.addSpecWidgetToGrid(res.spec,res.id)`+`window.closePicker()`+`window.showToast`. `window.renderSpecResult(el,{ok,result,kind,title,subtitle,format,style})` 로 미리보기. 배선은 `_wireBuilder()` + DOMContentLoaded.
- 피커 HTML 은 `admin-portal.html`·`ceo-portal.html` 둘 다 `<div class="picker-overlay" id="pickerOverlay"> … <div class="picker-section">` 구조(동일). 둘 다 `widget-builder.js` 로드.
- 테스트 패턴: 순수함수 = `display.test.ts`(import + describe/it/expect). 라우트 = `forUser.test.ts`(`vi.mock`).

**보안/규칙:** `FLOWISE_PREDICTION_URL`/`FLOWISE_API_KEY` 는 **서버 env 전용, 절대 커밋 금지**. 인앱 라우트는 **세션** 인증(위젯 토큰 아님). 커밋 푸터 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 푸시는 사용자 명시 요청 시에만.

---

## Task 1: 매처 `suggestWidgets` (순수함수, TDD)

**Files:**
- Create: `src/lib/widget-spec/suggest.ts`
- Test: `src/lib/widget-spec/suggest.test.ts`

- [ ] **Step 1: 실패 테스트 작성** `src/lib/widget-spec/suggest.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { suggestWidgets } from "./suggest";

describe("suggestWidgets", () => {
  it("'이번 달 거래처별 매출' → list_top_clients 최상위", () => {
    const r = suggestWidgets("이번 달 거래처별 매출 보여줘");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].key).toBe("list_top_clients");
    expect(r[0].source).toBe("invoice");
    expect(r[0].spec.title).toContain("Top 5 거래처");
  });
  it("'재고 부족 품목' → list_low_stock 포함", () => {
    const keys = suggestWidgets("재고 부족 품목").map((s) => s.key);
    expect(keys).toContain("list_low_stock");
  });
  it("'미수금 얼마야' → kpi_total_ar 최상위", () => {
    expect(suggestWidgets("미수금 얼마야")[0].key).toBe("kpi_total_ar");
  });
  it("'오늘 매출' → kpi_daily_sales 최상위(monthly보다 우선)", () => {
    expect(suggestWidgets("오늘 매출")[0].key).toBe("kpi_daily_sales");
  });
  it("'수금' → kpi_received 포함", () => {
    expect(suggestWidgets("이번 달 수금 현황").map((s) => s.key)).toContain("kpi_received");
  });
  it("매칭 0건 → 빈 배열", () => {
    expect(suggestWidgets("점심 뭐 먹지")).toEqual([]);
  });
  it("빈/공백 입력 → 빈 배열", () => {
    expect(suggestWidgets("")).toEqual([]);
    expect(suggestWidgets("   ")).toEqual([]);
  });
  it("limit 준수 (기본 3)", () => {
    expect(suggestWidgets("매출").length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/widget-spec/suggest.test.ts` · Expected: FAIL ("suggest" 모듈 없음)

- [ ] **Step 3: 구현** `src/lib/widget-spec/suggest.ts`

```ts
/**
 * 자연어 메시지 → 가장 비슷한 prefab 위젯 추천 (Flowise 준비 전 임시 엔진).
 * 순수 함수 — Prisma/네트워크 의존 없음. PREFAB_SPECS 만 점수화한다.
 * Flowise 연결 후에는 라우트가 이 매처 대신 Flowise 프록시를 쓴다(UI 동일).
 */
import { PREFAB_SPECS, PREFAB_KEYS } from "./presets";
import type { WidgetSpec } from "./schema";

export type WidgetSuggestion = {
  key: string;
  title: string;
  kind: string;
  source: string;
  score: number;
  spec: WidgetSpec;
};

/** prefab 별 한글 키워드 힌트 — 공백 무시 부분일치로 점수화. */
const PREFAB_HINTS: Record<string, string[]> = {
  kpi_monthly_sales: ["매출", "이번달매출", "당월매출", "월매출", "판매액", "매출액"],
  kpi_total_ar: ["미수금", "미수", "외상", "받을돈", "채권"],
  kpi_open_orders: ["진행중주문", "진행주문", "처리중주문", "열린주문", "미완료주문"],
  kpi_active_clients: ["활성거래처", "거래처수", "고객수", "업체수"],
  kpi_low_stock: ["재고임계", "재고부족", "재고알림", "안전재고", "품절임박"],
  kpi_expiring_contracts: ["만료임박계약", "만료계약", "계약만료", "계약갱신"],
  list_top_clients: ["거래처별매출", "매출top", "매출상위", "상위거래처", "top거래처", "거래처순위", "매출순"],
  list_low_stock: ["재고부족품목", "부족품목", "재고부족top", "품절품목"],
  list_ending_contracts: ["만료임박계약목록", "만료계약목록", "계약목록"],
  list_recent_orders: ["최근주문", "최신주문", "최근발주"],
  kpi_daily_sales: ["오늘매출", "당일매출", "금일매출", "일매출"],
  kpi_weekly_sales: ["주간매출", "이번주매출", "주매출", "최근7일", "7일매출"],
  kpi_received: ["수금", "입금", "수금액", "받은돈", "회수"],
};

/** 메시지 정규화 — 소문자 + 공백/구분자 제거(부분일치 안정화). */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s,./·]+/g, "");
}

/**
 * 메시지에 가장 잘 맞는 prefab 추천 top-N.
 * 점수 = 힌트 부분일치(각 +2) + "~별" 차원이면 groupBy prefab(+3) + 제목 토큰 일치(각 +1).
 * 1점 이상만, 동점은 PREFAB 정의 순서.
 */
export function suggestWidgets(message: string, limit = 3): WidgetSuggestion[] {
  const raw = message || "";
  const norm = normalize(raw);
  if (!norm) return [];

  const dimGroup = /(거래처|고객|업체|제품|품목)별/.test(raw);
  const scored: WidgetSuggestion[] = [];

  for (const key of PREFAB_KEYS) {
    const spec = PREFAB_SPECS[key];
    const hints = PREFAB_HINTS[key] || [];
    let score = 0;
    for (const h of hints) if (norm.includes(normalize(h))) score += 2;

    const hasGroupBy = Array.isArray(spec.data.groupBy) && spec.data.groupBy.length > 0;
    if (hasGroupBy && dimGroup) score += 3;

    for (const tok of spec.title.split(/[\s()]+/).filter((t) => t.length >= 2)) {
      if (norm.includes(normalize(tok))) score += 1;
    }

    if (score > 0) {
      scored.push({ key, title: spec.title, kind: spec.kind, source: spec.data.source, score, spec });
    }
  }

  scored.sort(
    (a, b) => b.score - a.score || PREFAB_KEYS.indexOf(a.key) - PREFAB_KEYS.indexOf(b.key),
  );
  return scored.slice(0, Math.max(1, limit));
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/widget-spec/suggest.test.ts` · Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/widget-spec/suggest.ts src/lib/widget-spec/suggest.test.ts
git commit -m "feat(widget): 자연어→템플릿 추천 매처 suggestWidgets (순수함수)"
```

---

## Task 2: 라우트 `POST /api/dashboard/widgets/ai` (세션 인증 + Flowise 심)

**Files:**
- Create: `src/app/api/dashboard/widgets/ai/route.ts`
- Test: `src/app/api/dashboard/widgets/ai/route.test.ts`

- [ ] **Step 1: 실패 테스트 작성** `route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
import { getServerSession } from "next-auth";
import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://t/api/dashboard/widgets/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dashboard/widgets/ai", () => {
  beforeEach(() => vi.clearAllMocks());

  it("세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await POST(req({ message: "매출" }))).status).toBe(401);
  });
  it("빈 메시지 400", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    expect((await POST(req({ message: "   " }))).status).toBe(400);
  });
  it("정상 메시지 → 200 mode=suggest + suggestions", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const res = await POST(req({ message: "이번 달 거래처별 매출" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.mode).toBe("suggest");
    expect(j.suggestions[0].key).toBe("list_top_clients");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/app/api/dashboard/widgets/ai/route.test.ts` · Expected: FAIL (route 없음)

- [ ] **Step 3: 구현** `src/app/api/dashboard/widgets/ai/route.ts`

```ts
/**
 * POST /api/dashboard/widgets/ai — 인앱 AI 위젯 입구.
 * 자연어 메시지를 받아 위젯을 "제안"한다(생성하지 않음 — 저장은 기존
 * POST /api/dashboard/widgets/spec 가 담당).
 *  - 지금: 로컬 매처(suggestWidgets) → 가장 비슷한 prefab top-3 (mode="suggest")
 *  - 나중: env FLOWISE_PREDICTION_URL 설정 시 Flowise 프록시 → spec (mode="spec") [후속 구현]
 * 인증: NextAuth 세션(인앱 로그인 사용자). 키/URL 은 서버 env 전용.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { suggestWidgets } from "@/lib/widget-spec/suggest";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const message =
    body && typeof body === "object" && typeof body.message === "string"
      ? body.message.trim()
      : "";
  if (!message) {
    return Response.json({ ok: false, error: "메시지를 입력하세요" }, { status: 400 });
  }
  if (message.length > 500) {
    return Response.json(
      { ok: false, error: "메시지가 너무 깁니다 (최대 500자)" },
      { status: 400 },
    );
  }

  // ── Flowise 연결 심(seam) — env 설정 시 그 챗플로우로 프록시(실제 프록시는 후속) ──
  if (process.env.FLOWISE_PREDICTION_URL) {
    return Response.json(
      { ok: false, error: "Flowise 연동은 준비 중입니다." },
      { status: 503 },
    );
  }

  // ── 지금 엔진: 로컬 템플릿 매처 ──
  const suggestions = suggestWidgets(message, 3);
  const reply = suggestions.length
    ? "이런 위젯은 어때요? 미리보기 후 추가할 수 있어요."
    : "딱 맞는 템플릿을 못 찾았어요. 갤러리에서 고르거나 '직접 만들기'로 만들어 보세요.";
  return Response.json({ ok: true, mode: "suggest", reply, suggestions });
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/app/api/dashboard/widgets/ai/route.test.ts` · Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/dashboard/widgets/ai/route.ts src/app/api/dashboard/widgets/ai/route.test.ts
git commit -m "feat(widget): /api/dashboard/widgets/ai — 세션 인증 추천 라우트 + Flowise 심"
```

---

## Task 3: 피커 상단 AI 챗 마크업 (admin·ceo HTML)

**Files:**
- Modify: `public/portals/admin-portal.html` (피커 `<div class="picker-section">` 직전)
- Modify: `public/portals/ceo-portal.html` (동일 위치)
- Modify: 각 파일 `<style>` 블록에 `.picker-ai*` CSS 추가

- [ ] **Step 1: 두 HTML 의 picker 구조 확인**

Run: `rg -n "picker-section" public/portals/admin-portal.html public/portals/ceo-portal.html`
Expected: 각 파일에 `<div class="picker-section">` 1개씩. 그 직전(=picker-header `</div>` 다음)에 AI 블록을 넣는다.

- [ ] **Step 2: AI 챗 블록 삽입 (admin·ceo 동일)**

각 파일에서 `<div class="picker-section">` 여는 태그 **바로 앞**에 아래 블록을 삽입(들여쓰기는 해당 파일에 맞춤):

```html
<!-- AI 챗 — 말로 위젯 요청 (Flowise 준비 전: 가장 비슷한 템플릿 추천) -->
<div class="picker-ai">
  <div class="picker-ai-head">🤖 AI에게 말하기</div>
  <div class="picker-ai-row">
    <input type="text" id="pickerAiInput" class="form-input" maxlength="500"
      placeholder="원하는 위젯을 말해보세요 (예: 이번 달 거래처별 매출)" />
    <button class="tb-btn primary" id="pickerAiSend">보내기</button>
  </div>
  <div class="picker-ai-hint">
    예: "재고 부족 품목" · "미수금" · "오늘 매출" — 지금은 비슷한 템플릿을 추천해요.
    AI 자동 생성은 곧 (Flowise 연결 예정)
  </div>
  <div class="picker-ai-results" id="pickerAiResults"></div>
</div>
```

- [ ] **Step 3: CSS 추가 (admin·ceo 각 `<style>` 블록 끝부분)**

```css
.picker-ai{padding:16px 20px;border-bottom:1px solid var(--border,#e5e7eb);}
.picker-ai-head{font-weight:600;margin-bottom:8px;}
.picker-ai-row{display:flex;gap:8px;}
.picker-ai-row .form-input{flex:1;}
.picker-ai-hint{font-size:12px;color:var(--text-tertiary,#6b7280);margin-top:6px;line-height:1.5;}
.picker-ai-results{margin-top:12px;display:flex;flex-direction:column;gap:10px;}
.picker-ai-reply{font-size:13px;color:var(--text-secondary,#374151);}
.picker-ai-card{border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:10px;background:var(--bg,#fff);}
.picker-ai-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;}
.picker-ai-card-title{font-weight:600;font-size:14px;}
.picker-ai-preview{min-height:72px;}
.picker-ai-empty,.picker-ai-loading{font-size:13px;color:var(--text-tertiary,#6b7280);padding:8px 0;}
```

- [ ] **Step 4: 검증** — Run: `rg -n "pickerAiInput|pickerAiResults" public/portals/admin-portal.html public/portals/ceo-portal.html` · Expected: 각 파일에 두 id 모두 존재.

- [ ] **Step 5: 커밋**

```bash
git add public/portals/admin-portal.html public/portals/ceo-portal.html
git commit -m "feat(widget): 위젯 추가 모달 상단 AI 챗 섹션 마크업 (admin·ceo)"
```

---

## Task 4: 챗 로직 (widget-builder.js — 추천·미리보기·추가)

**Files:**
- Modify: `public/portals/js/widget-builder.js` (공유 — admin·ceo 동시 적용)

- [ ] **Step 1: `addFromGallery` 를 공유 헬퍼로 리팩터(DRY)**

기존 `addFromGallery(key)` 본문을 아래로 교체하고, 위에 `_addSpecToGrid` 를 추가:

```js
/* spec 1건을 저장+그리드 추가 (갤러리/AI 추천 공용). */
async function _addSpecToGrid(spec) {
  var res = await _saveSpec(spec);
  window.addSpecWidgetToGrid(res.spec, res.id);
  window.closePicker();
  window.showToast('"' + (res.spec.title || spec.title) + '" 위젯을 추가했습니다');
}

async function addFromGallery(key) {
  var spec = _galleryCache[key];
  if (!spec) return;
  try { await _addSpecToGrid(spec); }
  catch (e) { window.showToast('추가 실패: ' + (e && e.message ? e.message : '')); }
}
```

- [ ] **Step 2: AI 챗 함수 추가** (`window.openBuilderForEdit` 정의 부근, IIFE 내부에)

```js
/* ── AI 챗 (피커 상단) — 말 → 템플릿 추천 ── */
async function _previewSpecInto(el, spec) {
  if (!el) return;
  try {
    var r = await fetch('/api/dashboard/widgets/spec', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: spec, dryRunOnly: true }),
    });
    var j = await r.json();
    if (j && j.ok) {
      window.renderSpecResult(el, {
        ok: true, result: j.preview, kind: spec.kind, title: spec.title,
        subtitle: spec.subtitle, format: spec.format, style: spec.style,
      });
    } else { el.innerHTML = '<div class="builder-err">미리보기 실패</div>'; }
  } catch (e) { el.innerHTML = '<div class="builder-err">미리보기 오류</div>'; }
}

function _renderAiSuggestions(suggestions, reply) {
  var box = _$('pickerAiResults');
  if (!box) return;
  box.innerHTML = '';
  if (!suggestions || !suggestions.length) {
    box.innerHTML = '<div class="picker-ai-empty">' + _esc(reply || '비슷한 위젯을 못 찾았어요.') + '</div>';
    return;
  }
  var head = document.createElement('div');
  head.className = 'picker-ai-reply';
  head.textContent = reply || '';
  box.appendChild(head);
  suggestions.forEach(function (s) {
    var card = document.createElement('div');
    card.className = 'picker-ai-card';
    card.innerHTML =
      '<div class="picker-ai-card-head">' +
        '<span class="picker-ai-card-title">' + _esc(s.title) + '</span>' +
        '<button class="tb-btn primary picker-ai-add">+ 추가</button>' +
      '</div>' +
      '<div class="picker-ai-preview"><div class="builder-hint">미리보기 불러오는 중…</div></div>';
    box.appendChild(card);
    _previewSpecInto(card.querySelector('.picker-ai-preview'), s.spec);
    card.querySelector('.picker-ai-add').addEventListener('click', function () {
      _addSpecToGrid(s.spec).catch(function (e) {
        window.showToast('추가 실패: ' + (e && e.message ? e.message : ''));
      });
    });
  });
}

async function submitAiChat() {
  var input = _$('pickerAiInput');
  var box = _$('pickerAiResults');
  if (!input || !box) return;
  var message = (input.value || '').trim();
  if (!message) return;
  box.innerHTML = '<div class="picker-ai-loading">추천을 찾는 중…</div>';
  try {
    var r = await fetch('/api/dashboard/widgets/ai', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message }),
    });
    var j = await r.json();
    if (!r.ok || !j || !j.ok) {
      box.innerHTML = '<div class="picker-ai-empty">' + _esc((j && j.error) || '요청 실패') + '</div>';
      return;
    }
    _renderAiSuggestions(j.suggestions, j.reply);
  } catch (e) {
    box.innerHTML = '<div class="picker-ai-empty">네트워크 오류</div>';
  }
}

function _wireAiChat() {
  var send = _$('pickerAiSend');
  if (send) send.addEventListener('click', submitAiChat);
  var input = _$('pickerAiInput');
  if (input) input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitAiChat(); }
  });
}
```

- [ ] **Step 3: DOMContentLoaded 에서 배선** — 기존 `_wireBuilder();` 옆에 `_wireAiChat();` 추가:

```js
document.addEventListener('DOMContentLoaded', function () {
  window.onPickerOpen = function () { if (!_galleryCache) loadGallery(); };
  _wireBuilder();
  _wireAiChat();
});
```

- [ ] **Step 4: 문법 검증** — Run: `node --check public/portals/js/widget-builder.js` · Expected: 출력 없음(통과)

- [ ] **Step 5: 커밋**

```bash
git add public/portals/js/widget-builder.js
git commit -m "feat(widget): AI 챗 추천 로직 — 라우트 호출·미리보기·원클릭 추가 (DRY)"
```

---

## Task 5: env 샘플 + Flowise 연동 문서

**Files:**
- Modify: `.env.example`
- Modify: `docs/02-design/dashboard-widget-api.md`

- [ ] **Step 1: `.env.example` 에 Flowise 인앱 입구 항목 추가** (Flowise 토큰 섹션 근처)

```bash
# --- Flowise 인앱 AI 위젯 입구 (자연어 → 위젯 추천/생성) ---
# 설정 시 POST /api/dashboard/widgets/ai 가 이 챗플로우 예측 URL 로 프록시(후속 구현).
# 빈값이면 로컬 템플릿 추천 엔진 사용. 키/URL 은 서버 env 전용 — 절대 커밋 금지.
FLOWISE_PREDICTION_URL=""
FLOWISE_API_KEY=""
```

- [ ] **Step 2: `dashboard-widget-api.md` 에 인앱 입구 1절 추가** (§2 인증 뒤 또는 문서 끝)

```markdown
## 인앱 AI 입구 (POST /api/dashboard/widgets/ai)

브라우저(로그인 세션)가 자연어 메시지를 보내면 위젯을 **제안**한다(저장 안 함).
- 지금: 로컬 매처가 가장 비슷한 prefab top-3 추천 → `{ ok, mode:"suggest", reply, suggestions:[{key,title,kind,source,score,spec}] }`.
- 나중: 서버 env `FLOWISE_PREDICTION_URL` 설정 시 같은 라우트가 그 챗플로우로 프록시 → `{ ok, mode:"spec", reply, spec }`. 키/URL 은 서버 전용.
실제 위젯 저장은 기존 `POST /api/dashboard/widgets/spec` 가 담당(인앱은 세션 인증).
```

- [ ] **Step 3: 커밋**

```bash
git add .env.example docs/02-design/dashboard-widget-api.md
git commit -m "docs(widget): 인앱 AI 입구 env(FLOWISE_*) + 연동 문서"
```

---

## Task 6: 통합 검증 (회귀 + 브라우저 E2E)

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: 전체 타입체크** — Run: `npm run typecheck` · Expected: 에러 0
- [ ] **Step 2: 전체 회귀** — Run: `npx vitest run` · Expected: 기존 614 + 신규 11(suggest 8 + route 3) = **625 통과**
- [ ] **Step 3: 문법** — Run: `node --check public/portals/js/widget-builder.js` · Expected: 통과
- [ ] **Step 4: 브라우저 E2E (admin)** — dev 서버(`npm run dev`) 가동 중. 로그인(admin@rtbio.com) 후 `/admin`:
  1. `➕ 위젯 추가` 클릭 → 모달 상단에 "🤖 AI에게 말하기" 입력창 + 힌트 배너 보임.
  2. "이번 달 거래처별 매출" 입력 → `보내기` → 추천 카드(최상위 "Top 5 거래처…") + 각 카드에 실데이터 미리보기 렌더.
  3. 카드 `+ 추가` → 모달 닫힘 + 토스트 + 그리드에 위젯 추가.
  4. (영속) ~5초 후(또는 새로고침) 위젯 유지 확인 — `GET /api/dashboard/widgets` 에 해당 spec 존재.
  5. "점심 뭐먹지" 입력 → "딱 맞는 템플릿을 못 찾았어요…" 폴백 메시지.
- [ ] **Step 5: ceo 포털 스모크** — `/ceo` 대시보드에서도 `➕ 위젯 추가` 모달 상단 AI 섹션 노출 + 추천 동작 확인.
- [ ] **Step 6: 콘솔 에러 0 확인** (read_console_messages level=error).
- [ ] **Step 7: 회귀 결과/E2E 스크린샷·로그를 근거로 최종 커밋(없으면 생략) 후 브랜치 마무리 핸드오프**

---

## 파일 변경 요약

| 파일 | 종류 | 책임 |
|---|---|---|
| `src/lib/widget-spec/suggest.ts` | 신규 | 순수 매처 — 메시지→prefab top-3 |
| `src/lib/widget-spec/suggest.test.ts` | 신규 | 매처 단위테스트 8 |
| `src/app/api/dashboard/widgets/ai/route.ts` | 신규 | 세션 인증 추천 라우트 + Flowise 심 |
| `src/app/api/dashboard/widgets/ai/route.test.ts` | 신규 | 라우트 테스트 3 |
| `public/portals/admin-portal.html` · `ceo-portal.html` | 수정 | 피커 상단 AI 섹션 + CSS |
| `public/portals/js/widget-builder.js` | 수정 | 추천·미리보기·추가 로직(+`_addSpecToGrid` DRY) |
| `.env.example` · `docs/02-design/dashboard-widget-api.md` | 수정 | env + 연동 문서 |

## 범위 / YAGNI

- 실제 Flowise 호출(프록시 본문)·멀티턴 대화·대화형 위젯 수정·임의 LLM 스펙 생성은 **후속**. 이번엔 매처 + 심(env 분기) + 문서까지.
- 우하단 목업 챗봇은 손대지 않음(별개).
- 적용 포털: admin·ceo(대시보드 보유). exec/qc/client 비대상.

## 리스크 / 주의

- 13종 매칭은 한계 있음 → 폴백 메시지 + "곧 AI" 배너로 기대치 관리(설계대로). Flowise 가 본 해결.
- `_addSpecToGrid` 리팩터 시 `addFromGallery` 동작 동일 유지(기존 갤러리 추가 회귀 없게) — E2E 에서 갤러리 추가도 1회 확인.
- 라우트 테스트는 `vi.mock("next-auth")` + `vi.mock("@/lib/auth")` 로 세션만 모킹, `suggest` 는 실제 순수함수 사용.
