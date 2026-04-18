# Harness Engineering Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RTBIO ERP 개발을 위한 하네스 엔지니어링 인프라를 구축한다 — 플러그인 기반 서브에이전트 풀 + 오케스트레이션 명령어(`/team`, `/autopilot`, `/ralph`) + 프로젝트 도메인 지식(`CLAUDE.md`) + RTBIO 특화 커스텀 에이전트 3개(`schema-designer`, `pricing-specialist`, `inventory-specialist`)를 결합한다.

**전제**: 2026-04-15 클라우드 결정 회의 종료 후 착수.
**예상 소요**: 30~60분

---

## Task 0: 사전 체크 (5분)

**목표**: 플러그인 설치 전제조건 확인 + 기존 파일 상태 점검.

**스텝**:
- [ ] Claude Code 앱 최신 버전 확인 (설정 → 정보) — 플러그인 마켓플레이스 지원 버전
- [ ] CLAUDE.md 존재 확인: `C:\Users\user\Desktop\Project\RTBIO\CLAUDE.md`
  - 없으면 중단. `docs/01-plan/harness-engineering-plan.md` §2.2 참조해서 먼저 작성
- [ ] GitHub 접근 가능 (플러그인 저장소 fetch 필요)
- [ ] 기존 `.claude/agents/` 디렉토리 존재 여부 확인
  - 있으면 `.claude/agents.backup/`로 이동 (플러그인와 충돌 방지)

**완료 조건**:
- 모든 체크박스 ✅
- 블로커 없음 → Task 1 진행

---

## Task 1: CLAUDE.md 검증 (5분)

**목표**: 도메인 지식이 제대로 문서화됐는지 확인. 플러그인 에이전트가 CLAUDE.md만 보고 작업해도 RTBIO 규칙을 어기지 않도록.

**스텝**:
- [ ] CLAUDE.md Read
- [ ] 필수 포함 항목 체크:
  - [ ] 멀티테넌시 (스키마 분리형, public + tenant_{id})
  - [ ] 가격 스냅샷 (fixedPrices > discounts[category] > basePrice)
  - [ ] 재고 이중관리 (physicalStock / availableStock)
  - [ ] 반품 처리 (InventoryAdjustment + reason='반품')
  - [ ] 기술 스택 (Next.js 14, Prisma, PostgreSQL 16, Tailwind, Zustand, Zod)
  - [ ] 포털 4개 구조 (exec/admin/qc/client)
  - [ ] 감사 컬럼 규칙 (createdAt/updatedAt/createdBy)
- [ ] 누락 있으면 Edit으로 보완
- [ ] 60줄 내외 유지 확인 (토큰 오버헤드 방지)

**완료 조건**: 모든 체크박스 ✅ + 길이 적정.

---

## Task 2: 플러그인 설치 (10분)

**목표**: `oh-my-claudecode` 플러그인 설치 + 초기 셋업.

**⛔ 주의**: `/plugin` 명령은 Claude Code 앱에서 직접 실행. 별도 터미널 아님.

**스텝**:
- [ ] **Step 1**: 마켓플레이스 추가
  ```
  /plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
  ```
  - 성공 응답 확인
- [ ] **Step 2**: 플러그인 설치
  ```
  /plugin install oh-my-claudecode
  ```
  - 의존성 설치 대기 (2~3분)
  - 오류 시 네트워크/권한 점검
- [ ] **Step 3**: 초기 셋업
  ```
  /setup
  ```
  - 프로젝트 루트가 `C:\Users\user\Desktop\Project\RTBIO`로 감지되는지 확인
  - `.omc/` 디렉토리 생성 확인
- [ ] **Step 4** (필요 시): Claude Code 재시작
  - 플러그인이 즉시 활성화 안 되면 재시작
  - 재시작 후 `/team` 명령어 자동완성 뜨는지 확인
- [ ] **Step 5**: `.gitignore` 업데이트
  - `.omc/sessions/`, `.omc/state/`, `.omc/artifacts/` 무시 추가

**완료 조건**:
- `/team`, `/autopilot`, `/ralph`, `/ask`, `/learner`, `/skill` 명령어 인식됨
- `.omc/` 디렉토리 존재
- 오류 로그 없음

**폴백**:
- `/plugin install` 실패 시 → npm 경로 시도: `npm i -g oh-my-claude-sisyphus@latest` → `omc setup` (Windows에서 `omc team N:codex` 등 tmux 의존 기능은 미지원, in-session 기능은 정상)
- 그래도 실패 시 → `.claude/agents/`에 수동으로 builder/reviewer 에이전트 작성해서 폴백

---

## Task 3: 동작 검증 (10분)

**목표**: 플러그인가 CLAUDE.md를 읽고 RTBIO 도메인을 이해하는지 확인.

**스텝**:
- [ ] **Step 1**: `/ask` 간단 테스트
  ```
  /ask claude "이 프로젝트의 가격 계산 우선순위가 뭐야?"
  ```
  - 기대 응답: "fixedPrices > discounts[category] > basePrice" 언급
  - 실패 시 → CLAUDE.md 자동 로드 안 됨 → Task 1 재검증
- [ ] **Step 2**: `/autopilot` 가벼운 작업
  ```
  /autopilot "sandbox/schema-test.prisma 파일에 Product 모델 초안만 작성.
  - 멀티테넌시 고려
  - 감사 컬럼 포함
  - 가격 스냅샷 관련 컬럼 포함"
  ```
  - 기대 산출물: `createdAt`/`updatedAt`/`createdBy`, 스냅샷 컬럼, 테넌트 스코프 고려 스키마
  - 산출물 확인 후 파일 삭제
- [ ] **Step 3**: `/learner` 시험 실행
  ```
  /learner
  ```
  - 이번 세션에서 스킬 추출되는지 확인
  - `.omc/skills/`에 항목 생기는지 확인
- [ ] **Step 4**: sandbox/schema-test.prisma 삭제 (테스트 파일 정리)

**완료 조건**:
- `/ask`가 도메인 규칙 정확히 답함
- `/autopilot` 산출물이 CLAUDE.md 규칙 준수
- `/learner` 정상 작동

**폴백**:
- Step 1 실패 → CLAUDE.md 경로/내용 문제. Task 1로 복귀.
- Step 2 실패 → 프롬프트에 CLAUDE.md 경로 명시해서 재시도.
- Step 3 실패 → 플러그인 버전 확인, 이슈 등록 검토.

---

## Task 4: 커스텀 도메인 에이전트 추가 (15분)

**목표**: RTBIO 고유 규칙을 전담할 에이전트 3개 작성. 플러그인 범용 에이전트와 **중복 금지**.

**⚠️ 규칙**: 본 Task에서 정의된 3개 외에 추가하지 말 것. 플러그인 32개 에이전트에 대부분 역할이 있음.

**스텝**:
- [ ] **Step 1**: `.claude/agents/` 디렉토리 생성 (없으면)
- [ ] **Step 2**: `schema-designer.md` 작성 — `.claude/agents/schema-designer.md`
  ```markdown
  ---
  name: schema-designer
  description: Prisma 스키마 설계 전문. 멀티테넌시, 감사 컬럼, CASCADE 정책 검증.
  tools: Read, Write, Edit, Grep, Glob
  model: sonnet
  ---

  PostgreSQL/Prisma 스키마 설계 전문가.

  ## 도메인
  - 멀티테넌시: public + tenant_{id} (스키마 분리)
  - 감사: 모든 테이블에 createdAt/updatedAt/createdBy 필수
  - CASCADE: 주석으로 명시

  ## 원칙
  1. CLAUDE.md 참조 먼저
  2. 외래키 CASCADE 정책 주석 필수
  3. 인덱스 전략 주석으로 설명
  4. 변경 시 마이그레이션 영향 분석
  ```
- [ ] **Step 3**: `pricing-specialist.md` 작성 — `.claude/agents/pricing-specialist.md`
  ```markdown
  ---
  name: pricing-specialist
  description: 가격 계산 로직 전문. 스냅샷 저장, 할인 우선순위 검증.
  tools: Read, Write, Edit, Grep
  model: sonnet
  ---

  가격 계산 전문가.

  ## 규칙 (절대)
  - 우선순위: fixedPrices > discounts[category] > basePrice
  - 주문 시점 단가를 Order에 스냅샷 (unitPrice, basePriceAtOrder)
  - 제품 가격 변경이 기존 주문 단가에 영향 주면 안 됨

  ## 원칙
  1. 가격 계산 함수 작성 시 테스트 먼저
  2. 스냅샷 컬럼 누락 여부 반드시 체크
  3. 할인율 중복 적용 금지
  ```
- [ ] **Step 4**: `inventory-specialist.md` 작성 — `.claude/agents/inventory-specialist.md`
  ```markdown
  ---
  name: inventory-specialist
  description: 재고 로직 전문. 이중 관리, 반품/조정 처리 검증.
  tools: Read, Write, Edit, Grep
  model: sonnet
  ---

  재고 관리 전문가.

  ## 규칙 (절대)
  - physicalStock (실재고) / availableStock (가용재고) 이중 관리
  - 주문 → 예약(available 차감) → 출고(physical 차감)
  - 반품: 별도 테이블 없음. InventoryAdjustment에 reason='반품' + note
  - 모든 변동을 InventoryLog에 기록

  ## 원칙
  1. 상태 머신 위반 검출
  2. 동시성 고려 (락/트랜잭션)
  3. 이중관리 불일치 감지 쿼리 제공
  ```
- [ ] **Step 5**: `/agents` 명령어로 3개 모두 인식되는지 확인

**완료 조건**:
- 3개 파일 생성
- `/agents` 리스트에 3개 표시
- 4번째 추가 안 함

---

## Task 5: Phase 1 dry-run (15분)

**목표**: 실제 Phase 1 작업 전, 파이프라인이 제대로 도는지 실전 검증.

**스텝**:
- [ ] **Step 1**: `/team` 실전 테스트
  ```
  /team 3:executor "sandbox/order-model-test.prisma 파일에 Order 모델만 작성해줘.
  - Product와의 관계 포함
  - 가격 스냅샷 컬럼 (pricing-specialist 참조)
  - 재고 예약 관계 (inventory-specialist 참조)
  - 감사 컬럼 포함 (schema-designer 참조)
  파이프라인: plan → exec → verify"
  ```
- [ ] **Step 2**: 산출물 검증
  - [ ] pricing 규칙 적용됨 (unitPrice, basePriceAtOrder)
  - [ ] inventory 관계 명시됨
  - [ ] 감사 컬럼 포함
  - [ ] 테넌트 스코프 고려됨
- [ ] **Step 3**: `/learner` 실행
  ```
  /learner
  ```
  - 이번 작업에서 추출된 패턴 확인
  - `.omc/skills/`에 새 스킬 추가됐는지
- [ ] **Step 4**: 정리
  - sandbox/order-model-test.prisma 삭제
  - sandbox 디렉토리 비어있으면 제거

**완료 조건**:
- 파이프라인 3단계 완주 (plan/exec/verify)
- 커스텀 에이전트 3개가 제대로 호출됨
- 산출물이 도메인 규칙 100% 준수

---

## 완료 후 (Task 6)

**스텝**:
- [ ] `docs/04-report/harness-setup-complete.md` 작성
  - 소요 시간 기록
  - 이슈/학습사항 기록
  - 다음 Phase 추천 명령어 요약
- [ ] `docs/01-plan/README.md` 의 "결정 후 업데이트" 체크리스트에서 해당 항목 체크
- [ ] Phase 1 (스키마 설계) 본격 착수 준비

---

## 롤백 플랜

5 Task 중 어느 단계든 실패 시:

| 실패 지점 | 원인 분류 | 대응 |
|----------|----------|------|
| Task 2 | 플러그인 설치 불가 (네트워크/권한) | npm 경로 시도 → 안 되면 `.claude/agents/`에 수동 에이전트 직접 작성 |
| Task 3 | CLAUDE.md 미반영 | CLAUDE.md를 `.claude/CLAUDE.md`로도 복사해서 재시도 |
| Task 5 | 파이프라인 오작동 | ① 커스텀 에이전트 문제 → Task 4 재작성 ② 플러그인 자체 문제 → `/plugin uninstall` 후 수동 에이전트 방식 ③ 프롬프트 문제 → 프롬프트 개선 |

---

## 관련 문서

- `../../01-plan/harness-engineering-plan.md` — 하네스 전략 문서
- `../../01-plan/harness-meeting.html` — 회의용 프레젠테이션
- `../../../CLAUDE.md` — 프로젝트 도메인 지식
- 플러그인 저장소: https://github.com/Yeachan-Heo/oh-my-claudecode
