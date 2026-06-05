# 위젯 AI 챗 — 로그인 사용자 자동 주입 설계

**작성일**: 2026-06-05
**상태**: 설계 승인됨 (사용자 "ㄱㄱ")
**관련**: AI 위젯 챗(windyflo) · `docs/02-design/dashboard-widget-api.md`

## 목표 (Goal)

위젯 AI 챗(windyflo)에서 만든 위젯을 **현재 로그인한 포털 사용자 본인의 대시보드에 자동 저장**한다. 사용자가 채팅에서 이메일(`forUser`)을 수동으로 입력하지 않는다.

## 배경 / 현재 문제

- windyflo 에이전트는 **공용 서비스 토큰**(`WIDGET_API_TOKEN` → `SERVICE_PRINCIPAL`(`svc-integration`, ADMIN))으로 우리 서버에 접속한다. 따라서 우리 서버는 "지금 어느 포털 사용자가 채팅 중인지" 알 수 없다.
- 그 결과 `save_dashboard_widget_spec` 툴은 `forUser`(대상 이메일)를 받아 `resolveTargetUserId(서비스유저, forUser)` 로 대상 대시보드를 정한다.
- 현재 클래리파이어 에이전트가 채팅에서 **"저장 대상 이메일을 알려주세요"** 를 묻는다 → UX 나쁨. (2026-06-05 포털 E2E 에서 확인됨.)

## 결정 사항

- **저장 대상 = 항상 로그인한 본인** (사용자 확정). 타인 대시보드 지정 기능은 범위 밖(추후 C안).
- **접근법 A 채택**: 포털이 로그인 이메일을 windyflo 변수로 주입 → save 툴이 **헤더**로 우리 서버에 전달 → 서버가 헤더를 권위 있는 `forUser` 로 사용. LLM 은 `forUser` 를 전혀 다루지 않는다(결정적·안정적).

기각된 대안:
- **B (Flow State + LLM 본문)**: LLM 이 매번 이메일을 본문에 정확히 echo 해야 함 → 불안정(빌더 spec 400 전례). 서버 무수정이지만 신뢰성 낮음.
- **C (서명 토큰 하드닝)**: 클라이언트 이메일 위조 방지용 서명 토큰. 내부 staff 도구엔 과함. **외부 공개 시점에 재검토**.

## 데이터 흐름

```
포털(로그인) ──initFull(chatflowConfig.vars.forUser = 내이메일)──▶ windyflo 챗
   "막대그래프 만들어줘" ──(이메일 안 물음)──▶ 빌더가 WidgetSpec 만 생성
   save 툴 ──헤더 X-RTBIO-ForUser: {{$vars.forUser}}──▶ POST /api/dashboard/widgets/spec
                                  └ 서버: 헤더 이메일 → 그 사용자 대시보드에 저장 ✅
```

## 변경 지점

### ① 포털 임베드 (우리 코드 — 4개 포털)

대상: `public/portals/admin-portal.html`, `ceo-portal.html`, `exec-portal.html`, `qc-portal.html`
(각 파일의 `Chatbot.initFull({ chatflowid, apiHost, theme })` — qc 기준 ~L4937)

```js
Chatbot.initFull({
  chatflowid: "e06fd2ea-da9f-4140-8502-5a171a664db8",
  apiHost: "https://www.windyflo.com",
  theme: { /* 기존 유지 */ },
  chatflowConfig: { vars: { forUser: <로그인이메일> } },   // ← 추가
});
```

- `<로그인이메일>` = `window.CURRENT_USER.email` (`/api/me` 가 반환하는 `email`).
- **핵심 시퀀싱**: `CURRENT_USER` 는 DOMContentLoaded 데이터 로더가 비동기로 채운다. `initFull` 이 그 전에 실행되면 `forUser` 가 `undefined` 가 된다.
  - → `initFull` 호출을 **`CURRENT_USER` 로드 완료 이후로 보장**한다(로더 완료 콜백/await 후 init, 또는 init 직전 `CURRENT_USER` 존재 가드).
- 이메일이 없으면(`CURRENT_USER` 미로딩/비정상) `vars.forUser` 를 보내지 않는다 → 서버가 명확히 거부(아래 ③). 조용히 엉뚱한 대상에 저장하지 않는다.

### ② windyflo 챗플로우 (windyflo 측 설정)

- **save 툴** (`save_dashboard_widget_spec`, requestsPost) 헤더에 추가:
  ```json
  {"Authorization":"Bearer rtbio-flowise-dev-2026","Content-Type":"application/json","X-RTBIO-ForUser":"{{$vars.forUser}}"}
  ```
- **클래리파이어 에이전트 프롬프트**: "저장 대상 이메일(forUser) 수집/질문" 규칙 **제거**. forUser 는 더 이상 필수 결측 정보가 아님 → 위젯 요구만 충분하면 바로 `STATUS: READY_TO_BUILD`.
- **빌더 에이전트 프롬프트 / save 본문 스키마**: `forUser` 항목 **제거**(또는 무시). 빌더는 spec 만 만든다.
- **챗플로우 보안 설정**: "Override Config → vars" 허용 ON (꺼져 있으면 `overrideConfig.vars` 가 무시됨).

> 비고: 이 변경들은 windyflo UI 에서 수행. 토큰 하드코딩 때와 동일하게 메인 에이전트가 DOM 으로 시도하거나, 안 되면 정확한 위치를 사용자에게 안내한다. `X-RTBIO-ForUser` 값(`{{$vars.forUser}}`)은 비밀이 아니므로 메인 에이전트가 입력 가능.

### ③ 우리 서버 — save 라우트 (`src/app/api/dashboard/widgets/spec/route.ts`)

현재(L85~92): 본문 `forUser` → `resolveTargetUserId(user.id, forUser)`.

변경:
- 요청 헤더 `X-RTBIO-ForUser` 를 읽는다.
- **우선순위**: `X-RTBIO-ForUser` 헤더 > 본문 `forUser` > 세션 사용자(기존 기본).
- **치환 실패 가드**: 헤더 값이 비었거나 `{{` 를 포함하거나(=`$vars` 미치환) 이메일 형식이 아니면 → 헤더 무시.
- 서비스 토큰 요청(svc-integration)에서 헤더·본문 모두 유효한 forUser 가 없으면 → `400` + 메시지 "저장 대상 사용자를 알 수 없습니다 (X-RTBIO-ForUser 누락)". 조용한 오저장 금지.
- 실 세션 사용자(토큰 아님)의 직접 호출은 기존대로 본인 저장(헤더 불필요).

`forUser` 파싱 헬퍼(`./forUser`, `resolveTargetUserId`)는 그대로 사용; 헤더 우선 로직만 라우트에 추가(≈5줄).

## 에러 처리

| 상황 | 동작 |
|---|---|
| 이메일 미주입(포털) / `$vars` 치환 실패(`{{…}}`) | 서버 헤더 무시 → forUser 없음 → `400` 명확 메시지 |
| 존재하지 않는 이메일 | `resolveTargetUserId` 기존 에러 그대로 노출 |
| 정상 | 헤더 이메일 → 해당 사용자 `DashboardWidget` 저장 |

## 보안 노트

- `vars.forUser` 는 클라이언트(임베드)에서 주입되므로 사용자가 devtools 로 위조 가능. 그러나 **현재도** 서비스 토큰이 ADMIN 권한으로 본문 `forUser` 를 신뢰하므로 **신뢰 경계는 동일**(회귀 없음). 내부 staff 도구 수준에서 수용.
- 외부 공개 시 **C안(서명 토큰)** 으로 하드닝.

## 테스트

- **단위(Vitest)** — save 라우트 forUser 결정:
  - 헤더 > 본문 우선순위
  - 헤더 누락(서비스 토큰) → 400
  - 헤더 `{{$vars.forUser}}`(치환 실패) → 무시 → 400
  - 헤더 이메일 정상 → 해당 userId 해석
- **E2E(수동)**: qc 로그인 → 위젯 추가 → "이번 달 거래처별 매출 막대그래프 만들어줘" → **이메일 질문 없이** 빌더 진행 → dry-run → save → **qc 본인 대시보드에 위젯 등장** (DB `DashboardWidget` 확인).

## 범위 밖 (Out of Scope)

- DB/스키마 변경, 신규 엔드포인트 — 없음.
- 거래처(client) 포털 — 위젯 AI 없음, 제외.
- 저장 외 툴(catalog/schema/dry-run) — `forUser` 불필요, 무변경.
- 타인 대시보드 지정 / 서명 토큰(C) — 추후.
- 빌더가 만드는 spec 의 **품질 문제(현재 400)** 는 별개 과제(빌더 프롬프트가 `get_dashboard_widget_schema` 선호출 + 완전한 title/kind/data 생성). 본 설계와 분리.

## 구현 중 검증 항목

1. windyflo requestsPost **헤더에서 `{{$vars.forUser}}` 가 실제 치환**되는지 (토큰 하드코딩 시 헤더 정적값은 확인됨; `$vars` 동적 치환은 1회 확인 필요).
2. 챗플로우가 `overrideConfig.vars` 를 **수용**하는지(보안 설정).
3. 포털에서 `initFull` 시점에 `window.CURRENT_USER.email` 이 **채워져 있는지**(시퀀싱).
