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

### 배송지 (복수 등록 + 스냅샷)
- 하나의 거래처는 여러 배송지를 등록할 수 있다 (`ClientAddress` 1:N)
- 거래처당 `isDefault=true` 는 **최대 1개** — 앱 로직으로 유일성 보장 (DB 제약 아님)
- 발주 시 배송지 선택 → `Order.shipTo{Label,Recipient,Phone,PostalCode,Address,AddressDetail,Memo}` **스냅샷 저장**
  - 가격 스냅샷과 동일 철학 — 이후 ClientAddress 가 수정/삭제돼도 과거 주문은 불변
- `Order.shipToAddressId` 는 참조용 (FK SetNull) — 스냅샷이 진짜 원본
- 임시 주소(등록 없이 이번 주문만) 도 허용: `shipToAddressId=null` + 스냅샷만 채움

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
🟢 **Phase 3D-4 (유통기한 + 출고내역 + 월간 보고서) 완료** (2026-04-19)
- Phase 1 ✅ 스키마 · 마이그레이션 · 시드 완료 (복수 배송지 포함)
- Phase 2 ✅ NextAuth + bcrypt + JWT · 포털별 RBAC 매트릭스 · AuditLog util
- Phase 3A ✅ 거래처 CRUD + 복수 배송지 UI · 검증자 · 감사로그 연결 (서버 액션)
- Phase 3B ✅ 제품 CRUD + 사이즈별 재고 초기값 + 유통기한 · `ClientType.PHARMACY` 추가
- Phase 3C ✅ 입고(RECEIVE) + 조정(반품/폐기/실사조정/입고보정) · `SELECT FOR UPDATE` 동시성 · 이중재고 불변식 · InventoryLog/Adjustment 분리 · 재고 현황/이력 페이지
- Phase 3D-1 ✅ 카테고리 할인율(ClientDiscount) + 제품 고정가(ClientFixedPrice) 업서트/삭제 · 거래처 상세에 두 패널 · pricing.ts 우선순위 스모크 검증
- Phase 3D-2a ✅ 주문 DRAFT CRUD + 라인 CRUD + 배송지 스냅샷 · pricing.ts 기반 라인별 단가 미리보기 · `/admin/orders` 목록·신규·상세 UI · 임시 orderNumber(`DRAFT-xxx`) · 25건 Vitest + smoke-order DB 파이프라인 검증
- Phase 3D-2b-1 ✅ SUBMIT 전환 · 공식 orderNumber 채번(`ORD-YYYYMMDD-NNN`, Postgres advisory lock 기반) · 라인 가격 재스냅샷 · billingMonth 세팅(R12) · `StatusActions` UI · 5건 Vitest(누적 120) + smoke-order-submit 검증(seq 증가/재SUBMIT 가드)
- Phase 3D-2b-2 ✅ REJECT · HOLD · RESUME · CANCEL(재고 미영향 경로) · `rejectedAt/Reason` · `heldAt/Reason` 컬럼 추가 · `applyStatusTransition` 헬퍼 · UI 사유 모달 + 상세 페이지 뱃지 · 16건 Vitest(누적 136) + smoke-order-transition 4 시나리오 통과
- Phase 3D-2b-3 ✅ CONFIRM(SUBMITTED→CONFIRMED) · 라인별 `SELECT FOR UPDATE` + availableStock 차감(RESERVE) · `InventoryLog.RESERVE/RELEASE` 기록 · 재고 부족 시 전체 롤백 · CANCEL 확장(CONFIRMED→CANCELLED 시 RELEASE) · UI 확정/취소 경고 모달 · 3건 Vitest(누적 139) + smoke-order-confirm 3 시나리오(avail 차감·복원·롤백) 통과
- Phase 3D-2c ✅ **Shipment 수명주기** — `startShipment`(CONFIRMED→SHIPPING, 첫 KanbanColumn 진입), `moveShipmentStage`(단계 이동 + ShipmentStageLog 기록, terminal 도달 시 자동 완료), `holdShipment`/`resumeShipment` · **SHIP 트랜잭션** — terminal 진입 시 라인별 `SELECT FOR UPDATE` + `physicalStock -= qty` + `InventoryLog.SHIP` + Order.status=COMPLETED · **칸반 UI** `/admin/shipments` (컬럼별 카드, 이동/보류/재개 인라인 모달) · **ShipmentCard** 실시간 갱신 · 15건 Vitest(누적 154) + smoke-shipment 4 시나리오(전체 수명주기·재-start 가드·hold/resume·중복 start 가드) 통과
- Phase 3D-3a ✅ **거래명세서(Invoice)** — COMPLETED 주문 → DRAFT Invoice 스냅샷 생성(`createInvoiceFromOrder`) · 주문당 활성 invoice 1건 제약 · VAT 10% 계산(`calcVatTotal`, R18) · `issueInvoice`(DRAFT→ISSUED, `INV-YYYYMMDD-NNN` Postgres advisory lock 채번, orderNumber 와 키공간 분리) · `markInvoiceSent`(ISSUED→SENT + sentAt) · `cancelInvoice`(사유 기록) · **PDF 출력** `/admin/invoices/[id]/pdf` (@react-pdf/renderer, Noto Sans KR CDN, 공급자/공급받는자/라인 테이블/VAT 합계) · **UI** `/admin/invoices` 목록+필터 · 상세(DRAFT 편집폼·상태 액션·PDF 미리보기) · 주문 상세(COMPLETED) "거래명세서 발급" 버튼 · 21건 Vitest(누적 175) + smoke-invoice 5 시나리오(생성·발행·중복 가드·취소·재생성 seq 증분) 통과
- Phase 3D-3b ✅ **수금(Payment) + 거래처원장(ClosingLedger)** — **Payment 서버액션** `recordPayment` / `updatePayment` / `cancelPayment`(소프트: status=PENDING + `[취소]` note 태그로 BankTxn FK 보존) / `sumPaymentsByClient`(PENDING 제외 합계) · **BankTransaction 서버액션** `createBankTxn` / `updateBankTxn`(매칭 상태면 거부) / `deleteBankTxn`(매칭 상태면 거부) / `matchBankTxn`(Payment.bankTxnId 세팅 + matched=true) / `unmatchBankTxn`(Payment.bankTxnId=null + matched=false) · **ClosingLedger 서버액션** `recomputeLedger`(carryOver=전월 balance, monthlySales=ISSUED/SENT Invoice.totalAmount 합, received=PARTIAL/PAID Payment.amount 합, balance=carry+sales-received · 마감 후 거부 · `(clientId, closingMonth)` unique + upsert 로 동시성 직렬화) / `recomputeLedgerMonth`(활성 거래처 일괄 · per-client 트랜잭션 실패 격리) / `closeMonth` + `reopenMonth`(사유 필수) · **UI** `/admin/payments`(수금 등록 + 목록 필터 + BankTxn 2테이블(미매칭·매칭)) · `/admin/ledger`(월 선택기 · 활성 거래처 × 월 표 · 이달 일괄 재계산 · 거래처별 재계산/마감/재개 · 합계 푸터) · 39건 Vitest(누적 214) + smoke-payment 6 시나리오(BankTxn 생성·매칭·해제·소프트 취소·원장 집계·마감→가드→재개) 통과
- Phase 3D-4a ✅ **유통기한 로트(ExpiryLot)** (R19) — **validators/expiry** `createExpiryLotSchema` / `updateExpiryLotSchema` + `classifyExpiry(expiryDate, now)` → `{ stage: EXPIRED|URGENT|SOON|SAFE, daysLeft }`(경계: <0 · ≤30 · ≤90 · >90) · **actions/expiry** `listExpiryLots` / `listExpiringSoon(90d)` / `getLotsForSize` / `createExpiryLot`(사이즈 내 `lotNumber` 중복 앱-레벨 가드 · `remainingQty=quantity` 초기화) / `updateExpiryLot`(`remainingQty ≤ quantity` 가드) / `deleteExpiryLot` · **UI** `/admin/expiry` 대시보드(4단계 stat 카드 + 단계/검색/빈로트 필터 + 인라인 편집/삭제) · 제품 상세 `LotsPanel`(추가 폼 · 정렬된 로트 테이블 · 단계 뱃지) · 16건 Vitest(누적 230) + smoke-expiry 5 시나리오(초기화·중복 가드·잔여 감소 및 초과 가드·4단계 분류·삭제) 통과
- Phase 3D-4b ✅ **출고내역 전용 조회 + CSV** (R17) — **actions/shipment** `listShipmentHistory({clientId, from, to, q, limit})`(completedAt != null 기본 · `order.client.id/name/code` + `orderNumber` 대소문자 무시 부분일치 · `from/to` 합성 필터 · order.items 집계 포함) · **UI** `/admin/shipments/history`(건수/총수량/총금액 3장 stat 카드 + 필터 바(거래처 select · from/to date · 검색 input) + 완료일 desc 테이블 + 주문 상세 딥링크 + 사이드바 추가) · Sidebar 활성 규칙 개선(longest-prefix) — `/admin/shipments` 와 `/admin/shipments/history` 동시 활성 해결 · **CSV route** `/admin/shipments/history/csv`(UTF-8 BOM + CRLF · 13컬럼(완료일시/주문번호/주문일/거래처코드/거래처명/제품코드/제품명/사이즈/수량/라인합계/수령인/배송지/정산월) · RFC4180 쿼팅/더블쿼팅) · smoke-shipment-history 5 시나리오(기본조회 desc 정렬 · clientId 필터 · 기간 분할 · q prefix(orderNumber)/clientCode 부분일치 · CSV BOM+쿼팅) 통과
- Phase 3D-4c ✅ **월간 보고서** (R16) — **actions/report** `computeMonthlyReport(closingMonth)` / `getMonthlyReport(closingMonth)` / `getMonthlyReportWithPrev(closingMonth)` · `monthToRange` 기반 [월초, 다음달초) 범위로 `Invoice.issueDate` / `Payment.paidAt` / `Shipment.completedAt` 동시 집계 · **매출 total** = ISSUED+SENT(DRAFT·CANCELLED 제외, byStatus 는 전체 분포) · **수금 total** = PARTIAL+PAID(PENDING·OVERDUE 제외, ClosingLedger 정의와 일치) · **Shipment total** = 완료건수 + 라인 qty/amount 합 · **Top 10 거래처** = ISSUED/SENT 매출 desc · **원장 요약** = `listLedgers(closingMonth)` 의 `carry/sales/received/balance` 합 + 마감건수 · **UI** `/admin/reports/monthly?month=YYYY-MM`(월 input + 전/다음달 버튼 · 매출/수금/출고/미수금 4장 stat 카드에 전월 대비 ▲▼ 델타 + 퍼센트 · Invoice/Payment 상태별 분포 테이블 · Top 10 거래처 테이블 + 비중 · 원장 요약 푸터(carry+sales-received=balance) + 원장/거래명세서 딥링크) · Sidebar "월간 보고서" 추가 · smoke-monthly-report 2 시나리오(빈 월 0집계 · 혼합 fixture 정확 집계 — invoice 2건 7700 / payment 2건 5200 / ship 2건 qty=7·amt=7000 / Top [B=5500, A=2200] / ledger carry=1500+sales=7700-received=5200=balance=4000) 통과

**프로토타입·과업내용서는 계약 기준 유지** (계약 체결됨, 실개발 진행).

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
