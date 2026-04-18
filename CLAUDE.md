# RTBIO ERP — 프로젝트 메모리

## 프로젝트
의료용품 업체 대상 멀티테넌트 SaaS ERP. 알티바이오 1곳으로 시작 → 3단계 성장 (1~5 → 5~30 → 30+곳).

## 기술 스택 (확정)
- **앱**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Zustand
- **DB**: PostgreSQL 16 + Prisma (스키마 분리형 멀티테넌시)
- **인증**: NextAuth.js + bcrypt
- **유틸**: Zod (검증), @react-pdf/renderer (거래명세서)
- **이메일**: Nodemailer + Daum SMTP (`smtp.daum.net:465` SSL) — 알티바이오 기존 daum.net 계정 사용, 월 1,000건 초과 시 Azure Communication Services Email / SendGrid 전환
- **호스팅**: Container 기반 (Vercel 등 서버리스 배제)
- **클라우드**: **Azure (Korea Central)** — 2026-04-15 확정
  - 앱: Azure Container Apps · DB: PostgreSQL Flexible Server B2ms · 파일: Blob Storage · CDN/WAF: Azure Front Door · 모니터링: Application Insights
  - 크레딧: Microsoft for Startups $6,000 신청 예정 (법인 등록 후)

## 도메인 규칙 (어기면 안 됨)

### 멀티테넌시
- `public` 스키마: User, Tenant, AuditLog (공용)
- `tenant_{id}` 스키마: Product, Order, Inventory (격리)
- 라우팅: `{tenant}.rtbio-erp.com` 서브도메인
- 쿼리 시 테넌트 컨텍스트 누락 금지 → 미들웨어로 강제

### 가격 계산 (주문 시점 스냅샷)
- 우선순위: `fixedPrices` > `discounts[category]` > `basePrice`
- 주문 테이블에 `unitPrice`, `basePriceAtOrder` 등 **스냅샷 컬럼 필수**
- 주문 확정 후 제품 가격이 바뀌어도 기존 주문은 영향 없음

### 재고 (이중 관리)
- `physicalStock`: 창고 실제 수량
- `availableStock`: 예약분 제외한 판매 가능 수량
- 주문 → 예약(availableStock 차감) → 출고(physicalStock 차감)
- 모든 변동은 `InventoryLog`에 기록 (감사)

### 반품 처리
- 별도 테이블 없음. `InventoryAdjustment`에 `reason='반품'` + `note` 로 처리
- 입고/출고와 동일한 상태 머신 사용

## 아키텍처
- **포털 5개**: exec-portal(영업), admin-portal(경영지원), qc-portal(품질관리), client-portal(거래처), ceo-portal(대표)
- **공통 미들웨어**: 인증 → 테넌트 컨텍스트 → RBAC → 감사 로그
- **API 규약**: `/api/{domain}/...` + Zod 검증 + 표준 에러 포맷

## 코드 컨벤션
- TypeScript strict 모드, `any` 금지 (불가피 시 사유 주석)
- 감사 컬럼 누락 금지: `createdAt`, `updatedAt`, `createdBy`
- 외래키 CASCADE 정책 스키마 주석으로 명시
- TDD 원칙: 주요 비즈니스 로직은 테스트 먼저
- 커밋 메시지: 한국어 허용, 제목 50자 이내

## 디렉토리
```
docs/01-plan/       기획/스택 결정
docs/02-design/     API/DB/UI 설계
docs/03-analysis/   리뷰/분석
docs/04-report/     배포/운영 리포트
docs/superpowers/   플랜/스펙 (승인된 실행 문서)
prototype/          초기 HTML 목업
```

## 현재 단계
🟢 **프로토타입 + 과업내용서 완료, 데모·계약 대기** (2026-04-18 기준)

**완료된 산출물**
- 프로토타입 5개 포털 + Step A/B/C 보완 완료
- 팀별 배포본 5개 (`prototype/teams/*/`) — HTML + 사용설명서 + 로컬 리소스
- 과업내용서 2종: `docs/3. 과업내용서_RTBIO_{간소화,상세}_260417.docx`
  - 간소화: 업무영역 단위 (분쟁 예방형)
  - 상세: R01~R24 명세 (스코프 확정형)

**다음 일정**
1. 4/21 1차 데모 (QC·경영지원 집중)
2. 4/27 2차 데모 (영업·거래처·CEO)
3. ~4/30 **계약 체결** (과업내용서 1종 선택 발송)
4. 5/4~ **Phase 1 실개발 착수** (Prisma 스키마)

**단일 진실 원천**: `docs/superpowers/plans/2026-04-18-master-plan.md` (타임라인·기능범위·Phase 로드맵)

**원칙**: 계약 체결 전까지 백엔드/DB/배포 코드 금지. `prototype/*.html` + Mock JSON 으로만 검증.

## 하네스 운영 원칙
1. 서브에이전트 결과는 200단어 이내 요약으로 받기
2. 같은 파일 쓰는 작업은 순차, 독립 작업은 병렬
3. 메인은 조정/통합만, 구현은 서브에 위임
4. 도메인 결정(가격/재고/반품 규칙)은 본 문서 기준 — 재확인 금지
5. Phase 경계마다 `/learner` 실행 → `.omc/skills/` 축적
6. 커스텀 에이전트는 `schema-designer`, `pricing-specialist`, `inventory-specialist` 3개로 고정 (추가 금지)
