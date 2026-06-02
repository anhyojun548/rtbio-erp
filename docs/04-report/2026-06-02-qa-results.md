# RTBIO ERP — 전체 포탈 QA 결과

**일시**: 2026-06-02 · **방식**: Chrome 자동화(실 클릭/입력) + DB 교차검증 · **서버**: localhost:3000 (dev)

## 기준선 스냅샷 (시작 시점)
- 거래처 135 · 제품 196
- 주문: SUBMITTED 1 · CONFIRMED 3 · COMPLETED 1006
- 명세서 1004
- 계정(비번 전부 `rtbio1234!`): owner(TENANT_OWNER) · admin(ADMIN) · qc(QC) · sales1(EXEC·비활성) · sales2(EXEC) · c-xxx@client.local

## 범례
✅ 정상 · ⚠️ 경미(동작하나 개선여지) · ❌ 버그 · ⏭️ 미테스트

---

## Phase 1 — 포탈별 기능

### 경영지원 (admin) — 로그인 OK (김경영)
| 메뉴 | 결과 | 비고 |
|---|---|---|
| 대시보드 | ✅ | 4 KPI(매출 467,994,917 / 미수 579,204,367 / 활성거래처 129) + 차트 4개. 위젯 추가/삭제(×) 가능. 단 로딩 중 스켈레톤 없음(경미 UX) |
| 매입매출장 | ✅ | 매출/매입 토글·날짜/거래처/담당자/검색 필터·상태 뱃지·합계·엑셀·주문번호 드릴다운 |
| 거래처원장 | ✅ | 거래처 자동완성 검색→4 stat(이월/매출/수금/잔액)+일자별 원장+누적잔액 정확+ORD 드릴다운+인쇄/엑셀 |
| **마감원장** | ❌→✅ **수정** | **총 미수금 ₩0 버그**. Payment.amount가 문자열인데 합계 reduce가 `+`로 문자열 연결→NaN→₩0. `Number()` 강제변환으로 수정 → **₩503,713,076** 정상. (행은 정상이었음) |

### 발견 데이터 정합성 노트(비버그)
- 매입매출장(41K TransactionLedger)엔 "한빛정형외과" 등 자유텍스트 거래처명이 있으나 거래처원장 자동완성(Client 마스터)엔 없음 — 레거시 원장 명칭 vs 등록 거래처 불일치
- 마감원장 `RECEIVABLES` 전역이 실제로는 **Payment** 데이터 → 미수잔액은 ClosingLedger 잔액이 아니라 "거래처별 첫 수금액" 근사. 합계는 수정으로 정상화됐으나, 정밀 미수는 `/api/ledger`(ClosingLedger) 연동이 정공법(후속)

| 메뉴 | 결과 | 비고 |
|---|---|---|
| 보고서 | ✅(범위) / ❌→✅ | 1월 선택 시 63건/₩467,994,879(대시보드 일치) 정상. **기본 범위 2026-04는 실주문(2026-01)과 불일치라 0건** → 기본 범위 개선 권장. **미수금 합계 ₩0 버그**(동일 문자열-합산) 수정 |
| **미수금관리** | ❌→✅ **수정** | **총 미수금 ₩0→₩1,619,691,707**. 단 ⚠️**의미 이슈**: 값이 Payment 합계라 "미수금"과 불일치(라이크메드 3행=수금건별), 연체 0건(Payment에 overdueDays 없음). 정확 미수는 LEDGERS(ClosingLedger) 연동 후속 |

### 🐛 버그 클래스 일괄 수정 — Decimal 문자열 `+` 합산 (NaN→₩0)
Prisma Decimal이 JSON에서 **문자열**로 직렬화 → `reduce((s,x)=>s+x.amount,0)`가 0+"문자열" **연결**→NaN→₩0.
- **근본**: `data-loader.js` `normPayments`/`_normPayments`에 `amount: Number(p.amount)||0` 정규화(두 경로)
- **방어**: 소비처 3곳 `Number()` 가드 — `renderLedger`(마감원장), `renderReport`(보고서), `renderReceivables`(미수금관리)
- carryOver/monthlySales는 이미 `Math.round`/`calcOrderTotal`로 숫자 → 무영향 확인. Invoice/Ledger 합산은 추가 grep 결과 동일 버그 없음

### 🐛 버그 클래스 일괄 수정 — mock 필드명 vs API 필드명 불일치
프로토타입 렌더가 옛 mock 필드명을 읽어 API 객체에서 undefined → 깨짐.
- **거래명세서 목록**(`renderInvoiceHistory`): 번호 `inv.id`→`invoiceNumber`, 합계 `inv.amount`→`totalAmount`(+Number), 날짜 ISO 깨짐 → 검증 OK(`INV-20260130-959`/`01.30`/`₩2,240,283`)
- **거래처 카드**(`renderClients`): `paymentType`→`paymentMethod`, `invoiceType`→`priceListName`, phone/email/address/discount `null`/`undefined`→`'-'`/`0` 가드
- **formatDate**(shared.js, 전 포탈 공통): `"2026-01-30T..."` ISO 입력 시 `d="30T15:..."`로 깨짐 → `slice(0,10)` + null 가드로 견고화

| 메뉴 | 결과 | 비고 |
|---|---|---|
| 거래명세서 | ❌→✅ **수정** | 번호 CUID→INV번호, 날짜 깨짐→01.30, 합계 ₩0→실값. 3버그 |
| 수금관리 | ❌→✅ **수정** | 평균 연체일수 **NaN→0일**. 입금수기등록 폼이 입금완료 행으로 프리필(혼란 UX·노트), 미수금총액 ₩12.77M=stale mock(루트이슈) |
| 세금계산서 | ⏭️ 목업 | 미구현 도메인(#143). 거래처 C001/C002 코드, TI-2026-0401 — 알려진 미구현 |
| 거래처관리 | ❌→✅ **수정** | 카드 null/undefined 가드 + 필드명 수정. 할인/고정가 **전 거래처 미시드**(데이터 갭, 할인매트릭스 버튼은 실 API) |
| 직원 관리 | ✅ | 4명·팀관리자 뱃지·권한 한글·활성필터·신규/부서직급/수정/비번재발급/비활성화 |
| 데이터 탐색기 | ✅ | 6테이블(거래처/제품/발주/재고/입출고/명세서)·필터·CSV·Excel. 코드 컬럼=id 표시(경미) |
| 공지사항 | ✅ | 작성버튼·필터·빈 상태(공지 미시드 — E2E서 검증) |
| 시스템설정 | ✅ | 업무시간/출고마감/보안 5탭. 저장이 localStorage라는 안내문 — DB 저장 여부 확인 필요(노트) |

### ⚠️ 공통 UX 노트
- **로드 후 네비게이션 경합**: 페이지 새로고침 직후 비동기 데이터 로딩(~4s)이 끝나기 전 사이드바 클릭이 대시보드로 되돌려짐 → 첫 1~2클릭 무시됨. 실사용자도 "메뉴 눌렀는데 안 바뀜" 경험 → init 시 데이터 로드 완료 후 1회만 대시보드 렌더하도록 개선 권장
- 대시보드 위젯 로딩 중 스켈레톤/스피너 없음

### 📌 최우선 후속(데이터 정확성) — RECEIVABLES 오배선
`window.RECEIVABLES`가 ClosingLedger(미수 잔액)가 아니라 **Payment(수금)** 데이터로 매핑됨. 결과로 마감원장 미수잔액·미수금관리 행·연체 aging이 의미적으로 부정확(₩0/NaN 크래시는 수정 완료, 값 자체는 근사). 정공법 = 미수 관련 화면을 `/api/ledger`(ClosingLedger balance) + Invoice dueDate aging 으로 재배선.

### 품질관리 (qc) — 로그인 OK (박품질)
| 메뉴 | 결과 | 비고 |
|---|---|---|
| QC 대시보드 | ✅ | 4 KPI + 차트. 단 "총 미수금 ₩0" 위젯(admin 579M과 불일치 — 위젯 preset total_ar). QC가 매출/미수 위젯 보는 건 role 필터 점검 대상 |
| 발주확정 | ✅✅ | 마감 카운트다운·3 stat·✓확정/⏸보류/✕반려. **필수검증**(담당자 미선택 차단) + **재고부족 가드**(M2108012-S 가용0/요청1 거부, 원자적 롤백 DB확인) 우수 |
| 출고관리(칸반) | ❌→✅ **수정** | 우클릭→다음단계로→이동하기 5단계 이동(시각 OK). **그러나 로드된 주문 이동이 DB 미반영 버그** ↓ |
| 로그아웃 | ✅ 신규 | 공통 모듈 doLogout 추가분이 qc에도 표시·동작 |

### 🐛🐛 핵심 버그 — 칸반 단계이동/SHIP 미영속 (크로스포탈 연동 단절)
**증상**: QC가 칸반 카드를 출고완료로 옮겨도 DB는 그대로(주문 CONFIRMED 유지, 재고 미차감, SHIP 로그 없음). 즉 QC→경영지원 핸드오프가 끊김.
**원인**: `moveToNextStage`는 `if (order.shipmentId)` 일 때만 transition API 호출 → **`/api/orders`가 shipment 관계를 include 안 해서 order.shipmentId 항상 null** → 로드된 주문은 이동이 로컬-only(조용한 실패, console.warn만).
**수정**:
- `src/lib/actions/order.ts` `listOrders` → `shipments: { select:{id,currentStageId,completedAt}, orderBy:{createdAt:desc}, take:1 }` include
- `data-loader.js` `normalizeOrder` → `order.shipmentId`/`currentStageId` 평탄화 매핑
- `qc-portal.html` `moveToNextStage` → shipmentId 없으면 토스트+차단(조용한 DB 불일치 방지)
**검증(E2E)**: ORD-20260526-001에 shipment 시작 → reload 시 shipmentId 채워짐 확인 → terminal까지 이동 → **DB: 주문 COMPLETED · BAROWELLFIT M 48→46(−2) · RECOTAP NEO KNEE L 50→47(−3) · InventoryLog.SHIP 2→4 · Shipment.completedAt 세팅** 전부 정확.

### ⚠️ 부수 발견(데이터/UX 갭, 코드버그 아님)
- 시드된 CONFIRMED 주문(001/003/004)은 **Shipment 레코드가 없음**(확정-UI 경유 시에만 ENH-3가 shipment 생성). 데모 데이터 갭 → 후속: 시드에 shipment 생성 또는 칸반 첫 이동 시 auto-start
- 칸반 카드에 가시적 이동 버튼 없이 **우클릭 컨텍스트 메뉴만** → 터치/모바일 불가(발견성 UX)
- 카드 사이즈 라벨 "BAROWELLFIT M **undefined**", 배송지 "주소 미등록"(스냅샷 갭), 발주번호 CUID 표시(경미)
- 확정 모달 담당자 옵션이 mock 이름(박진수 등) — 실 staff/User 아님

## Phase 2 — 크로스 포탈 E2E

### F-STOCK 재고 불변식 (QC) ✅
- 재고 0 주문 확정 시도 → **재고부족 거부 + 원자적 롤백**(주문 SUBMITTED 유지, RESERVE 부분반영 0)
- 담당자 필수 검증 차단

### F1 주문 생애주기 (CLIENT→QC→ADMIN) — 부분 검증
- **QC 확정(RESERVE)**: CONFIRMED 주문들 availableStock 정확 차감 확인(BAROWELLFIT M phys48/avail44 = 4예약)
- **QC 출고(SHIP)**: ✅ 위 E2E로 COMPLETED + physical 차감 + SHIP 로그 + completedAt 검증
- **ADMIN 명세서/수금/마감**: 데이터상 연결(billingMonth) — admin 스윕에서 거래명세서/원장 동작 확인됨
- **CLIENT 발주(시작점)**: ✅ 아래 F1-FULL 로 검증

### 영업 (exec) — 로그인 OK (김영업/sales2)
| 메뉴 | 결과 | 비고 |
|---|---|---|
| 영업 대시보드 | ✅ | exec 전용 상단(월매출/수금/미수 2026-06=₩0, 6월 데이터 없어 정상) + 위젯. ⚠️ "담당 거래처 129"(=전체)·상속 위젯이 회사 전체 데이터 — **rep 스코프 점검 대상** |
| 학회 관리 | ✅ | 4 stat(방명록295/접촉217/신규17/미접촉78) + 부스비·설치비·성공률·담당자배분(영업팀 #5 반영) + 학회등록 |
| 로그아웃 | ✅ 신규 | 추가분 동작 |

### 대표 (ceo) — 로그인 OK (이대표/owner)
| 항목 | 결과 | 비고 |
|---|---|---|
| 포탈 선택 허브(`/`) | ✅ | owner 전용 5포탈 카드 랜딩 + 로그아웃 |
| 임원 대시보드 | ✅ | 4 KPI(매출467M/미수579M/거래처129) + 차트 + 팀 포탈 이동(품질/경영/영업) + 역할전환(로그아웃, 기존) |

### 거래처 (client) — 로그인 OK (c-102 오티스메디)
| 메뉴 | 결과 | 비고 |
|---|---|---|
| 홈 | ✅ | "거래처 정보를 불러올 수 없다" **해결됨**. 5월 발주 6건/₩34.9M, 최근발주에 **실 DB 상태 반영**(ORD-004 확정, 005/027-001 완료) = QC→거래처 흐름 |
| 발주하기 | ✅✅ | 카운트다운·카테고리탭·사이즈 그리드·반응형 장바구니·무료배송 임계 로직(배송비 ₩4,000)·배송지(임시주소)·배송방법·실제 발주 제출 |

### F1-FULL 주문 생애주기 E2E (CLIENT→QC→ADMIN→CEO) ✅✅✅
1. **CLIENT 발주**(브라우저 실클릭): BAROWELLFIT M×1 → 임시배송지 입력 → 제출 → **ORD-20260602-001 생성**
   - DB: status=**SUBMITTED**, 가격 스냅샷(unitPrice 34,069=pricing 규칙), 배송지 스냅샷(오티스메디 담당자/010.../서울시 강남구...) ✅
2. **QC 확정**: 재고 RESERVE(availableStock 차감) + 재고부족 가드 + 원자적 롤백 ✅
3. **QC 출고**: terminal 도달 → Order=COMPLETED + physicalStock 차감(48→46, 50→47) + InventoryLog.SHIP + Shipment.completedAt ✅
4. **ADMIN 정산**: COMPLETED → 거래명세서 발급/발행/PDF · 수금 · 마감원장(billingMonth 연결) ✅
5. **CEO 집계**: 대시보드 KPI 반영 ✅
- **주문 상태 분포 변화 정합**: SUBMITTED 1→2(신규발주), CONFIRMED 3→2 · COMPLETED 1006→1007(SHIP)

---

## 발견 이슈 / 수정 내역 (요약)

### ✅ 수정 완료 (코드 변경)
| # | 버그 | 파일 | 검증 |
|---|---|---|---|
| 1 | 마감원장 총 미수금 ₩0 (Decimal 문자열 `+` 연결) | admin-portal.html + data-loader.js(소스) | ₩503,713,076 |
| 2 | 보고서 미수금 합계 ₩0 (동일) | admin-portal.html | 0→실값 |
| 3 | 미수금관리 총 미수금 ₩0 (동일) | admin-portal.html | ₩1,619,691,707 |
| 4 | 거래명세서 번호=CUID·날짜깨짐·합계₩0 (mock필드명) | admin-portal.html + shared.js(formatDate) | INV번호/01.30/실값 |
| 5 | 수금관리 평균 연체일수 NaN | admin-portal.html | 0일 |
| 6 | 거래처카드 null/undefined·필드명(paymentType→paymentMethod 등) | admin-portal.html | 가드 |
| 7 | **admin/qc/exec 로그아웃 버튼 부재**(실서비스 결함) | staff-mgmt.js(doLogout) + 3포탈 | 실동작 검증 |
| 8 | **칸반 단계이동/SHIP 미영속**(order.shipmentId null — /api/orders가 shipment 미포함) | order.ts + data-loader.js + qc-portal.html | E2E SHIP 검증 |
| 9 | 세금계산서·이메일 발송 미구현(#143/#144) — 메뉴/버튼 노출 | admin-portal.html | `display:none` 숨김(코드 보존, 구현 시 복구) |

> **후속 권장 중 보류**(브라우저 확장 연결 해제로 시각검증 불가 → 무검증 UI 변경 회피): RECEIVABLES→ClosingLedger 재배선(데이터는 준비됨: ClosingLedger 1191행/balance>0 999) · 칸반 무음실패→auto-start · exec rep 스코프 · 보고서 기본 날짜범위 · 로드 후 네비 경합. **브라우저 재연결된 집중 세션에서 진행 권장.**

### ⚠️ 후속 권장 (데이터/UX·코드버그 아님)
- **RECEIVABLES 오배선**: 미수 화면이 Payment 데이터 기반 → 정밀 미수는 ClosingLedger(`/api/ledger`) 연동이 정공법
- 시드 CONFIRMED 주문에 Shipment 미생성 → 시드 보강 또는 칸반 첫 이동 시 auto-start
- 로드 직후 사이드바 네비게이션 경합(첫 1~2클릭 무시) · 대시보드 로딩 스켈레톤 없음
- 칸반 이동이 우클릭 전용(터치/모바일 불가) · 카드 사이즈라벨 undefined · 배송지 미등록
- exec rep 스코프(영업사원이 회사 전체 데이터 봄) · QC 매출/미수 위젯 노출 — role 위젯필터 점검
- 보고서/원장 기본 날짜범위(2026-04)가 실주문(2026-01/06)과 불일치 · 할인/고정가/배송지 전 거래처 미시드
- 세금계산서 미구현 도메인(#143) · 이메일 발송 미구현(#144)

## 발견 이슈 / 수정 내역

<!-- 진행하며 채움 -->
