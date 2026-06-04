# AI 챗 위젯 생성 입구 — 설계

**작성일**: 2026-06-04 · **상태**: 설계 확정(구현 대기) · **선행**: 위젯 spec 엔진·갤러리·빌더·Flowise 백엔드(토큰) 완료

## 배경 / 문제

대시보드 위젯을 쓰는 길은 3가지지만 난이도가 다르다:

| 방법 | 진입점 | 비개발자 |
|---|---|---|
| 템플릿 **고르기** | `➕ 위젯 추가` 갤러리 | ✅ 가능 |
| **직접 만들기** | `+ 직접 만들기` 빌더 | ⚠️ 어려움 — 데이터 소스·집계·분류·필터 연산자·`{{템플릿변수}}` 노출 |
| AI에게 **말하기** | (없음) | — |

빌더는 사실상 파워유저용이다. 경영지원팀 같은 비개발자가 "빈 화면에서 위젯을 조립"하기는 어렵다. 실제 ERP도 비개발자는 위젯을 **만들지 않고 고르거나 말로 시킨다.** 따라서 **"말로 요청 → AI가 위젯 생성"** 동선을 비개발자 메인 입구로 추가한다.

## 결정 (사용자 확정)

1. **방향**: AI 챗을 위젯 생성의 메인 입구로 추가.
2. **Flowise 준비도**: *만드는 중 / 아직* → UI·연결 규격을 먼저 만들고, 그 뒤 "엔진"은 갈아끼운다.
3. **초기 엔진 범위**: **UI + 연결 규격만.** Flowise 붙기 전까지는 "말 → 가장 비슷한 **템플릿 추천** + 미리보기 + 원클릭 추가"까지만. 실제 LLM 자동생성은 Flowise 연결 후.
4. **위치**: `➕ 위젯 추가` 모달(`#pickerOverlay`) **상단**에 AI 챗 섹션, 기존 갤러리는 그 아래.
5. **아키텍처**: **서버 라우트 심(seam)** — 브라우저는 항상 우리 라우트 1개만 호출, 엔진(로컬 매처 ↔ Flowise)은 환경변수로 교체. **UI 불변.** Flowise 키는 서버에만.

## 목표 / 비목표

**목표**: 비개발자가 `➕ 위젯 추가` → "이번 달 거래처별 매출" 같이 말하면, 가장 알맞은 템플릿을 미리보기와 함께 추천받아 한 번에 추가. Flowise 연결 시 같은 UI가 진짜 AI 생성으로 승격.

**비목표(YAGNI, 후속)**: 실제 LLM 호출·멀티턴 대화·대화로 위젯 수정·자유로운 임의 스펙 생성은 **Flowise 연결 후**. 지금은 단발 추천만.

---

## 1. UX 흐름

```
➕ 위젯 추가 → [모달 #pickerOverlay]
┌──────────────────────────────────────────────┐
│ 🤖 AI에게 말하기                               │
│ [ 원하는 위젯을 말해보세요…              ][▷] │
│ 예: "이번 달 거래처별 매출" · "재고 부족 품목" │
│ ⓘ 지금은 비슷한 템플릿을 추천해요.             │
│    AI 자동 생성은 곧 (Flowise 연결 예정)        │
│  ─ 추천 ─                                      │
│  ┌ 📊 Top 5 거래처 (이달 매출)  [미리보기][추가]│
│  ┌ 📈 월 매출현황               [미리보기][추가]│
├──────────────────────────────────────────────┤
│ 갤러리에서 선택                  [+ 직접 만들기]│
│ [기존 13종 템플릿 그리드…]                      │
└──────────────────────────────────────────────┘
```

- 입력 → `보내기`(Enter/버튼) → 추천 카드 렌더. 각 카드는 **실데이터 dry-run 미리보기** + `추가`.
- `추가`는 **기존 저장 경로 재사용**(`_saveSpec` → `addSpecWidgetToGrid`). 새 저장 로직 없음.
- 매칭 0건이면 "비슷한 게 없어요 — 갤러리에서 고르거나 직접 만들어 보세요" 폴백.
- 기존 갤러리·`+ 직접 만들기`는 그대로 아래 유지(파워유저 경로 보존).

## 2. 아키텍처 — 갈아끼우는 이음새

```
브라우저(NextAuth 세션) ── POST /api/dashboard/widgets/ai { message }
    │
    ├─ env FLOWISE_PREDICTION_URL 미설정(지금)
    │     → 로컬 매처(suggest.ts) → { ok, mode:"suggest", reply, suggestions:[…] }
    │
    └─ env FLOWISE_PREDICTION_URL 설정(나중)
          → 서버가 Flowise 예측 API 로 프록시(키는 서버 env)
          → 응답에서 spec 추출 → dry-run 검증 → { ok, mode:"spec", reply, spec }

브라우저: mode="suggest" → 추천 카드 N개 / mode="spec" → 단일 스펙 미리보기
          둘 다 기존 dry-run 미리보기 + 기존 추가 경로로 위젯 생성
```

- **세션 인증**: 인앱은 로그인 사용자다. 기존 위젯 토큰(`WIDGET_API_TOKEN`)은 **외부 Flowise→우리** 방향 전용이므로 **인앱 라우트엔 쓰지 않는다.** 라우트는 NextAuth 세션 + 위젯 생성 가능 롤(`requireCeoUser` 와 동일 계열: TENANT_OWNER/ADMIN 등)로 보호.
- **단일 전환점**: `FLOWISE_PREDICTION_URL` 유무로 엔진 분기. 빈값이면 로컬 매처. UI·계약은 동일.

### 라우트 계약

```
POST /api/dashboard/widgets/ai
req:  { message: string (1..500) }
res(200): {
  ok: true,
  mode: "suggest" | "spec",
  reply: string,                       // 사용자에게 보일 친절 문구
  suggestions?: Array<{                // mode="suggest"
    key: string, title: string, kind: string, source: string,
    score: number, spec: WidgetSpec    // 그대로 미리보기/추가 가능
  }>,
  spec?: WidgetSpec                     // mode="spec" (Flowise)
}
res(400): { ok:false, error }          // 빈/과길이 메시지
res(401/403): 세션/롤 가드
```

> **영속 경로 분리**: `/ai` 는 **추천/스펙 제안만** 한다. 실제 위젯 저장(`추가`)은 기존
> `POST /api/dashboard/widgets/spec` 를 그대로 사용한다(`_saveSpec` 내부). `/ai` 는 위젯을 만들지 않는다.

## 3. 컴포넌트 / 변경 파일

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/lib/widget-spec/suggest.ts` | **신규** — 순수함수 `suggestWidgets(message, limit=3) → Suggestion[]`. PREFAB_SPECS 를 메시지와 점수 매칭. Prisma/네트워크 의존 없음 → 단위테스트 격리 | 신규 |
| `src/app/api/dashboard/widgets/ai/route.ts` | **신규** — 세션·롤 가드 → env 분기(로컬 매처 / Flowise 프록시) → 표준 응답 | 신규 |
| `public/portals/js/widget-builder.js` | 피커 AI 섹션 로직: 보내기→라우트 fetch→추천카드 렌더(제목·미리보기·추가). 미리보기는 기존 dry-run, 추가는 기존 `_saveSpec`/`addSpecWidgetToGrid` 재사용 | 수정 |
| `public/portals/admin-portal.html` | `#pickerOverlay` 상단에 AI 챗 섹션 마크업 | 수정 |
| `public/portals/ceo-portal.html` | 동일 마크업(대시보드 보유 포털) | 수정 |
| `.env.example` | `FLOWISE_PREDICTION_URL`(빈값=로컬 매처) + 비밀키 주석 | 수정 |
| `docs/02-design/dashboard-widget-api.md` | "인앱 AI 입구 + Flowise 프록시" 동작 1절 추가 | 수정 |

> CSS: 기존 `picker-*` / `gallery-*` 토큰 재사용. 신규 클래스는 `picker-ai-*` 최소.

## 4. 매처(지금 엔진) — `suggest.ts`

순수함수. 입력 메시지를 소문자/토큰화 → 각 prefab 에 점수:

- **소스 키워드 맵**: 매출/판매→invoice · 미수금/외상→ledger · 수금/입금→payment · 주문/발주→order · 재고/부족/품절→productSize · 거래처/고객→client · 계약/만료→salesContract …
- **차원 키워드**: "거래처별/제품별"→groupBy 계열 prefab 가산 · "이번 달/주간/일/오늘"→기간 prefab 가산 · "top/상위/순위"→정렬 prefab 가산.
- **제목 부분일치** 가산. 동점은 prefab 기본 우선순위.
- top-N(기본 3) 반환. 최고 점수가 임계 미만이면 빈 배열 → UI 폴백.

PREFAB_SPECS(13종)가 후보 풀. 표시 품질 엔진 덕에 추천 결과도 자동으로 이름/한글 컬럼으로 렌더된다.

## 5. Flowise 계약(나중, 지금은 미구현)

- env `FLOWISE_PREDICTION_URL`(+ 필요 시 `FLOWISE_API_KEY`) 설정 시 라우트가 그 챗플로우 예측 API 로 `{ question: message }` 프록시.
- 기대 응답: Flowise 에이전트가 우리 data-catalog/widget-schema 규칙(이미 문서화)대로 만든 **WidgetSpec JSON**. 라우트가 받아 **dry-run 검증** 후 `mode:"spec"` 으로 반환(실패 시 친절 에러).
- 키/URL 은 서버 env 전용. 브라우저 노출 금지. (이번 범위에선 분기 골격 + 문서화까지, 실제 호출은 후속.)

## 6. 에러 / 상태

- 빈 입력/공백 → 전송 안 함(버튼 비활성).
- 과길이(>500) → 400 + 안내.
- 매칭 0건 → "비슷한 위젯이 없어요 — 갤러리/직접 만들기로" 폴백 메시지.
- 라우트 실패(네트워크/500) → 토스트 + 갤러리는 정상 노출(치명적 아님).
- 상시 배너: "AI 자동 생성은 곧 (Flowise 연결 예정) — 지금은 비슷한 템플릿을 추천해요."

## 7. 검증

- **단위테스트** `suggest.test.ts`: 대표 문장 매칭("이번 달 거래처별 매출"→top_clients 류, "재고 부족"→low_stock, "미수금"→total_ar), 동의어, 0건 폴백, 한도(limit) 준수.
- **라우트 테스트**: 세션/롤 가드(401/403), 빈/과길이(400), 정상 시 mode="suggest" 형태.
- **브라우저 E2E**: `➕ 위젯 추가` → AI 입력 "이번 달 매출" → 추천 카드 미리보기 → `추가` → 그리드 반영 + 영속(bulk sync 후 DB 확인).
- 기존 614 vitest 회귀 + tsc 클린.

## 8. 범위 / 경계

- 적용 포털: **admin·ceo**(대시보드 보유). exec/qc/client 는 위젯 대시보드 비대상.
- 인앱 라우트는 **세션** 인증(토큰 아님). 외부 Flowise→우리 토큰 경로는 그대로 유지.
- 실제 Flowise 호출·멀티턴·대화형 수정·임의 LLM 스펙 생성은 **후속**(env 설정 + 프록시 활성화 시).

## 9. 리스크

- **매칭 한계**: 13종으로 못 맞히는 요청 다수 → 명확한 폴백 + "곧 AI" 배너로 기대치 관리. Flowise 연결이 본 해결.
- **Flowise 응답 신뢰**: 잘못된 스펙 가능 → 라우트의 dry-run 검증으로 차단(후속 단계에서 강제).
- **중복 진입점 혼선**: 우하단 목업 챗봇은 이번 범위에서 손대지 않음(별개) — 추후 통합/정리 검토.
