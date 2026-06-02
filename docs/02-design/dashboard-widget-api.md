# Flowise 연동 API — 대시보드 위젯 빌더 가이드

> 외부 LLM 에이전트(Flowise)가 자연어 요청을 **WidgetSpec(JSON)** 으로 변환해
> RTBIO 대시보드에 **실시간 위젯**을 생성하기 위한 통합 가이드.
> 이 문서는 `src/lib/widget-spec/*` + `src/app/api/dashboard/*` 실제 코드와 1:1 로 맞춰져 있다.
>
> 관련: [api-reference.md](./api-reference.md) §15 (대시보드 위젯 전체 endpoint).

---

## 1. 개요 + 에이전트 흐름

Flowise 에이전트는 **데이터 스냅샷이 아니라 spec(실시간 쿼리 정의)** 을 저장한다.
즉 한 번 만들면, 대시보드를 열 때마다 그 spec 이 다시 실행돼 **최신 데이터**로 렌더된다.
에이전트는 "값"이 아니라 "어떻게 구하는가(소스·필터·집계)"를 푸시한다.

에이전트 루프는 4단계다:

```
[1] 학습   GET /api/dashboard/data-catalog   → 어떤 source/field/집계가 가능한가
           GET /api/dashboard/widget-schema  → WidgetSpec 형식 + few-shot 예시
              │
[2] 작성   사용자 요청 → WidgetSpec JSON 조립 (catalog 의 source/field 만 사용)
              │
[3] 검증   POST /api/dashboard/widgets/spec  { spec, dryRunOnly: true }
           → Zod 검증 + 실제 dry-run 실행 → preview(진짜 값) 확인
           → 실패하면 validationErrors[].hint 읽고 spec 수정 후 재시도
              │
[4] 저장   POST /api/dashboard/widgets/spec  { spec, forUser: "user@altibio.com" }
           → 201 { id } — 그 사용자 대시보드에 위젯 생성 완료
```

핵심 규칙:

- **항상 [1] data-catalog 를 먼저 호출**한다. 카탈로그에 없는 source/field 는 절대 쓰지 않는다.
- **저장 전 반드시 [3] dry-run** 으로 검증한다 (잘못된 필드/필터를 미리 잡는다).
- 토큰 흐름에서는 **`forUser`(이메일)로 위젯이 들어갈 대시보드 주인을 지정**한다 (§5 참고).

---

## 2. 인증

모든 호출은 Bearer 토큰 헤더를 붙인다. 토큰 값은 서버 환경변수 `WIDGET_API_TOKEN` 와 일치해야 한다.

```http
Authorization: Bearer <YOUR_TOKEN>
```

> `<YOUR_TOKEN>` 는 플레이스홀더다. 실제 토큰 값을 이 문서나 코드, Flowise 공유 플로우에
> **절대 하드코딩하지 않는다.** 운영 비밀로 관리한다.

### 동작 모델

- 토큰이 유효하면 미들웨어가 요청을 **고정 서비스 계정 `svc-integration`(role=ADMIN)** 세션으로
  브리지한다. 즉 토큰 요청은 ADMIN 권한으로 GET 데이터를 읽을 수 있다.
- 서비스 계정은 실제 대시보드 소유자가 아니므로, 위젯을 저장할 때는 **`forUser` 로 대상 사용자
  이메일을 지정**해야 그 사람의 대시보드에 위젯이 생긴다 (§5).

### 스코프 (토큰으로 허용되는 것)

| 요청 | 허용 여부 | 응답 |
|---|---|---|
| `GET /api/*` (모든 GET) | ✅ 허용 | 정상 |
| `POST /api/dashboard/widgets/spec` | ✅ 허용 (유일한 쓰기) | 정상 |
| 그 외 모든 쓰기 (`POST/PATCH/DELETE …`) | ❌ 거부 | **403** `{ ok:false, error:"토큰은 읽기 + 위젯 생성만 허용됩니다" }` |
| `Authorization: Bearer …` 인데 `/api/` 경로 아님 | ❌ 거부 | **403** `{ ok:false, error:"Forbidden" }` |
| 토큰 누락/불일치 | ❌ 거부 | **401** `{ ok:false, error:"Invalid API token" }` |

> 토큰이 미설정(`WIDGET_API_TOKEN` 빈 값)이면 기능 자체가 비활성 — 모든 토큰 요청은 401.
> 검증은 상수시간 비교(timing-safe)로 수행된다.

### 보안 노트

- 토큰은 **env 전용**(`WIDGET_API_TOKEN`). 코드/문서/리포에 커밋 금지.
- **회전 가능**한 비밀로 다룬다 (유출 시 env 교체만으로 무효화).
- 토큰 = ADMIN 읽기 권한 + 위젯 생성 권한. 비밀번호급으로 취급한다.

---

## 3. 도구 ① — `GET /api/dashboard/data-catalog`

**목적**: "무엇을 조회할 수 있는가" — source 별 필드/타입/집계가능여부/노트 + operator/aggregate/템플릿변수 목록.
실제 데이터는 노출하지 않고 **스키마 메타데이터만** 반환한다. 에이전트는 이걸 보고 올바른 `data.source`/`filter`/`aggregate` 를 작성한다.

### 응답 (형태 — 일부 발췌)

```jsonc
{
  "ok": true,
  "version": "1.0",
  "description": "RTBIO 대시보드 위젯 데이터 카탈로그. WidgetSpec.data 작성 시 이 source/field 만 사용 가능 …",
  "sources": ["invoice","order","payment","ledger","client","product",
              "productSize","transaction","shipment","conference","expiry","dataUsage"],
  "catalog": {
    "invoice": {
      "label": "거래명세서",
      "fields": {
        "status":       { "type":"enum", "values":["DRAFT","ISSUED","SENT","CANCELLED"], "desc":"발행 상태" },
        "totalAmount":  { "type":"decimal", "agg":true, "desc":"공급가+VAT 합계" },
        "supplyAmount": { "type":"decimal", "agg":true, "desc":"공급가액" },
        "vatAmount":    { "type":"decimal", "agg":true, "desc":"부가세" },
        "issueDate":    { "type":"date", "desc":"발행일" },
        "sentAt":       { "type":"date", "desc":"발송일" },
        "client.name":  { "type":"string", "desc":"거래처명 (nested)" },
        "client.type":  { "type":"enum", "values":["HOSPITAL","AGENCY","OTHER"], "desc":"거래처 유형" }
      },
      "note": "매출 집계는 보통 status in [ISSUED,SENT] 필터 + sum:totalAmount"
    },
    "order":       { "label":"발주", "fields": { "status": { "type":"enum",
                       "values":["DRAFT","SUBMITTED","CONFIRMED","SHIPPING","COMPLETED","CANCELLED","HELD","REJECTED"] },
                       "orderDate":{"type":"date"}, "billingMonth":{"type":"string"}, "client.name":{"type":"string"} },
                     "note":"진행 중 주문 = status in [DRAFT,SUBMITTED,CONFIRMED,SHIPPING]. count 집계." },
    "payment":     { "label":"수금",   "fields": { "status":{"type":"enum","values":["PENDING","PARTIAL","PAID","OVERDUE"]},
                       "amount":{"type":"decimal","agg":true}, "paidAt":{"type":"date"} },
                     "note":"실수금 = status in [PARTIAL,PAID] + sum:amount" },
    "ledger":      { "label":"마감원장 (ClosingLedger)", "fields": { "closingMonth":{"type":"string"},
                       "carryOver":{"type":"decimal","agg":true}, "monthlySales":{"type":"decimal","agg":true},
                       "received":{"type":"decimal","agg":true}, "balance":{"type":"decimal","agg":true} },
                     "note":"미수금 합계 = closingMonth={{thisMonth}} + sum:balance" },
    "client":      { "label":"거래처", "fields": { "type":{"type":"enum","values":["HOSPITAL","AGENCY","OTHER"]},
                       "active":{"type":"boolean"}, "createdAt":{"type":"date"} },
                     "note":"활성 거래처 수 = active=true + count. 신규 = createdAt gte {{now.minus(30,'day')}}" },
    "product":     { "label":"제품", "fields": { "category":{"type":"string"}, "active":{"type":"boolean"},
                       "basePrice":{"type":"decimal","agg":true} } },
    "productSize": { "label":"제품 사이즈 (재고)", "fields": { "sizeCode":{"type":"string"},
                       "physicalStock":{"type":"int","agg":true}, "availableStock":{"type":"int","agg":true},
                       "reorderPoint":{"type":"int"} },
                     "note":"재고 부족 = availableStock lte reorderPoint. 단순 임계 비교는 앱-레벨 분류 필요(classifyStock)." },
    "transaction": { "label":"매입매출 거래원장 (41K)", "fields": { "kind":{"type":"string"}, "clientCode":{"type":"string"},
                       "clientName":{"type":"string"}, "productCode":{"type":"string"}, "amount":{"type":"decimal","agg":true},
                       "txnDate":{"type":"date"} },
                     "note":"대량 데이터. 반드시 날짜/거래처 필터 + limit 권장." },
    "shipment":    { "label":"출고", "fields": { "completedAt":{"type":"date"}, "currentStage.label":{"type":"string"} } },
    "conference":  { "label":"학회", "fields": { "startDate":{"type":"date"}, "endDate":{"type":"date"}, "name":{"type":"string"} } },
    "expiry":      { "label":"유통기한 로트", "fields": { "expiryDate":{"type":"date"}, "remainingQty":{"type":"int","agg":true} } },
    "dataUsage":   { "label":"데이터 사용량", "fields": { "month":{"type":"string"}, "category":{"type":"string"},
                       "amount":{"type":"decimal","agg":true} } }
  },
  "operators":   ["eq","ne","gt","gte","lt","lte","in","notIn","contains","startsWith","between"],
  "aggregates":  ["sum","count","avg","min","max","countDistinct"],
  "templateVars":["{{now}}","{{now.startOfMonth}}","{{now.endOfMonth}}","{{now.startOfYear}}",
                  "{{now.minus(N,'day')}}","{{now.minus(N,'month')}}","{{now.plus(N,'month')}}",
                  "{{now.startOfMonth.plus(1,'month')}}","{{today}}","{{thisMonth}}"],
  "kinds":       ["kpi","bar","hbar","line","pie","donut","table","gauge"]
}
```

### 사용법

- `catalog[source].fields` 의 키만 `filter`/`aggregate.field`/`groupBy`/`orderBy.field` 에 쓴다.
- `agg:true` 인 필드만 `sum/avg/min/max` 의 대상으로 적합하다 (`count` 는 `field:null`).
- nested 필드는 점 표기 그대로 (`client.name`, `client.type`).
- `note` 는 그 source 의 전형적 집계 패턴 힌트 — 그대로 따르면 안전하다.

---

## 4. 도구 ② — `GET /api/dashboard/widget-schema`

**목적**: "어떤 형식으로 쓰는가" — WidgetSpec 최상위 구조 가이드 + 검증된 prefab 10종(few-shot 예시) + tips.
data-catalog(무엇) + widget-schema(형식) 두 도구를 조합하면 에이전트가 올바른 spec 을 만들 수 있다.

### 응답 (구조)

```jsonc
{
  "ok": true,
  "version": "1.0",
  "description": "RTBIO 대시보드 위젯 spec 형식 …",
  "structure": {
    "version": "'1.0' 고정",
    "title": "위젯 제목 (1~100자, 필수)",
    "subtitle": "부제목 (선택)",
    "kind": "시각화 종류 — kpi | bar | hbar | line | pie | donut | table | gauge",
    "layout": "{ w(1~12), h(1~12), x?, y? } — grid 위치/크기",
    "data": {
      "source": "데이터 소스 — invoice | order | … | dataUsage",
      "filter": "{ 필드명: { operator: 값 } } — nested 는 dot 표기(client.createdAt)",
      "aggregate": "{ type, field } — type: sum/count/avg/min/max/countDistinct",
      "groupBy": "['필드'] — KPI 는 null, bar/pie 는 그룹 필드",
      "orderBy": "[{ field, dir }]",
      "limit": "≤100"
    },
    "comparison": "{ type: previousPeriod|previousYear|target|none, label, format } — KPI 비교 ▲▼",
    "format": "{ value: { type: number|currency|percent, prefix, suffix, compact, decimals }, legend }",
    "style": "{ color: #RRGGBB, icon: 이모지, thresholds: [{value,color,label}] }",
    "action": "{ type: navigate|none, to: 경로 }",
    "permissions": "{ roles: [...], rowLevel: none|ownClientOnly }"
  },
  "operators":  ["eq","ne","gt","gte","lt","lte","in","notIn","contains","startsWith","between"],
  "aggregates": ["sum","count","avg","min","max","countDistinct"],
  "kinds":      ["kpi","bar","hbar","line","pie","donut","table","gauge"],
  "examples":   { /* 검증된 prefab 10종 — §7 참고 */ },
  "tips": [
    "매출 위젯은 source=invoice, filter.status in [ISSUED,SENT], aggregate sum:totalAmount",
    "이번 달 범위는 filter 에 { gte: '{{now.startOfMonth}}', lt: '{{now.startOfMonth.plus(1,month)}}' }",
    "Top N 거래처는 groupBy + orderBy desc + limit",
    "KPI 는 groupBy=null. bar/pie 는 groupBy 필수.",
    "CLIENT 거래처 포털 위젯이면 permissions.rowLevel='ownClientOnly' 로 자기 데이터만."
  ]
}
```

`examples` 는 §7 의 prefab JSON 과 동일하다 — 에이전트의 few-shot 모범으로 그대로 쓴다.

---

## 5. 도구 ③ — `POST /api/dashboard/widgets/spec`

에이전트의 메인 쓰기 도구. WidgetSpec 을 받아 **검증 → dry-run → (선택) 저장**한다.

### 요청 body

```jsonc
{
  "spec":       { /* WidgetSpec — §6 */ },   // 필수
  "dryRunOnly": true,                          // 선택 — true 면 저장 없이 검증+미리보기만
  "forUser":    "user@altibio.com"             // 선택 — 위젯이 들어갈 대상 사용자 이메일
}
```

- `spec` 없이 body 자체가 spec 이어도 동작한다(`body.spec ?? body`). 하지만 **`{ spec }` 래핑을 권장**한다(`dryRunOnly`/`forUser` 와 섞기 위해).
- `dryRunOnly: true` → 저장하지 않고 검증 + 실제 dry-run 결과(preview)만 반환.
- `forUser`(이메일) → 그 사용자 대시보드에 저장. **토큰 흐름에서는 사실상 필수** — 미지정 시 서비스 계정(`svc-integration`) 소유로 저장돼 실제 사용자 대시보드에 안 보인다. 해당 이메일 사용자가 없으면 400.

### 처리 순서 (route 코드 기준)

1. **Zod 검증** (`validateWidgetSpec`) — 실패 시 400 + 교정 힌트.
2. **dry-run** (`executeWidgetSpec` 실제 실행) — 잘못된 source/field/filter 를 여기서 차단.
3. `dryRunOnly===true` → 저장 없이 `{ ok, dryRun, spec, preview }`.
4. 저장 → `forUser` 해소 → `DashboardWidget` 생성(`preset:"spec:custom"`, `config.spec` 에 full spec 보존) → 201.

### 응답 — 3가지 형태

**(가) 성공 — 201 (저장)** 또는 dry-run 성공 (`200 { ok, dryRun:true, … }`)

```jsonc
// dryRunOnly 없이 저장:
{ "ok": true, "id": "clxy…", "spec": { /* 정규화된 spec */ }, "preview": { /* 아래 */ } }

// dryRunOnly: true:
{ "ok": true, "dryRun": true, "spec": { … }, "preview": { … } }
```

`preview`(= `executeWidgetSpec` 결과)는 kind 에 따라:
- KPI → `{ "kind":"kpi", "value": 12300000, "comparison": { "current":…, "previous":…, "deltaPercent":… } }`
- 차트(bar/hbar/line/pie/donut) → `{ "kind":"hbar", "series":[{ "label":"…", "value":… }, …] }`
- 테이블 → `{ "kind":"table", "rows":[ { … }, … ] }`

**(나) 검증 실패 — 400 (Zod)**

```jsonc
{
  "ok": false,
  "error": "WidgetSpec 검증 실패",
  "validationErrors": [
    { "path": "data.source", "message": "Invalid enum value …",
      "hint": "source 는 다음 중 하나: invoice, order, payment, ledger, client, product, productSize, transaction, shipment, conference, expiry, dataUsage" }
  ],
  "docs": "/api/dashboard/widget-schema 와 /api/dashboard/data-catalog 참고"
}
```

`hint` 가 붙는 자주 틀리는 필드: `kind`, `data.source`, `data.aggregate.type`, `permissions.roles`.

**(다) dry-run 실패 — 400 (쿼리 불가)**

```jsonc
{
  "ok": false,
  "error": "위젯 데이터 조회 실패 (dry-run): <원인 메시지>",
  "hint": "data.source/field/filter 가 /api/dashboard/data-catalog 와 일치하는지 확인하세요."
}
```

> `forUser` 사용자를 못 찾으면 별도 400: `{ ok:false, error:"forUser 사용자를 찾을 수 없습니다: <email>" }`.

### 자가 교정 (self-correct)

에이전트는 400 을 받으면:
1. **(나)** 면 `validationErrors[].path` 로 어느 필드가 틀렸는지, `.hint` 로 허용값을 읽어 spec 을 고친다.
2. **(다)** 면 `error` 메시지(예: "sum 집계에는 field 가 필요합니다", "between 은 [min, max] 2-원소 배열이어야 합니다")를 읽고 data-catalog 와 대조해 source/field/filter 를 고친다.
3. 수정한 spec 으로 다시 `dryRunOnly:true` POST → 통과하면 `dryRunOnly` 없이 저장.

---

## 6. WidgetSpec 레퍼런스

`src/lib/widget-spec/schema.ts` 의 `widgetSpecSchema` 기준. (✓ = 필수)

| 필드 | 타입 / 값 | 기본값 | 비고 |
|---|---|---|---|
| `version` | `"1.0"` 리터럴 | `"1.0"` | 고정 |
| `title` ✓ | string (1~100자) | — | 위젯 제목 |
| `subtitle` | string (≤200자) | — | 선택 |
| `kind` ✓ | `WIDGET_KINDS` 중 1 | — | 시각화 종류 |
| `layout` | `{ w:1~12, h:1~12, x?:0~11, y?:≥0 }` | `{ w:3, h:2 }` | grid 위치/크기. `w/h` 가 위젯 저장 width/height 가 됨 |
| `data` ✓ | 아래 표 | — | 위젯의 핵심 — 조회 정의 |
| `comparison` | `{ type, label?, targetValue?, format }` | — | KPI 비교 ▲▼ |
| `format` | `{ value?, legend? }` | — | 표시 포맷 |
| `style` | `{ color?, icon?, thresholds? }` | — | 시각 스타일 |
| `action` | `{ type: navigate\|none, to? }` | `type:none` | 클릭 시 이동 |
| `permissions` | `{ roles:[…], rowLevel? }` | — | 접근/행-레벨 권한 |
| `llm` | `{ createdBy?, userPrompt?, confidence? }` | — | LLM 생성 메타(선택) |

### `data` 섹션

| 필드 | 타입 / 값 | 비고 |
|---|---|---|
| `source` ✓ | `WIDGET_SOURCES` 중 1 | whitelist, read-only |
| `filter` | `{ "필드": { "operator": 값 } }` | nested 는 dot 표기. 생략 시 전체 |
| `aggregate` | `{ type: AGGREGATE_TYPES, field: string\|null }` | `count` 는 `field:null`(행 수) |
| `groupBy` | `string[] \| null` | KPI 는 `null`, bar/pie/line 은 `['status']` 등 |
| `orderBy` | `[{ field, dir: "asc"\|"desc" }]` | `dir` 기본 `desc`. list/top-N 용 |
| `limit` | int 1~100 | 최대 행 수 |

### Enum 전체 (코드와 동일)

```
WIDGET_SOURCES (12)  invoice · order · payment · ledger · client · product ·
                     productSize · transaction · shipment · conference · expiry · dataUsage

WIDGET_KINDS (8)     kpi · bar · hbar · line · pie · donut · table · gauge

FILTER_OPERATORS(11) eq · ne · gt · gte · lt · lte · in · notIn · contains · startsWith · between
                     · contains/startsWith 는 대소문자 무시(insensitive)
                     · in/notIn 값은 배열,  between 값은 [min, max] 2-원소 배열

AGGREGATE_TYPES (6)  sum · count · avg · min · max · countDistinct
```

`comparison.type`: `previousPeriod` | `previousYear` | `target` | `none` ·
`comparison.format`: `delta-absolute` | `delta-percent`(기본).
`format.value.type`: `number` | `currency` | `percent` · `style.color`/`thresholds[].color`: `#RRGGBB`.
`permissions.roles`: `TENANT_OWNER`/`ADMIN`/`EXEC`/`QC`/`CLIENT`/`SUPER_ADMIN` ·
`permissions.rowLevel`: `none`(기본) | `ownClientOnly`(CLIENT 는 자기 거래처만).

### 날짜 템플릿 변수

filter 의 날짜 값에 자연어 대신 템플릿을 쓰면 런타임에 실제 날짜로 치환된다.
data-catalog 가 반환하는 `templateVars` 목록:

```
{{now}}                          현재 시각
{{now.startOfMonth}}             이번 달 1일 00:00
{{now.endOfMonth}}               이번 달 말일 23:59:59
{{now.startOfYear}}              올해 1월 1일
{{now.minus(N,'day')}}           N일 전     (예: {{now.minus(30,'day')}})
{{now.minus(N,'month')}}         N개월 전
{{now.plus(N,'month')}}          N개월 후
{{now.startOfMonth.plus(1,'month')}}   다음 달 1일 (이번 달 범위 상한)
{{today}}                        오늘 'YYYY-MM-DD' (문자열)
{{thisMonth}}                    'YYYY-MM' (문자열 — ledger.closingMonth 등)
```

**이번 달 범위** 관용구:
`{ "gte": "{{now.startOfMonth}}", "lt": "{{now.startOfMonth.plus(1,'month')}}" }`

> 참고(엔진 추가 지원): 실행기는 위 목록 외에 `startOfDay` 와 `'week'` 단위도 해석한다
> (예: `{{now.startOfDay}}`, `{{now.startOfDay.plus(30,'day')}}`, `{{now.minus(1,'week')}}`).
> chaining 은 좌→우 순차 적용된다. `today`/`thisMonth` 는 단독 사용만 가능(체이닝 불가).

---

## 7. few-shot 예시 5개 (검증된 prefab)

아래는 `src/lib/widget-spec/presets.ts` 의 실제 `PREFAB_SPECS` 다 — 그대로 모범 예시로 쓴다.

**① 이번 달 매출 (KPI + 전월 대비)** — ISSUED+SENT 거래명세서 `totalAmount` 합.
```jsonc
{
  "version": "1.0", "title": "이번 달 매출", "kind": "kpi", "layout": { "w": 3, "h": 2 },
  "data": {
    "source": "invoice",
    "filter": {
      "status": { "in": ["ISSUED", "SENT"] },
      "issueDate": { "gte": "{{now.startOfMonth}}", "lt": "{{now.startOfMonth.plus(1,'month')}}" }
    },
    "aggregate": { "type": "sum", "field": "totalAmount" }
  },
  "comparison": { "type": "previousPeriod", "label": "전월 대비", "format": "delta-percent" },
  "format": { "value": { "type": "currency", "prefix": "₩", "compact": true } },
  "style": { "icon": "💰", "color": "#1B3A5C" },
  "action": { "type": "navigate", "to": "/admin/invoices" }
}
```

**② 미수금 합계 (KPI)** — 이번 달 마감원장 `balance` 합. (`{{thisMonth}}` 문자열 매칭)
```jsonc
{
  "version": "1.0", "title": "미수금 합계", "kind": "kpi", "layout": { "w": 3, "h": 2 },
  "data": {
    "source": "ledger",
    "filter": { "closingMonth": { "eq": "{{thisMonth}}" } },
    "aggregate": { "type": "sum", "field": "balance" }
  },
  "format": { "value": { "type": "currency", "prefix": "₩", "compact": true } },
  "style": { "icon": "🧾", "color": "#B45309" },
  "action": { "type": "navigate", "to": "/admin/ledger" }
}
```

**③ Top 5 거래처 (이달 매출, 가로 막대)** — invoice 를 `clientId` 로 groupBy(sum) desc 5.
```jsonc
{
  "version": "1.0", "title": "Top 5 거래처 (이달 매출)", "kind": "hbar", "layout": { "w": 6, "h": 4 },
  "data": {
    "source": "invoice",
    "filter": {
      "status": { "in": ["ISSUED", "SENT"] },
      "issueDate": { "gte": "{{now.startOfMonth}}", "lt": "{{now.startOfMonth.plus(1,'month')}}" }
    },
    "aggregate": { "type": "sum", "field": "totalAmount" },
    "groupBy": ["clientId"],
    "limit": 5
  },
  "format": { "value": { "type": "currency", "prefix": "₩", "compact": true } },
  "style": { "icon": "🏆", "color": "#1B3A5C" },
  "action": { "type": "navigate", "to": "/admin/reports/monthly" }
}
```

**④ 재고 부족 품목 Top 5 (테이블)** — reorderPoint>0 활성 제품, `availableStock` 오름차순 5.
```jsonc
{
  "version": "1.0", "title": "재고 부족 품목 Top 5", "kind": "table", "layout": { "w": 6, "h": 4 },
  "data": {
    "source": "productSize",
    "filter": { "reorderPoint": { "gt": 0 }, "product.active": { "eq": true } },
    "orderBy": [{ "field": "availableStock", "dir": "asc" }],
    "limit": 5
  },
  "style": { "icon": "⚠️", "color": "#DC2626" },
  "action": { "type": "navigate", "to": "/admin/alerts/stock" }
}
```

**⑤ 진행 중 주문 (KPI, count)** — DRAFT+SUBMITTED+CONFIRMED+SHIPPING 건수.
```jsonc
{
  "version": "1.0", "title": "진행 중 주문", "kind": "kpi", "layout": { "w": 3, "h": 2 },
  "data": {
    "source": "order",
    "filter": { "status": { "in": ["DRAFT", "SUBMITTED", "CONFIRMED", "SHIPPING"] } },
    "aggregate": { "type": "count", "field": null }
  },
  "format": { "value": { "type": "number", "suffix": "건" } },
  "style": { "icon": "📦", "color": "#1D4ED8" },
  "action": { "type": "navigate", "to": "/admin/orders" }
}
```

> 다른 prefab(활성 거래처, 재고 임계치 알림, 만료 임박 계약, 만료 임박 계약 Top 5, 최근 주문 5건)은
> `widget-schema` 응답의 `examples` 에 전부 포함돼 있다.

---

## 8. Flowise 설정

에이전트에 **도구 3개**를 등록하고, 시스템 프롬프트로 규칙을 주입한다.

### 도구 노드

**도구 A — Requests GET (data-catalog)**
- URL: `https://<your-host>/api/dashboard/data-catalog`
- Headers: `{ "Authorization": "Bearer <YOUR_TOKEN>" }`

**도구 B — Requests GET (widget-schema)**
- URL: `https://<your-host>/api/dashboard/widget-schema`
- Headers: `{ "Authorization": "Bearer <YOUR_TOKEN>" }`

**도구 C — Requests POST (위젯 저장/검증)**
- URL: `https://<your-host>/api/dashboard/widgets/spec`
- Headers: `{ "Authorization": "Bearer <YOUR_TOKEN>", "Content-Type": "application/json" }`
- Body(JSON): `{ "spec": { … }, "dryRunOnly": true, "forUser": "<requester-email>" }`
  - 먼저 `dryRunOnly:true` 로 검증 → 통과하면 `dryRunOnly` 빼고 다시 호출해 저장.

> `<YOUR_TOKEN>` 은 Flowise Credential/환경변수로 주입하고 플로우 JSON 에 평문 저장하지 않는다.

### 에이전트 시스템 프롬프트 (붙여넣기용)

```
너는 RTBIO ERP 대시보드 위젯 빌더다. 사용자의 자연어 요청을 WidgetSpec(JSON) 으로 만들어
대시보드에 실시간 위젯을 생성한다. 너는 데이터 값이 아니라 "조회 정의(spec)"를 저장한다 —
위젯은 열릴 때마다 spec 으로 최신 데이터를 다시 계산한다.

반드시 지키는 규칙:
1. 작업 시작 시 항상 GET /api/dashboard/data-catalog 를 먼저 호출해 사용 가능한
   source 와 field 를 확인한다. 필요하면 GET /api/dashboard/widget-schema 로 형식과
   few-shot 예시도 가져온다.
2. data.source 와 모든 field(filter/aggregate.field/groupBy/orderBy.field)는 카탈로그에
   존재하는 것만 쓴다. 카탈로그에 없는 필드는 절대 지어내지 않는다.
3. 위젯 종류 규칙:
   - KPI(kind:"kpi")는 단일 숫자다. groupBy 를 쓰지 않는다(null). aggregate 필수.
   - bar/hbar/pie/donut/line 은 groupBy(예: ["status"], ["clientId"]) 와 aggregate 가 모두 필요하다.
   - table 은 aggregate 없이 orderBy + limit 로 행 목록을 만든다.
   - count 집계는 field: null. sum/avg/min/max 는 agg:true 인 숫자 field 를 지정한다.
4. 날짜 조건은 자연어 대신 템플릿 변수를 쓴다:
   - 이번 달 범위: { "gte": "{{now.startOfMonth}}", "lt": "{{now.startOfMonth.plus(1,'month')}}" }
   - 최근 30일: { "gte": "{{now.minus(30,'day')}}" }
   - 월 문자열(ledger.closingMonth 등): { "eq": "{{thisMonth}}" }
5. 매출 위젯은 source:"invoice", filter.status in ["ISSUED","SENT"], aggregate sum:totalAmount 패턴을 따른다.
   실수금은 source:"payment" status in ["PARTIAL","PAID"] sum:amount, 미수금은 source:"ledger" sum:balance.
6. 저장 전에 항상 POST /api/dashboard/widgets/spec 를 { "spec": <spec>, "dryRunOnly": true } 로
   먼저 호출해 검증한다. preview 로 값이 말이 되는지 확인한다.
7. 응답이 400 이면:
   - validationErrors 가 있으면 각 항목의 path 와 hint 를 읽어 해당 필드를 고친다.
   - error 메시지(dry-run 실패)면 그 메시지를 읽고 source/field/filter 를 카탈로그와 대조해 고친다.
   - 고친 spec 으로 다시 dryRunOnly:true 검증 → 통과하면 저장한다.
8. 저장 호출은 dryRunOnly 를 빼고, forUser 에 요청한 사람의 이메일을 넣는다
   (그래야 그 사람 대시보드에 위젯이 생긴다). forUser 를 비우지 않는다.
9. 응답이 201 이고 id 가 있으면 성공이다. 사용자에게 만든 위젯의 제목·종류·핵심 필터를 한 줄로 요약해 알린다.

절대 하지 않는 것: 카탈로그에 없는 source/field 사용, dry-run 생략, forUser 누락,
임의 SQL/엔드포인트 호출(허용 쓰기는 POST /api/dashboard/widgets/spec 하나뿐이다).
```
