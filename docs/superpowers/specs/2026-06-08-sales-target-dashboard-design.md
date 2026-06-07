# 영업 대시보드 확장 — 매출 목표 + 위젯 + 보고서 설계

**작성일:** 2026-06-08
**승인:** 사용자 확인 완료 (3단계 빌드 + EXEC 기본 레이아웃 시딩)
**대상:** 영업(exec) 포털 — 대시보드 위젯, 신규 「직원별 지표」 페이지, 매출 보고서

## 배경 / 현재 상태 (조사)
- "목표 대비 95.7%" 는 exec-portal.html 의 **하드코딩 mockup** (목표 데이터 모델 없음).
- 위젯 대시보드는 prefab+spec 하이브리드. 현재 **CEO/관리진 전용**(EXEC 미허용).
- 주간/일 매출, 7일 시계열(날짜별 금액/종류/수량), 대리점·병원 분리 집계 — **전부 없음**.
- 영업 사이드바에 "직원별 지표" 메뉴 **없음** → 신규 생성.

## 확정 결정 (명확화 답변)
- **목표 단위**: 담당자 × 월 × 대리점/병원 (총액 = 합)
- **목표 입력 위치**: 영업 포털 신규 「직원별 지표」 메뉴
- **매출 보고서(#4)**: 대시보드 위젯 + 별도 페이지 **둘 다**
- **신규 영업 계정**: 생성 시 사진의 위젯 구성을 **기본 대시보드로 자동 시딩**

## 데이터 모델 (신규)
```prisma
model SalesTarget {
  id         String     @id @default(cuid())
  salesRepId String     // public.User.id (앱-레벨 참조, 크로스스키마 FK 회피)
  month      String     // YYYY-MM
  clientType ClientType // AGENCY(대리점) | HOSPITAL(병원)
  amount     Decimal    @db.Decimal(15, 2)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  createdBy  String
  @@unique([salesRepId, month, clientType])
  @@index([month])
  @@schema("tenant_altibio")
}
```
- 한 담당자 한 달 목표 = AGENCY행 + HOSPITAL행. 총액 = 합.
- 실적(actual)은 Invoice(ISSUED+SENT) 매출을 거래처 type 으로 분리 집계.

## Phase 1 — 목표 도메인 + 「직원별 지표」 페이지 (토대)
- 스키마 `SalesTarget` + 마이그레이션
- `validators/sales-target.ts`: `upsertSalesTargetSchema`, `targetMonthSchema`, `achievementRate(actual,target)` 순수함수 + Vitest
- `actions/sales-target.ts`:
  - `listTargets(month)` — 담당자별 목표(대리점/병원/총)
  - `upsertTarget({salesRepId, month, clientType, amount})` — 감사
  - `computeRepMetrics(month)` — 활성 영업 담당자별 {목표(대리점/병원/총), 실매출(대리점/병원/총), 달성률}. `getClientIdsForRep`(exec.ts 규칙) + client.type 분리 + Invoice ISSUED/SENT
- `/api/exec/targets` GET(?month) · POST(upsert)
- exec 포털 신규 페이지 `page-rep-metrics` (「직원별 지표」): 월 선택 + 담당자별 표(대리점·병원 목표 **입력** + 실매출 + 달성률%) + 사이드바 메뉴
- RBAC: EXEC·ADMIN·TENANT_OWNER (EXEC 은 조회 + 목표 입력 권한 정책 확정 — 우선 전체 허용, 추후 팀관리자 제한 가능)

## Phase 2 — 매출 위젯 확장 + EXEC 접근 + 기본 레이아웃 시딩
- **EXEC 위젯 접근 허용** (requireCeoUser → EXEC 포함하도록 별도 게이트 또는 역할 확장)
- 신규 프리셋:
  - `kpi_weekly_sales` (이번 주 매출, #2)
  - `kpi_daily_sales` (오늘 매출, #3)
  - `kpi_sales_vs_target` (이번달 매출 vs 목표, 달성률%, #5/#6)
  - `kpi_sales_by_type` (대리점/병원 분리 매출, #6)
  - `chart_sales_7d` (최근 7일 추이 — 날짜별 금액+건수+수량, #6-b)
- #1 중복 정리: "월 매출 현황"/"이번 달 매출" → 하나로 + 기간(YYYY-MM-01~말일) 라벨 명시
- **EXEC 기본 레이아웃**: `EXEC_DEFAULT_LAYOUT_KEYS` = 사진 위젯 구성 (월매출·수금·미수금·담당거래처·오늘발주·총미수금·활성거래처·7일추이·거래처별비중)
- **계정 생성 시딩**: `createUser` 가 role=EXEC 일 때 `EXEC_DEFAULT_LAYOUT_KEYS` 로 DashboardWidget 시딩. 위젯 0개인 EXEC 최초 진입 시에도 폴백 시딩.

## Phase 3 — 매출 보고서 (월/주간/일, #4)
- 대시보드 요약 위젯 (월/주간/일 토글)
- 영업 포털 별도 「매출 보고서」 페이지: 기간(월/주간/일) 선택 + 담당자·대리점/병원 표 + 추이 그래프 + CSV. admin 월간보고서/매출보고서 인프라 재사용.

## 검증 (Phase 마다)
tsc 클린 · validators Vitest · smoke(실 DB) · 브라우저 E2E · 커밋.

## 비범위(YAGNI)
- 목표 승인 워크플로, 분기/연 목표, 제품별 목표, 목표 이력 버저닝.
