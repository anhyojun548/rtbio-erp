# RTBIO Assistant API 스펙

> 지원 챗봇(windyflo 에이전트)이 호출하는 RTBIO 측 엔드포인트 명세.
> 구현: `src/app/api/assistant/{token,catalog,query}/route.ts` · 토큰: `src/lib/assistant/token.ts`
> 작성 2026-06-06 · 상태: **백엔드 구현·검증 완료** (656 테스트 통과 · 핸들러 스모크 7/7)

연동 방법(에이전트 구축·포털 버블)은 → `assistant-agent-guide.md` 참고. 이 문서는 **API 계약**만 다룬다.

---

## 1. 인증 모델 — 2종 토큰

| 토큰 | 발급 | 사용처 | 수명 |
|---|---|---|---|
| **NextAuth 세션** | 로그인 | `POST /api/assistant/token` (포털→토큰 발급) | 세션 정책(30일 슬라이딩) |
| **스코프드 토큰** | `/api/assistant/token` | `GET /catalog` · `POST /query` (windyflo→RTBIO) | **10분** |

- 스코프드 토큰 = HMAC-SHA256 서명 mini-JWT. payload `{ sub(userId), role, clientId, tenantCode, scope:"assistant-read", iat, exp }`.
- 서명 키 = `NEXTAUTH_SECRET` 을 컨텍스트 네임스페이스(`rtbio-assistant-token-v1:`)로 분리 → 세션 토큰과 호환 불가.
- **위·변조 / 만료 / clientId escalation 전부 차단** (서명 검증 + 만료 검사. 단위테스트 6건).
- 미들웨어는 `/api/assistant/*` 의 `Bearer` 요청을 통과시키고, **라우트 핸들러가 토큰을 직접 검증**한다(WIDGET_API_TOKEN 게이트 적용 안 됨).

### 토큰 흐름
```
[포털 브라우저(로그인)]
   └─(세션쿠키)→ POST /api/assistant/token ──→ { token (10분) }
   └─ windyflo prediction 호출 시 overrideConfig.vars.token 로 전달
         └─ windyflo 에이전트 툴 ──(Bearer token)──→ GET /catalog · POST /query
                                                          └─ 토큰의 userId/role/clientId 권한으로만 실행
```

---

## 2. `POST /api/assistant/token`

포털(로그인 세션)이 호출해 **본인 권한** 스코프드 토큰을 발급받는다. 다른 사용자 지정 불가(항상 세션 주체).

| | |
|---|---|
| **인증** | NextAuth 세션 (same-origin, 세션 쿠키) |
| **요청 본문** | 없음 |

**200 OK**
```json
{ "ok": true, "token": "<base64url>.<sig>", "expiresIn": 600 }
```
**오류**
| 상태 | 본문 | 조건 |
|---|---|---|
| 401 | `{ "ok": false, "error": "Unauthorized" }` | 세션 없음 |
| 500 | `{ "ok": false, "error": "서버 인증 시크릿 미설정" }` | `NEXTAUTH_SECRET` 없음(운영) |

> 토큰 수명이 10분이므로 **포털은 windyflo 호출 직전마다 새로 발급**해 항상 유효 상태로 전달할 것.

---

## 3. `GET /api/assistant/catalog`

windyflo 의 `data_catalog` 툴이 호출. 사용 가능한 데이터 source/field/집계/도메인 매핑(정적 메타데이터)을 반환. 사용자별 데이터가 아니라 권한 분기 없음.

| | |
|---|---|
| **인증** | `Authorization: Bearer <스코프드 토큰>` |
| **요청 본문** | 없음 |

**200 OK** (요약)
```json
{
  "ok": true,
  "version": "1.0",
  "description": "RTBIO 대시보드 위젯 데이터 카탈로그 ...",
  "sources": ["invoice","order","payment","ledger","client","product","productSize","transaction","shipment","conference","salesContract","expiry","dataUsage"],
  "catalog": {
    "invoice": { "label": "거래명세서", "fields": { "status": {"type":"enum","values":["DRAFT","ISSUED","SENT","CANCELLED"]}, "totalAmount": {"type":"decimal","agg":true}, "issueDate": {"type":"date"}, "client.name": {"type":"string"}, ... }, "note": "★ 매출의 기본 소스. status in [ISSUED,SENT] + sum:totalAmount ..." },
    "payment": { "...": "..." },
    "ledger":  { "...": "..." }
  },
  "operators": ["eq","ne","gt","gte","lt","lte","in","notIn","contains","startsWith","between"],
  "aggregates": ["sum","count","avg","min","max","countDistinct"],
  "templateVars": ["{{now}}","{{now.startOfMonth}}","{{now.minus(N,'day')}}","{{thisMonth}}", ...],
  "kinds": ["kpi","bar","hbar","line","pie","donut","table","gauge"]
}
```
**오류**: 401 `{ "ok": false, "error": "Unauthorized (assistant token)" }` (토큰 없음/무효/만료)

> `catalog.*.note` 에 **도메인 매핑 힌트**(매출=invoice, 수금=payment, 미수금=ledger.balance)가 들어있다. 에이전트는 데이터 질의 전 반드시 이 엔드포인트를 먼저 호출할 것.

---

## 4. `POST /api/assistant/query`

windyflo 의 `query_data` 툴이 호출. **WidgetSpec(JSON)** 을 받아 실행하고 **집계 결과만** 반환.

| | |
|---|---|
| **인증** | `Authorization: Bearer <스코프드 토큰>` |
| **요청 본문** | `{ "spec": <WidgetSpec 객체 또는 JSON 문자열> }` |

### 🔒 보안 (서버 강제)
- 토큰에 박힌 `userId/role/clientId` 권한으로만 `executeWidgetSpec` 실행.
- **행-레벨 권한을 서버가 강제 주입** — 에이전트가 보낸 `spec.permissions` 는 **무시**:
  - `role=CLIENT` → `rowLevel="ownClientOnly"` (자기 거래처 데이터만)
  - 그 외 역할 → `rowLevel="none"` (역할 기본 권한)
  - ✅ 검증됨: 동일 spec 으로 ADMIN=₩467,994,917(전체) vs CLIENT=₩11,637,836(자기 거래처).
- `executeWidgetSpec` 은 **Prisma delegate + source whitelist** 만 사용 (raw SQL 불가). **읽기 전용**.
- CLIENT 가 거래처 컬럼 없는 소스(product 등)를 ownClientOnly 로 조회 → 안전 차단(400).

**200 OK**
```json
{ "ok": true, "result": { "kind": "kpi", "value": 11637836 } }
```
`result` = `WidgetResult` (kind 별):
| kind | 형태 |
|---|---|
| `kpi` | `{ kind, value: number, comparison?: { current, previous, deltaPercent } }` |
| `bar`·`hbar`·`line`·`pie`·`donut` | `{ kind, series: [ { label: string, value: number }, ... ] }` |
| `table` | `{ kind, rows: [ { ...컬럼 }, ... ] }` |

**오류**
| 상태 | 본문 | 조건 |
|---|---|---|
| 401 | `{ "ok": false, "error": "Unauthorized (assistant token)" }` | 토큰 없음/무효/만료 |
| 400 | `{ "ok": false, "error": "WidgetSpec 검증 실패", "validationErrors": [...], "hint": "..." }` | spec 형식 오류 |
| 400 | `{ "ok": false, "error": "데이터 조회 실패: <메시지>" }` | 실행 오류(잘못된 필드 등) |

---

## 5. WidgetSpec 참조 (query_data 본문)

> 권위 있는 source/field 목록은 항상 **`/api/assistant/catalog` 응답**을 따를 것. 아래는 구조.

```jsonc
{
  "title": "최근 7일 매출",          // 필수, 1~100자
  "kind": "kpi",                      // kpi|bar|hbar|line|pie|donut|table|gauge
  "data": {                          // 필수
    "source": "invoice",             // catalog.sources 중 하나 (whitelist)
    "filter": {                      // 선택 — { 필드: { operator: 값 } }
      "status":    { "in": ["ISSUED","SENT"] },
      "issueDate": { "gte": "{{now.minus(7,'day')}}" }
    },
    "aggregate": { "type": "sum", "field": "totalAmount" }, // count 는 field 생략
    "groupBy": ["client.name"],      // KPI 는 생략/null, bar/pie/line 은 그룹 필드
    "orderBy": [{ "field": "value", "dir": "desc" }], // 선택
    "limit": 5                       // ≤100, Top-N
  }
}
```

**filter operator**: `eq ne gt gte lt lte in notIn contains startsWith between`
**aggregate.type**: `sum count avg min max countDistinct`
**날짜 템플릿 토큰**(executeWidgetSpec 가 런타임 치환):
`{{now}}` `{{now.startOfMonth}}` `{{now.endOfMonth}}` `{{now.startOfYear}}` `{{now.startOfDay}}` `{{now.startOfWeek}}` `{{now.endOfWeek}}` `{{now.minus(N,'day'|'month'|'year')}}` `{{now.plus(N,...)}}` `{{today}}`(YYYY-MM-DD) `{{thisMonth}}`(YYYY-MM)

### 예시 모음
```jsonc
// 이번 달 전체 매출 (KPI)
{ "title":"이번 달 매출", "kind":"kpi",
  "data":{ "source":"invoice", "filter":{ "status":{"in":["ISSUED","SENT"]}, "issueDate":{"gte":"{{now.startOfMonth}}"} },
           "aggregate":{ "type":"sum","field":"totalAmount" } } }

// 거래처별 매출 Top 5 (막대) — bar 는 값 내림차순 자동 정렬
{ "title":"이번 달 거래처별 매출 Top 5", "kind":"bar",
  "data":{ "source":"invoice", "filter":{ "status":{"in":["ISSUED","SENT"]}, "issueDate":{"gte":"{{now.startOfMonth}}"} },
           "aggregate":{ "type":"sum","field":"totalAmount" }, "groupBy":["client.name"], "limit":5 } }

// 전체 미수금 (KPI) — 마감원장 balance
{ "title":"전체 미수금", "kind":"kpi",
  "data":{ "source":"ledger", "filter":{ "closingMonth":{"eq":"{{thisMonth}}"} },
           "aggregate":{ "type":"sum","field":"balance" } } }

// 진행 중 주문 수 (KPI) — count
{ "title":"진행 중 주문", "kind":"kpi",
  "data":{ "source":"order", "filter":{ "status":{"in":["DRAFT","SUBMITTED","CONFIRMED","SHIPPING"]} },
           "aggregate":{ "type":"count" } } }
```

---

## 6. 한계 / 주의

- **로컬(localhost) 도달 불가**: windyflo(클라우드)가 `/api/assistant/*` 를 호출하려면 RTBIO 가 **공인 URL**로 떠 있어야 한다. dev(localhost)는 터널(ngrok 등) 또는 배포 필요. (how-to RAG 는 windyflo 내부라 무관.)
- **EXEC/ADMIN 은 전사 데이터** 조회(기존 위젯 대시보드와 동일 권한). EXEC 를 담당 거래처로 제한하려면 별도 작업.
- 토큰이 외부 windyflo 로 전달됨 → 유출 시 해당 사용자의 **읽기 전용·10분** 범위만 노출(쓰기·타 사용자 불가).
- `invoice` 는 품목→카테고리 조인 groupBy 미지원(InvoiceItem 에 productId 없음). 제품 카테고리별 매출은 현재 불가.

---

## 7. curl (스코프드 토큰 직접 발급해 테스트)
```bash
# (1) 핸들러 in-process 스모크 — 서버 없이 실DB 검증
npx tsx scripts/smoke-assistant.ts

# (2) 라이브: 먼저 브라우저 세션으로 /token 발급 후 토큰 복사
curl -X POST https://<RTBIO_BASE>/api/assistant/token -b "next-auth.session-token=<쿠키>"
# → { "token": "...", "expiresIn": 600 }

curl https://<RTBIO_BASE>/api/assistant/catalog -H "Authorization: Bearer <token>"

curl -X POST https://<RTBIO_BASE>/api/assistant/query \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"spec":{"title":"이번 달 매출","kind":"kpi","data":{"source":"invoice","filter":{"status":{"in":["ISSUED","SENT"]},"issueDate":{"gte":"{{now.startOfMonth}}"}},"aggregate":{"type":"sum","field":"totalAmount"}}}}'
```
