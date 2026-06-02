# 대시보드 위젯 — 갤러리(A) + 빌더(B) + Flowise 연동(C) 설계

**작성일**: 2026-06-02 · **상태**: 설계 확정(구현 대기)

## 목표 (한 문장)

이미 완비된 위젯 spec 엔진(`executeWidgetSpec` + data-catalog + dry-run) 위에, 사용자가 **실데이터로 위젯을 직접 만들 수 있는 갤러리(A)·빌더(B)** 를 붙이고, **외부 Flowise 에이전트가 자연어로 위젯을 생성(C)** 할 수 있도록 토큰 인증 + API 문서를 제공한다.

## 배경 / 문제

현재 위젯 추가 화면(`public/portals/widget-dashboard.js` + `widget-dashboard.html`)에는 **서로 연결 안 된 두 시스템**이 한 화면에 얹혀 있다:

1. **프로토타입 MOCK 위젯(구)** — 하드코딩 `PRESETS` 19종 + `MOCK` getter가 `window.*` 전역에서 계산. 커스텀 빌더는 정적 `PREVIEW_DATA`/`TABLE_COLUMNS`로만 동작.
2. **Spec 위젯(신, WSPEC)** — `executeWidgetSpec`가 실제 Prisma 쿼리. UI에서 직접 만들 경로가 없음(시드/외부 에이전트만).

사용자가 보는 "위젯 추가"는 구 MOCK UI에 연결돼 있어 신 엔진을 못 부른다. 그 결과:

- **데이터 안 나옴** — ① 커스텀/빈 위젯은 `preset=null`이라 `"데이터 소스를 설정하세요"` 플레이스홀더만 뜨고, DB 동기화에서 `preset` 없는 항목은 제외돼 **새로고침하면 사라짐**. ② `notifications`/`procurement`/`udi` 프리셋은 백킹 데이터가 비어 항상 0/빈칸. ③ 빌더 미리보기는 정적 `PREVIEW_DATA`라 실제와 무관.
- **UX 불량** — 타입 먼저·데이터 나중, "빈 위젯" 함정, 편집 모달 깊숙이 숨은 빌더, 미리보기와 저장 결과 불일치.

핵심: **쿼리 빌더를 새로 발명할 필요 없음.** 백엔드 엔진은 이미 있고, UI만 거기에 배선하면 된다.

## 이미 존재하는 백엔드 (재사용)

| 자산 | 위치 | 역할 |
|---|---|---|
| `widgetSpecSchema` | `src/lib/widget-spec/schema.ts` | 위젯 1개 = JSON 1개. 소스 12·연산자 11·집계 6·차트 8·비교·포맷·날짜템플릿변수 |
| `executeWidgetSpec` | `src/lib/widget-spec/execute.ts` | spec → Prisma 쿼리 (실데이터 엔진) |
| data-catalog | `GET /api/dashboard/data-catalog` | 소스별 필드·타입·집계가능여부 (의미계층) |
| widget-schema | `GET /api/dashboard/widget-schema` | spec 형식 + `examples: PREFAB_SPECS`(검증된 10종) |
| spec 저장/미리보기 | `POST /api/dashboard/widgets/spec` | 검증 + `dryRunOnly` 미리보기 + 저장 |
| prefab specs | `src/lib/widget-spec/presets.ts` | `PREFAB_SPECS`(10종), `PREFAB_KEYS` |
| spec 렌더러 | `widget-dashboard.js` | `renderSpecWidget`, `_renderSpecKpi/_renderSpecChart/_renderSpecTable/_renderSpecGauge` |
| 그리드 spec 지원 | `widget-dashboard.js` | `dataset.widgetSpec`, `widgetId`, `_specCache`, save/load 가 config.spec 보존 |

## 아키텍처 — 하나의 엔진, 세 입력

세 입력 방식이 **전부 같은 WidgetSpec JSON**을 만들어 **같은 파이프라인**을 탄다:

```
[A 갤러리]  prefab spec 선택 ─┐
[B 빌더]   폼으로 spec 조립 ─┼─→ POST /widgets/spec ─→ 검증 + dryRun 미리보기 + 저장 ─→ executeWidgetSpec 렌더
[C Flowise] LLM이 spec 생성  ─┘        (이미 존재)                                         (이미 존재)
```

신규 백엔드는 **C용 토큰 인증뿐**. A·B는 프론트가 기존 엔진에 배선.

---

## A — 큐레이트 갤러리

- "➕ 위젯 추가" → **갤러리 모달**. 소스 = `GET /api/dashboard/widget-schema`의 `examples`(prefab spec 10종)를 카테고리(매출·미수금·재고·거래처·주문)로 카드 표시.
- 카드 클릭 → `POST /widgets/spec {spec}` → 반환 id로 그리드에 spec 위젯 추가 → 기존 `renderSpecWidget`로 실데이터 렌더.
- 날짜는 spec 템플릿 변수(`{{now.startOfMonth}}`)라 "이번 달"이 자동 갱신 → 별도 파라미터 조정 불필요.
- **"빈 위젯" 카드 제거** (죽은 플레이스홀더 함정 삭제).

## B — 측정값+분류 빌더 (가이드 폼)

빌더 UX 3안 중 **가이드 폼** 채택(② 프리셋 복제·③ 드래그 선반은 과함, YAGNI):

**모달 흐름**
1. 데이터 소스 (12종, `/data-catalog`)
2. 시각화 (kpi/bar/hbar/line/pie/donut/table/gauge) + 짧은 가이드(kpi=단일값, bar/pie=분류별, table=목록)
3. 측정값 = `aggregate {type, field}` — 카탈로그의 `agg:true` 필드 + count
4. 분류 = `groupBy` — bar/pie/line일 때만 노출
5. 필터 — 필드+연산자+값 행 추가. 값엔 "이번 달/지난 30일" 등 **템플릿 변수 도우미**
6. (table/Top-N) 정렬·limit

**실시간 미리보기**: 입력 변경 시(디바운스) `POST /widgets/spec {dryRunOnly:true, spec}` → **진짜 DB 데이터**를 기존 spec 렌더러가 그림. (정적 `PREVIEW_DATA` 폐기)

**저장**: `dryRunOnly` 없이 POST → 그리드에 spec 위젯 추가.

**관심사 분리**: 갤러리+빌더+미리보기는 신규 `public/portals/js/widget-builder.js`로 분리. `widget-dashboard.js`는 그리드/영속/렌더만 담당하고 spec 렌더러를 `window`로 노출해 빌더가 재사용.

## C — 토큰 인증 + Flowise 문서

Flowise 에이전트가 **Requests GET으로 데이터를 읽고, Requests POST로 위젯 spec을 밀어넣는** 흐름. 규칙은 에이전트 프롬프트(또는 런타임 GET)로 주입.

**토큰 권한 (확정: 읽기 전면개방 + 쓰기는 위젯만)**
- ✅ 모든 `GET /api/*` (clients·orders·invoices·payments·ledger·products·inventory…) — 원시 데이터 자유 조회
- ✅ `POST /api/dashboard/widgets/spec` — 위젯 dry-run/저장
- ❌ 그 외 모든 쓰기(POST/PATCH/DELETE) — 토큰 거부(세션 사용자만)

> 참고: dry-run 자체가 만능 읽기 창구다(어떤 집계·목록도 spec으로 표현해 실값 수신). raw GET 개방은 에이전트가 기존 엔드포인트를 직접 호출하고 싶을 때를 위함.

**인증 구현 — 라우트 개별 개조 없이 (1순위)**
- `src/middleware.ts`(이미 존재)에 토큰 게이트:
  1. `Authorization: Bearer <WIDGET_API_TOKEN>` 상수시간 검증
  2. **쓰기 스코프 차단**: 토큰 요청이 GET/HEAD가 아니고 경로가 `/api/dashboard/widgets/spec`도 아니면 → 403
  3. 유효하면 **서비스 계정 세션으로 브리지** — `next-auth/jwt`로 서비스 유저 JWT를 만들어 요청 쿠키에 주입 → 기존 핸들러의 `getServerSession`이 그대로 인식 → 라우트 개조 불필요
- **폴백(2순위)**: edge 런타임에서 JWT 주입이 곤란하면, 공용 `getApiUser(req)`(세션 OR 토큰) 헬퍼를 만들어 읽기 라우트가 `getServerSession` 대신 사용. 구현 계획 착수 시 1순위 실현성을 먼저 스파이크로 검증한다.
- **서비스 계정**: `integration@rtbio.com`(role=ADMIN) 유저 1개 시드. 감사로그 주체로 기록.
- **`forUser`**: `POST /widgets/spec` body에 대상 사용자(이메일) → 그 사람 대시보드에 위젯 저장. 미지정 시 서비스 계정 대시보드.

**보안 통제**
- 토큰 **env 전용**(`WIDGET_API_TOKEN`), 하드코딩 금지, 로테이션 가능
- 모든 토큰 호출 **감사로그**
- 권장: Flowise 호스트 **IP 허용목록** + 레이트리밋
- ⚠️ 토큰 유출 = 전 ERP 데이터 읽기 → 비밀로 취급. 절대 커밋 금지.

**문서** `docs/02-design/dashboard-widget-api.md`
- 인증(Bearer) + 읽기 GET 카탈로그 + `widgets/spec` POST 계약 + `forUser`
- WidgetSpec 전체 스키마 + 연산자/집계/템플릿변수 레퍼런스
- 엔드포인트별 요청/응답 예시 + 에러 포맷(validationErrors 힌트 → 자가교정)
- few-shot 예시 spec 5개
- **복붙용 Flowise 에이전트 시스템 프롬프트** + GET/POST 노드 설정 예시

## 레거시 MOCK 전면 교체

- 제거: `PRESETS`(가짜), `MOCK` getter, `PREVIEW_DATA`, `TABLE_COLUMNS`, 편집모달의 옛 커스텀 빌더, `addEmptyWidget`
- `loadDefaultLayout` → prefab spec 4종(매출·미수금·진행주문·활성거래처)로 교체
- DB의 옛 mock-preset 위젯: prefab spec 매핑 가능 건 변환 렌더, **데이터 없던 것(notifications/procurement/udi)은 로드 시 드롭** → "데이터 안 나옴" 원천 제거. (출시 전이라 보존할 실데이터 없음)

## 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `src/middleware.ts` | 토큰 게이트(검증 + 쓰기 스코프 차단 + 서비스 세션 브리지) |
| `src/lib/widget-spec/api-auth.ts` | 신규 — 토큰 검증/서비스 principal 헬퍼 |
| `src/app/api/dashboard/widgets/spec/route.ts` | `forUser` 타겟팅 |
| `prisma/seed.ts` | `integration@rtbio.com` 서비스 계정 시드 |
| `public/portals/js/widget-builder.js` | 신규 — 갤러리 + 빌더 + dryRun 미리보기 |
| `public/portals/js/widget-dashboard.js` | MOCK 계열 제거, 갤러리/빌더 연결, 레거시 호환 로드, spec 렌더러 export |
| `public/portals/widget-dashboard.html` | 피커 모달 → 갤러리+빌더 마크업 |
| `docs/02-design/dashboard-widget-api.md` | 신규 — Flowise 연동 가이드 |
| `.env.example` | `WIDGET_API_TOKEN` 추가 |

## 검증

- **단위테스트**: 토큰 검증(유효/무효/누락), 쓰기 스코프 차단(토큰으로 비-위젯 POST → 403), `forUser` 해석. 기존 362 vitest + `tsc --noEmit` 그대로 통과.
- **브라우저 스모크**: 갤러리에서 추가 → 실데이터 표시 / 빌더에서 소스·집계·필터 → **실데이터 미리보기** → 저장 → 새로고침 유지 / 레거시 깨진 위젯 사라짐 확인.
- **토큰 E2E**: `curl -H "Authorization: Bearer …"` 로 (a) `GET /api/clients` 200, (b) `POST /widgets/spec` 201, (c) `POST /api/orders`(비-위젯 쓰기) → 403, (d) 토큰 없이 → 401.

## 범위 밖 (이번 작업 아님)

- **C의 자연어→spec 변환 두뇌** — 사용자가 Flowise에서 에이전트로 직접 제작. 본 작업은 그가 붙일 수 있는 **토큰 인증 + API + 문서**까지.
- **계산형 위젯 한계** — `low_stock`(classifyStock 후처리), 판매계약(SalesContract 비-whitelist 소스)은 현행 근사 유지. whitelist/후처리 확장은 별도 과제.
- **세금계산서/이메일 발송**(ACCT-1/2) — 무관.

## 리스크

- **middleware JWT 주입**(C 1순위)이 edge 런타임에서 까다로울 수 있음 → 착수 시 스파이크 검증, 안 되면 `getApiUser` 폴백.
- **읽기 전면개방**의 보안 무게 → env 토큰·감사·IP 허용목록으로 완화. 토큰은 절대 커밋 금지.
