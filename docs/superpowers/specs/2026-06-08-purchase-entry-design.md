# 매입 수기 입력 + 매입장 실데이터 연결 — 설계

**작성일:** 2026-06-08
**승인:** Approach A (TransactionLedger 재사용) — 사용자 확인 완료
**범위:** 경영지원(admin) 포털 "매입관리(P12)" 수기 입력 영구 저장 + "매입매출장 > 매입장(P16)" 뷰 실데이터 연결

## 배경

- 매출장은 거래명세서(Invoice ISSUED/SENT) 기반으로 이미 서버 조회화 완료.
- 매입장 탭과 매입관리 폼은 하드코딩 mock 상태.
- 조사 결과: `TransactionLedger`(kind=SALE/PURCHASE) 모델에 매입 입력에 필요한
  모든 필드(거래일·공급처·품목·규격·수량·단가·공급가·VAT·합계·전표번호·비고)가 존재.
  매입장 뷰와 데이터 탐색기가 이 테이블을 읽음. 현재 PURCHASE 행은 30건·전부 ₩0.

## 결정: Approach A — TransactionLedger 재사용 (신규 테이블 없음)

수기 매입 입력을 `TransactionLedger(kind=PURCHASE, importSource='manual:purchase-entry')`
행으로 저장. 한 번의 입력 = 하나의 전표번호(`PUR-YYYYMMDD-NNN`)를 공유하는 N개 라인.

**왜 A인가**
- 사용자가 보는 기능(수기 매입 입력이 영구 저장되고 매입장/데이터탐색기에 즉시 표시)을 100% 제공.
- 마이그레이션 0, 단일 원장 → 매출장·데이터탐색기와 자동 일관.
- 데이터 현실(매입 거의 미기록)상 정식 procurement 워크플로(승인·공급처 마스터·PO)는 YAGNI.

## 구성요소

### 1) `src/lib/validators/purchase.ts`
- `TAX_TYPES = ["과세","면세","영세"]`
- `purchaseLineSchema`: productName(1~200), productCode?/spec?/unit?, qty(>0), unitPrice(≥0)
- `createPurchaseEntrySchema`: date(YYYY-MM-DD), supplier(1~200), supplierCode?, taxType(기본 과세), memo?, lines(1~100)
- `purchaseJournalQuerySchema`: from?/to?(YYYY-MM-DD), q?, limit?
- `calcPurchaseLine(qty, unitPrice, taxType, vatRate=0.1)` → `{ supply, vat, total }`
  - 과세만 VAT(=round(supply×rate)), 면세/영세는 0.

### 2) `src/lib/actions/purchase.ts`
- `createPurchaseEntry(input)` — 전표 `PUR-YYYYMMDD-NNN` 채번(당일 매입 전표 max+1, 트랜잭션 내),
  라인별 금액 계산, `TransactionLedger.createMany`, 감사 `PURCHASE_ENTRY_CREATE`. vat_rate 설정 반영(기본 0.1).
- `listPurchaseEntries({limit})` — PURCHASE 행을 전표번호로 그룹핑 → `{voucherNo,date,supplier,taxType,itemCount,totalSupply,totalVat,totalAmount,manual}`.
- `deletePurchaseEntry(voucherNo)` — `importSource='manual:purchase-entry'` 전표만 삭제(시드/임포트 보호), 감사 `PURCHASE_ENTRY_DELETE`.
- `getPurchaseJournal({from,to,q,limit})` — KST 기간 경계로 PURCHASE flat lines(매출장 getSalesJournal 대칭) `{lines,count,truncated}`.
- 일자 처리: 저장 txnDate = `YYYY-MM-DDT00:00:00+09:00`(KST 자정), 표시 = kstYmd.

### 3) `src/app/api/admin/purchases/route.ts`
- `POST` → createPurchaseEntry (400 + fieldErrors on 검증 실패)
- `GET ?mode=journal&from&to&q` → getPurchaseJournal / `?mode=history` (기본) → listPurchaseEntries
- `DELETE ?voucherNo=` → deletePurchaseEntry
- 세션 게이트(미인증 401), 액션 내부 requireRole(TENANT_OWNER/ADMIN; 조회는 EXEC/QC 포함은 액션 정책 따름)

### 4) `public/portals/admin-portal.html`
- P12: mock 안내 배너 제거. `renderPurchases()` 실데이터화 —
  공급처 `<select>` → `<input list=datalist>`(기존 공급처 자동완성), 그리드 행 수집,
  "확정 저장" → POST, 성공 시 토스트+이력 리로드+그리드 초기화. "임시저장" 제거(또는 안내).
  매입 이력 → GET history(전표 그룹), 상태 뱃지 '확정', 전표 삭제 버튼.
- P16: `renderJournal('purchase')` 하드코딩 6행 제거 → `/api/admin/purchases?mode=journal&from&to`
  날짜키 캐시(매출장 `_salesJournalCache` 패턴 동일), 클라이언트측 검색/페이지.

### 5) `scripts/smoke-purchase.ts`
시나리오: 입력 2라인 생성 → 전표 PUR 채번 확인 → 라인 금액(과세 VAT 10%) 검증 →
listPurchaseEntries 그룹 집계 → getPurchaseJournal 기간 필터 → deletePurchaseEntry 수기전표만.

## 검증
- tsc 클린, smoke-purchase 통과, 브라우저 E2E(매입관리 입력 → 매입장 즉시 반영) 확인 후 커밋.

## 비범위(YAGNI)
- 공급처 마스터 엔티티, 임시저장(DRAFT) 워크플로, PO→입고→정산 연계, 재고(physicalStock) 연동.
  (입고는 별도 RECEIVE 경로 유지. 매입장은 회계성 조회/입력에 한정.)
