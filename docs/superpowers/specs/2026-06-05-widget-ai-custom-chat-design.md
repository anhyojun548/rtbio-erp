# 커스텀 위젯-AI 챗 UI 설계 (windyflo embed 대체)

**작성일** 2026-06-05 · **상태** 승인됨(사용자) → 구현

## 목표
windyflo 가 제공하는 flowise-embed 챗 위젯(`<flowise-fullchatbot>` + `Chatbot.initFull`)을 제거하고,
windyflo **prediction API 백엔드만** 연결한 **완전 커스텀 챗 UI**를 RTBIO 디자인(네이비/화이트)으로 새로 구현한다.
4개 포털(admin·ceo·exec·qc)의 "위젯 추가" 모달 내 `.picker-ai` 영역이 대상. B2 저장 플로우는 유지.

## 핵심 사실 (실측)
- prediction API: `POST https://www.windyflo.com/api/v1/prediction/e06fd2ea-da9f-4140-8502-5a171a664db8`
  body `{question, chatId, streaming:false}` → `{text, chatId, ...}`. 멀티턴은 동일 `chatId` 로 유지.
- **CORS**: 포털 출처(`http://localhost:3000`)에서 직접 POST → **200** (flowise embed 용 CORS 허용, 인증 불필요).
  → 서버 프록시 불필요, 포털에서 직접 fetch.
- 저장: AI 가 ```json WidgetSpec 출력 → 추출 → `POST /api/dashboard/widgets/spec`(로그인 세션) → 본인 대시보드 저장.

## 아키텍처
- 새 모듈 **`public/portals/js/widget-ai-chat.js`** 하나가 챗+저장 전부 담당.
  `<flowise-fullchatbot>`·`Chatbot.initFull`·`widget-ai-save.js` 를 **모두 대체**.
- 상태: `chatId`(세션마다 발급, "새 대화"로 리셋) · `currentSpec` · `busy`.
- 흐름: 입력 → user 말풍선 + 타이핑 → prediction fetch → AI 응답 렌더(```json 은 미리보기 카드로 변환) →
  spec 있으면 dry-run 으로 미리보기값 + "저장" 버튼.

## 비주얼 (RTBIO 네이비 #1B3A5C / 그린 #1B7F4B / 그레이)
- `.wac-head`: "AI 위젯 빌더" + "↺ 새 대화"
- `.wac-msgs`(스크롤 ~440px): AI=좌측 연회색 카드(◆ 배지), 사용자=우측 네이비 말풍선, 대기=타이핑 점 3개
- 첫 진입: 환영 문구 + 추천 칩 3개(매출 막대그래프 / 재고부족 표 / 미수금 라인차트)
- spec 완성: **위젯 미리보기 카드**(제목 · 차트유형 배지 · 데이터소스 · dry-run Top3 값) + "✅ 대시보드에 저장"
- `.wac-input`: 자동늘어나는 textarea + 네이비 전송 (Enter 전송 / Shift+Enter 줄바꿈)
- CSS 는 모듈이 `<style id="wac-styles">` 1회 주입, `.wac` 스코프.

## 동작 세부
- 비-스트리밍 + 타이핑 인디케이터(멀티에이전트 플로우엔 이게 안정적).
- AI 텍스트 렌더: HTML escape → `**bold**`·`` `code` ``·`### h` 경량 변환 → 줄바꿈 `<br>`. ```json 펜스는 제거하고 카드로.
- spec 추출: `extractSpec(text)` — ```json 블록 파싱, `{spec:{...}}`/`{...}` 모두 허용, title+kind+data.source 검증.
- dry-run: `{spec, dryRunOnly:true}` → series Top3 / value 표시(저장 전 확인).
- save: `{spec}` → 201 시 `location.reload()`.

## 범위 / 변경 파일
- NEW `public/portals/js/widget-ai-chat.js`
- EDIT `public/portals/{admin,ceo,exec,qc}-portal.html`:
  - `.picker-ai` 내부를 `<div id="wac"></div>` 로 교체(`<flowise-fullchatbot>` 제거)
  - flowise `<style>`·`initFull` `<script type=module>` 제거, `widget-ai-save.js` → `widget-ai-chat.js`
- `widget-ai-save.js` 참조 제거(로직 흡수). 파일은 보존(혹시 모를 롤백) 또는 삭제 — 구현 시 결정.

## 비범위
- 스트리밍(SSE) — 추후.
- `prototype/teams/*` 배포본 동기화 — 별도(요청 시).
- windyflo 노드/프롬프트 변경 없음.

## 검증
- 크롬 라이브: 4포털 중 1곳에서 "위젯 추가" → 커스텀 챗 노출 → "이번달 거래처별 매출 막대그래프" 멀티턴 →
  미리보기 카드 + 저장 → 대시보드 반영. tsc/회귀(서버 무변경이라 영향 없음) 확인.
