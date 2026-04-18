# RTBIO ERP — 하네스 엔지니어링 적용 계획

**작성일**: 2026-04-15 (최종 갱신: 2026-04-18)
**목적**: 서브에이전트 활용 개발 파이프라인 구축
**전제**: 클라우드 스택 확정 완료(Azure Korea Central), 계약 체결 후 Phase 1 착수
**현재 상태**: 🟢 하네스 원칙 확정, 커스텀 에이전트 3종 준비 완료 · 계약 체결 시점에 Day 0 실행

---

## 1. 아키텍처

### 1.1 3계층 구조
```
[Claude Code 앱]  ← 사용자 입력
    ↓
[CLAUDE.md]  ← 프로젝트 도메인 지식 (자동 로드)
    ↓
[범용 에이전트 풀]  ← 32개 역할 기반
    ↓
[커스텀 도메인 에이전트]  ← RTBIO 특화 3개
    ↓
[도구 실행 → 결과 요약 반환]
```

### 1.2 역할 분담
| 구성요소 | 책임 | 위치 |
|---------|------|------|
| **CLAUDE.md** | 도메인 규칙 (가격 스냅샷, 재고 이중관리, 반품 처리) | 프로젝트 루트 |
| **범용 에이전트 32개** | 일반 역할 (builder, reviewer, tester, researcher) | 플러그인 |
| **커스텀 에이전트 3개** | RTBIO 특화 (DB 스키마, 가격, 재고) | `.claude/agents/` |
| **오케스트레이션 명령어** | 팀 파이프라인 (`/team`, `/autopilot`, `/ralph`) | 플러그인 |

---

## 2. 핵심 명령어

### 2.1 Phase별 주 사용 명령어 (2026-04-18 기준 — 마스터 플랜 동기화)

| Phase | 기간 | 작업 | 주 명령어 · 에이전트 |
|-------|------|------|------------------|
| **P1 스키마** | W1-2 | Prisma 스키마, 멀티테넌시, 마이그레이션 | `/autopilot` + `schema-designer` |
| **P2 인증** | W3 | NextAuth, RBAC, 미들웨어, 감사 로그 | `/team 3:executor` |
| **P3 마스터** | W4-5 | 제품/거래처/재고 CRUD, 할인율 | `/team 4:executor` + `inventory-specialist` |
| **P4 주문** | W6-7 | 발주→확정→출고 칸반, 가격 스냅샷 | `/team 4:executor` + `pricing-specialist` |
| **P5 경영지원** | W8-9 | 명세서/원장/수금/보고서 | `/ultrawork` (독립 화면 병렬) |
| **P6 영업** | W10 | 담당자 매출, 학회 방명록 | `/team 3:executor` |
| **P7 통합·알림** | W11 | 재고알람, 이메일큐, CEO 대시보드 | `/autopilot` |
| **P8 QA** | W12-13 | 통합테스트, PDF, 모바일, 성능 | `/ralph` (verify/fix 루프) |
| **P9 배포** | W14 | Azure Container Apps, DB 프로비저닝 | 수동 |

**Phase 경계마다**: `/learner` 실행 → `.omc/skills/` 축적 → 다음 Phase에 자동 활용

### 2.2 명령어 레퍼런스

| 명령어 | 용도 | 예시 |
|--------|------|------|
| `/team N:executor "task"` | N단계 파이프라인 실행 | `/team 4:executor "주문 API 구현"` |
| `/autopilot "task"` | 단일 리드 자율 실행 | `/autopilot "prisma schema 초안"` |
| `/ralph "task"` | verify/fix 무한 루프 | `/ralph "테스트 전부 통과시키기"` |
| `/ultrawork "task"` | 버스트 병렬 | `/ultrawork "포털 4개 스켈레톤"` |
| `/ask [provider] "q"` | 모델별 조언 | `/ask claude "멀티스키마 베프"` |
| `/ccg "q"` | 3-model 합의 | `/ccg "이 아키텍처 리뷰"` |
| `/learner` | 세션 패턴 추출 → 스킬 저장 | Phase 끝낼 때마다 |
| `/skill [list|add|remove|edit]` | 축적된 스킬 관리 | |

---

## 3. 커스텀 도메인 에이전트

RTBIO 고유 규칙을 전담. 범용 에이전트가 모르는 도메인 결정만 담당. **3개로 제한**.

| 에이전트 | 역할 | 핵심 주입 지식 |
|---------|------|---------------|
| `schema-designer` | Prisma 스키마 | 스키마 분리형, 감사 컬럼, CASCADE 정책 |
| `pricing-specialist` | 가격 계산 | fixedPrices > discounts > basePrice, 스냅샷 컬럼 |
| `inventory-specialist` | 재고 로직 | physical/available 이중, 반품은 adjustment+reason |

> 나머지 역할(보안, 테스트, 리뷰 등)은 범용 에이전트 32개로 충분. **4번째 커스텀 추가 금지** — 중복 만들지 말 것.

---

## 4. 운영 규칙

### 4.1 CLAUDE.md는 단일 진실 원천
- 가격/재고/반품/테넌시 규칙은 CLAUDE.md에만 기록
- 에이전트에게 프롬프트로 반복 주입 금지
- 규칙 변경 시 CLAUDE.md만 수정 → 모든 에이전트에 자동 반영

### 4.2 명령어 선택 기준
- **독립적 병렬 작업** → `/ultrawork` 또는 `/team N`
- **단일 일관성 중요** → `/autopilot`
- **테스트 있는 작업** → `/ralph`
- **중대 결정/설계** → `/ccg` 또는 `/ask` 다중

### 4.3 Phase 종료 시 필수
- `/learner` 실행 → 재사용 패턴 자동 추출
- 실패/성공 경험이 `.omc/skills/`로 축적
- 다음 Phase에서 자동 활용

### 4.4 서브에이전트 호출 원칙
1. 결과는 200단어 이내 요약으로 받기
2. 같은 파일 쓰는 작업은 순차, 독립 작업은 병렬
3. 메인은 조정/통합만, 구현은 서브에 위임
4. 도메인 결정(가격/재고/반품)은 CLAUDE.md 기준 — 재확인 금지

---

## 5. 셋업 순서

상세 실행 Task는 `../superpowers/plans/2026-04-15-harness-engineering-setup.md` 참조.

```
Day 0 (계약 체결 직후, 약 60분)
 ├── Task 0: 사전 체크 (Azure 크레딧·DB 접속)
 ├── Task 1: CLAUDE.md 검증 (도메인 규칙 누락 여부)
 ├── Task 2: 플러그인 설치 + /setup
 ├── Task 3: 동작 검증 (/ask, /autopilot 샘플)
 ├── Task 4: 커스텀 도메인 에이전트 3개 활성화 확인
 │         (schema-designer, pricing-specialist, inventory-specialist)
 └── Task 5: Phase 1 dry-run

Day 1 (Phase 1 실전)
 └── /autopilot "prisma schema 초안 — CLAUDE.md 도메인 규칙 준수"
     → schema-designer 크로스체크 → 확정
```

---

## 6. 측정 지표

| 지표 | 측정 | 목표 (2주 후) |
|------|------|-------------|
| Phase 1 완료 시간 | 스키마 초안 ~ 확정까지 | 반나절 |
| 도메인 규칙 준수율 | 에이전트 산출물 중 CLAUDE.md 규칙 위반 건수 | 0건 |
| 패턴 축적 | `.omc/skills/` 에 쌓인 스킬 수 | 5개 이상 |
| 토큰 효율 | Phase당 사용량 | 수동 방식 대비 동등 이하 |
| 메인 에이전트 컨텍스트 | 서브에이전트 위임률 | 70% 이상 |

---

## 7. 주의사항

### ⚠️ 함정
- **CLAUDE.md 없이 셋업 금지** — 도메인 지식 없으면 범용 에이전트는 무용지물
- **커스텀 에이전트 남발 금지** — 3개 이상 추가하지 말 것
- **터미널 CLI 명령은 Windows 미지원** — `/명령어` (in-session)만 사용
- **CLAUDE.md 비대화** — 60줄 초과 시 토큰 오버헤드

### ✅ 성공 포인트
- CLAUDE.md 간결 유지 (60줄 이내)
- `/learner` 적극 활용 — 세션마다 학습 누적
- 다중 모델 교차 검증(`/ccg`) — 중대 결정 시만 (비용 있음)
- Phase 종료마다 회고 문서화

---

## 8. 관련 문서

- `../../CLAUDE.md` — 프로젝트 도메인 지식 (자동 로드)
- `../superpowers/plans/2026-04-18-master-plan.md` — **마스터 진행 계획 (SSOT)**
- `harness-meeting.html` — 회의용 프레젠테이션
- `../superpowers/plans/2026-04-15-harness-engineering-setup.md` — Day 0 셋업 Task
- `README.md` — 문서 인덱스
