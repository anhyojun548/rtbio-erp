# RTBIO ERP 시스템 개발 계획서

**작성일:** 2026.04.13
**작성자:** 하마다랩스 개발팀

---

## 1. 개요

### 1.1 목표
하마다랩스 ERP 기본 기능 + RTBIO 커스터마이징(R01~R25)을 통합한 웹 기반 ERP 시스템 구축.
기존 얼마에요를 완전 대체하며, 프로토타입(prototype/)에서 확정된 UI/UX를 실제 서비스로 구현한다.

### 1.2 기술 스택

| 영역 | 기술 | 선정 이유 |
|------|------|----------|
| **프레임워크** | Next.js 14 (App Router) | 프론트+API 통합, SSR 지원, 배포 용이 |
| **언어** | TypeScript | 타입 안정성, ERP 데이터 모델 복잡도 대응 |
| **DB** | PostgreSQL | 트랜잭션 안정성, 원장/정산 데이터 무결성 |
| **ORM** | Prisma | 타입 세이프 쿼리, 마이그레이션 관리 |
| **인증** | NextAuth.js + bcrypt | JWT 세션, 거래처/내부 이중 인증 |
| **PDF** | @react-pdf/renderer | 거래명세서, 마감 원장 PDF 생성 |
| **이메일** | Nodemailer + SMTP | 거래명세서, 원장 자동 발송 |
| **상태관리** | Zustand | 경량, 대시보드 실시간 상태 |
| **UI** | Tailwind CSS | 프로토타입 디자인 시스템 빠르게 구현 |
| **호스팅** | AWS (EC2 + RDS) | 과업내용서 명시 |
| **파일저장** | AWS S3 | PDF, 엑셀 내보내기 파일 저장 |

### 1.3 프로젝트 구조

```
rtbio-erp/
├── prisma/
│   ├── schema.prisma          # DB 스키마 정의
│   ├── seed.ts                # 초기 데이터 (얼마에요 이관 포함)
│   └── migrations/            # DB 마이그레이션
│
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # 인증 관련 페이지
│   │   │   └── login/
│   │   ├── (client)/          # 거래처 포탈
│   │   │   ├── orders/        # 발주폼, 발주내역
│   │   │   ├── shipping/      # 출고 상태 조회
│   │   │   └── layout.tsx
│   │   ├── (internal)/        # 내부 포탈 (사이드바 레이아웃)
│   │   │   ├── dashboard/     # 대표 대시보드
│   │   │   ├── admin/         # 경영지원팀
│   │   │   │   ├── orders/
│   │   │   │   ├── invoices/
│   │   │   │   ├── ledger/
│   │   │   │   ├── reports/
│   │   │   │   ├── clients/
│   │   │   │   └── purchases/ # 매입 관리
│   │   │   ├── qc/            # 품질관리팀
│   │   │   │   ├── orders/
│   │   │   │   ├── shipping/
│   │   │   │   ├── inventory/
│   │   │   │   └── samples/
│   │   │   ├── sales/         # 영업팀
│   │   │   │   ├── usage/
│   │   │   │   └── clients/
│   │   │   └── layout.tsx
│   │   ├── api/               # API Routes
│   │   │   ├── auth/
│   │   │   ├── orders/
│   │   │   ├── products/
│   │   │   ├── clients/
│   │   │   ├── inventory/
│   │   │   ├── invoices/
│   │   │   ├── ledger/
│   │   │   ├── payments/
│   │   │   ├── purchases/
│   │   │   └── reports/
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── ui/                # 공통 UI (Button, Modal, Table, Badge 등)
│   │   ├── forms/             # 폼 컴포넌트 (발주폼, 입력폼 등)
│   │   ├── charts/            # 차트 (바 차트, 파이프라인 등)
│   │   └── layout/            # 레이아웃 (Sidebar, TopBar, PageHeader)
│   │
│   ├── lib/
│   │   ├── db.ts              # Prisma 클라이언트
│   │   ├── auth.ts            # 인증 설정
│   │   ├── pdf.ts             # PDF 생성 유틸
│   │   ├── email.ts           # 이메일 발송 유틸
│   │   ├── permissions.ts     # 권한 체크 미들웨어
│   │   ├── pricing.ts         # 할인단가 계산 (BR-03)
│   │   ├── shipping.ts        # 배송비/무료배송 계산 (BR-04)
│   │   └── constants.ts       # 비즈니스 상수 (마감시간 등)
│   │
│   ├── hooks/                 # React 커스텀 훅
│   └── types/                 # TypeScript 타입 정의
│
├── public/
│   └── assets/                # 로고 등 정적 파일
│
├── scripts/
│   ├── migrate-eolmaeyo.ts    # 얼마에요 데이터 이관 스크립트
│   └── seed-demo.ts           # 데모 데이터 시드
│
└── docs/                      # 문서 (현재 폴더에서 이동)
```

---

## 2. 데이터베이스 설계 (ERD 요약)

### 2.1 핵심 테이블

```
┌─────────────────────────────────────────────────────────────┐
│                        기초 데이터                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [users]              [clients]           [products]        │
│  - id                 - id                - id              │
│  - name               - name              - name            │
│  - login_id           - type (대리점/병원) - sku             │
│  - password_hash      - manager           - category        │
│  - role (admin/qc/    - login_id          - base_price      │
│    sales/exec/client) - password_hash     - set_qty         │
│  - department         - payment_type      - side            │
│  - is_active          - closing_period    - sizes[]         │
│  - last_login         - email             - is_active       │
│                       - phone             - safety_stock    │
│                       - address                             │
│                       - invoice_type                        │
│                                                             │
│  [client_discounts]          [client_fixed_prices]          │
│  - client_id                 - client_id                    │
│  - category                  - product_id                   │
│  - discount_rate (%)         - fixed_price                  │
│                                                             │
│  [client_addresses]                                         │
│  - client_id                                                │
│  - label (기본/직송 등)                                      │
│  - address, recipient, phone                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     발주 / 출고 / 매출                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [orders]                    [order_items]                  │
│  - id (ORD-YYYYMMDD-NNN)    - order_id                     │
│  - client_id                 - product_id                   │
│  - status (접수/확정/        - size                          │
│    출고중/완료)              - qty                           │
│  - shipping_type             - unit_price (할인 적용가)      │
│  - shipping_address_id                                      │
│  - alt_address                                              │
│  - assignee_id                                              │
│  - ship_date_type                                           │
│    (당일/익일)                                               │
│  - ordered_at                                               │
│  - confirmed_at                                             │
│  - completed_at                                             │
│                                                             │
│  [shipments]                                                │
│  - order_id                                                 │
│  - stage (대기/바코드/세팅/포장/송장/완료)                     │
│  - assignee_id                                              │
│  - tracking_no                                              │
│  - carrier                                                  │
│  - stage_timestamps (JSON: 단계별 시각)                      │
│                                                             │
│  [invoices]                  (거래명세서)                     │
│  - order_id                                                 │
│  - pdf_url                                                  │
│  - email_sent_at                                            │
│  - email_status                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     매입 / 입고 / 재고                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [purchases]                 (매입)                          │
│  - id                                                       │
│  - supplier_name                                            │
│  - purchase_date                                            │
│  - total_amount                                             │
│  - note                                                     │
│                                                             │
│  [purchase_items]                                           │
│  - purchase_id                                              │
│  - product_id                                               │
│  - qty                                                      │
│  - unit_cost (매입단가)                                      │
│                                                             │
│  [inventory]                                                │
│  - product_id                                               │
│  - size                                                     │
│  - current_qty                                              │
│  - safety_stock                                             │
│                                                             │
│  [inventory_logs]            (재고 변동 이력)                 │
│  - product_id                                               │
│  - size                                                     │
│  - change_type (입고/출고/샘플/조정)                          │
│  - change_qty (+/-)                                         │
│  - reference_id (order_id / purchase_id / sample_id)        │
│  - created_by                                               │
│  - created_at                                               │
│                                                             │
│  [sample_shipments]          (샘플/미팅용 출고)               │
│  - product_id                                               │
│  - qty                                                      │
│  - recipient                                                │
│  - reason                                                   │
│  - cost_amount (원가)                                        │
│  - shipped_at                                               │
│  - created_by                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     정산 / 수금 / 원장                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [payments]                  (수금/입금)                      │
│  - id                                                       │
│  - client_id                                                │
│  - amount                                                   │
│  - payment_method (카드/계좌이체)                             │
│  - payment_date                                             │
│  - note                                                     │
│  - created_by                                               │
│                                                             │
│  [ledger_periods]            (마감 원장)                      │
│  - id                                                       │
│  - client_id                                                │
│  - period_start                                             │
│  - period_end                                               │
│  - total_sales                                              │
│  - prev_balance (이월 미수금)                                 │
│  - total_payment (수금액)                                    │
│  - closing_balance (잔액)                                    │
│  - status (생성/검토중/확정/발송완료)                          │
│  - pdf_url                                                  │
│  - sent_at                                                  │
│                                                             │
│  [usage_records]             (영업팀 사용량)                  │
│  - client_id                                                │
│  - product_id                                               │
│  - period                                                   │
│  - qty_used                                                 │
│  - recorded_by                                              │
│  - visit_date                                               │
│                                                             │
│  [audit_logs]                (시스템 감사 로그)               │
│  - user_id                                                  │
│  - action                                                   │
│  - target_type                                              │
│  - target_id                                                │
│  - changes (JSON)                                           │
│  - ip_address                                               │
│  - created_at                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 핵심 관계

```
clients  1──N  orders       1──N  order_items
clients  1──N  client_discounts
clients  1──N  client_fixed_prices
clients  1──N  client_addresses
clients  1──N  payments
clients  1──N  ledger_periods
clients  1──N  usage_records

orders   1──1  shipments
orders   1──1  invoices

products 1──N  order_items
products 1──N  purchase_items
products 1──N  inventory (product + size 복합키)
products 1──N  inventory_logs

purchases 1──N  purchase_items

users    1──N  orders (assignee)
users    1──N  audit_logs
```

---

## 3. 개발 단계

전체 개발을 **5단계**로 나누어 진행한다. 각 단계는 이전 단계 위에 쌓이는 구조.

---

### STEP 0: 인프라 + 기본 ERP 뼈대 (1주)

> 프로젝트 세팅, DB, 인증, 기초 데이터 CRUD — 모든 후속 개발의 기반

**작업 항목:**

| # | 작업 | 상세 |
|---|------|------|
| 0-1 | 프로젝트 초기 세팅 | Next.js + TypeScript + Prisma + PostgreSQL + Tailwind |
| 0-2 | DB 스키마 생성 | 위 ERD 기반 Prisma schema, 초기 마이그레이션 |
| 0-3 | 인증 시스템 | 내부 사용자(이메일/PW) + 거래처(ID/PW) 이중 인증, bcrypt, JWT 세션 |
| 0-4 | 권한 미들웨어 | role 기반 라우트 보호 (admin/qc/sales/exec/client) |
| 0-5 | 공통 레이아웃 | 사이드바, 모바일 탑바, 페이지 헤더 (프로토타입 CSS 이식) |
| 0-6 | 공통 UI 컴포넌트 | Button, Table, Modal, Toast, Badge, StatCard, Tab |
| 0-7 | 기초 데이터 관리 | 제품 CRUD, 거래처 CRUD, 내부 사용자 CRUD |
| 0-8 | 얼마에요 데이터 이관 | 엑셀 → DB 임포트 스크립트 (거래처, 제품, 거래이력, 미수금) |

**완료 기준:**
- 로그인 → 역할별 대시보드 접근 가능
- 제품/거래처 등록·수정·조회 가능
- 얼마에요 데이터 임포트 완료

---

### STEP 1: 발주 → 출고 핵심 플로우 (2주)

> 거래처 발주부터 출고 완료까지 — 가장 핵심적인 업무 흐름
> 대응 R기능: R01, R02, R03, R04, R05, R06, R10

**작업 항목:**

| # | 작업 | 대응 R | 상세 |
|---|------|--------|------|
| 1-1 | 거래처 로그인 | R01 | ID/PW 인증, 5회 실패 잠금, 세션 2시간 |
| 1-2 | 거래처 발주폼 | R02 | 엑셀 양식 기반 UI, 카테고리별 제품 목록, 수량 입력, 실시간 합계 |
| 1-3 | 발주 접수 처리 | R03 | 발주번호 자동생성 (ORD-YYYYMMDD-NNN), DB 저장, 알림 |
| 1-4 | 배송지 관리 | R10 | 기본 배송지 + 직송 주소 입력, 배송방법 선택 |
| 1-5 | 발주 확정 (QC) | R04 | 당일/익일 선택, 15:30 자동 익일, 일괄 확정 |
| 1-6 | 출고 관리 (QC) | R05 | 담당자 배정, 6단계 칸반보드, 송장번호 입력 |
| 1-7 | 출고 상태 조회 (거래처) | R06 | 6단계 타임라인, 송장번호/택배 추적 |
| 1-8 | 재고 자동 차감 | R08 일부 | 출고완료 시 재고 차감 (BR-10), 재고 이력 기록 |

**핵심 비즈니스 로직:**
- 할인단가 계산: 고정단가 > 제품군 할인율 > 기본단가 (BR-03)
- 마감시간 15:30 이후 자동 익일 분류 (BR-01)
- 출고 단계 순차 진행만 허용 (역방향 불가)
- 세트 상품 환산 (BR-12)

**완료 기준:**
- 거래처 로그인 → 발주 → QC 확정 → 출고 → 거래처 상태 조회 전체 플로우 동작
- 재고가 출고 시 자동 차감

---

### STEP 2: 매출 정산 + 기본 ERP (2주)

> 거래명세서, 매입, 수금, 원장 — ERP의 돈 흐름
> 대응 R기능: R07, R08 나머지, R09, R11, R17

**작업 항목:**

| # | 작업 | 대응 R | 상세 |
|---|------|--------|------|
| 2-1 | 거래명세서 자동 생성 | R07 | 출고완료 트리거 → PDF 생성 (거래처/RTBIO 양식), 이메일 자동 발송 |
| 2-2 | 할인율 관리 | R09 | 거래처×제품군 매트릭스, 고정단가, 변경 이력 |
| 2-3 | 결제 방식 관리 | R17 | 당월말카드/사용량카드/계좌이체/N개월후 결제, 계산서 발행 자동판단 |
| 2-4 | 매입 관리 | ERP 기본 | 매입 등록, 매입 내역 조회, 제품별 매입단가 |
| 2-5 | 입고 관리 | R08 보강 | 입고 등록/확정, 재고 가산, 입고 이력, 매입 연동 |
| 2-6 | 수금/입금 관리 | ERP 기본 | 입금 등록, 카드결제 확인, 부분입금, 미수금 자동 차감 |
| 2-7 | 부서별 권한 관리 | R11 | 역할별 메뉴/데이터 접근 제어, 권한 변경 이력 |
| 2-8 | 재고 관리 화면 | R08 | 제품 등록/수정, 재고 현황, 안전재고, 입고 등록, 재고 이력 |

**완료 기준:**
- 출고 완료 → 명세서 PDF 자동 생성 + 이메일 발송
- 매입 등록 → 입고 → 재고 증가 플로우 동작
- 수금 등록 → 미수금 자동 차감
- 부서별 접근 권한 분리 동작

---

### STEP 3: 마감/보고서 + 고도화 (2주)

> 마감 원장, 보고서, 발주 수정, 무료배송, 샘플 출고
> 대응 R기능: R12, R13, R14, R15, R16, R18, R19, R20

**작업 항목:**

| # | 작업 | 대응 R | 상세 |
|---|------|--------|------|
| 3-1 | 마감 원장 자동 생성 | R16 | 거래처별 마감기간 설정, 자동 계산, 잔액 이월, PDF 생성+발송 |
| 3-2 | 일일 보고서 | R18 | 매일 자동 집계, 업체별 발주/매출 요약 |
| 3-3 | 기간별 매출 보고서 | R20 | 자유 기간 설정, 거래처/제품군 필터, 엑셀 다운로드 |
| 3-4 | 영업팀 사용량 입력 | R19 | 병원별 사용량 입력, 마감원장 연동, 미입력 알림 |
| 3-5 | 일일 재고 현황 | R14 | 매일 자동 집계, 제품군별 발주/출고/잔여, 엑셀 다운로드 |
| 3-6 | 발주 수정 | R12 | 마감 전 + 포장 전 수정 허용 (BR-02), 변경 이력 |
| 3-7 | 무료배송 안내 | R13 | 실시간 배송비 계산, 추가 수량 안내 (BR-04) |
| 3-8 | 샘플/미팅용 출고 | R15 | 매출 미반영, 재고 차감, 원가 기록 (BR-11) |

**완료 기준:**
- 마감 원장 자동 생성 → 검토 → 확정 → 메일 발송
- 일일/기간별 보고서 자동 생성
- 발주 수정이 시간/상태 조건에 따라 정확히 제한

---

### STEP 4: 대시보드 + 통합 (1주)

> 대표 대시보드, 통합 테스트
> 대응 R기능: R21

**작업 항목:**

| # | 작업 | 대응 R | 상세 |
|---|------|--------|------|
| 4-1 | 대표 대시보드 | R21 | 월 매출, 발주 파이프라인, 미수금, 매출 추이 차트, 팀별 활동 |
| 4-2 | 경영지원 대시보드 | - | 오늘 발주, 명세서 발송, 수금 현황, 마감 일정 |
| 4-3 | QC 대시보드 | - | 발주 대기, 출고 진행, 재고 경고 |
| 4-4 | 영업 대시보드 | - | 담당 거래처 현황, 사용량 미입력 알림 |
| 4-5 | 통합 테스트 | - | 전체 플로우 E2E, 권한별 접근 테스트, 데이터 정합성 |
| 4-6 | 성능/보안 | - | SQL 인젝션 방지, XSS 방지, API Rate Limit, 데이터 격리 검증 |

**완료 기준:**
- 프로토타입에서 확인한 모든 화면이 실데이터로 동작
- 거래처 간 데이터 격리 검증 통과
- 전체 업무 플로우(발주→출고→명세서→수금→마감) E2E 통과

---

### STEP 5: 배포 + 추후 검토 기능

> 운영 배포, R22~R25는 데이터 축적 후 순차 개발

| # | 작업 | 대응 R | 시점 |
|---|------|--------|------|
| 5-1 | AWS 배포 | - | STEP 4 완료 후 |
| 5-2 | SSL + 도메인 | - | 배포 시 |
| 5-3 | 카카오톡 알림 | R22 | 비용 확정 후 |
| 5-4 | 거래처 원장 조회 | R23 | 2차 미팅 후 |
| 5-5 | 재고 수요 예측 | R24 | 데이터 3~6개월 축적 후 |
| 5-6 | 품절 자동 차단 | R25 | RTBIO 확인 후 |

---

## 4. 개발 일정 요약

```
STEP 0  ████░░░░░░░░░░░░░░░░  인프라 + 기본 뼈대         1주
STEP 1  ░░░░████████░░░░░░░░  발주 → 출고 핵심 플로우     2주
STEP 2  ░░░░░░░░░░░░████████  매출 정산 + 기본 ERP        2주
STEP 3  ░░░░░░░░░░░░░░░░░░░░████████  마감/보고서 + 고도화  2주
STEP 4  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████  대시보드 + 통합  1주
        ─────────────────────────────────
        총 8주 (약 2개월)
```

---

## 5. API 설계 (주요 엔드포인트)

### 5.1 인증

```
POST   /api/auth/login          # 로그인 (내부 + 거래처 통합)
POST   /api/auth/logout         # 로그아웃
GET    /api/auth/me             # 현재 사용자 정보
```

### 5.2 기초 데이터

```
GET    /api/products            # 제품 목록 (필터: category, active)
POST   /api/products            # 제품 등록
PUT    /api/products/:id        # 제품 수정
GET    /api/products/:id        # 제품 상세

GET    /api/clients             # 거래처 목록
POST   /api/clients             # 거래처 등록
PUT    /api/clients/:id         # 거래처 수정
GET    /api/clients/:id         # 거래처 상세 (할인율, 결제방식, 주소 포함)
PUT    /api/clients/:id/discounts     # 할인율 설정
PUT    /api/clients/:id/fixed-prices  # 고정단가 설정

GET    /api/users               # 내부 사용자 목록
POST   /api/users               # 사용자 등록
PUT    /api/users/:id           # 사용자 수정 (역할/권한)
```

### 5.3 발주/출고

```
GET    /api/orders              # 발주 목록 (필터: status, date, client)
POST   /api/orders              # 발주 접수 (거래처)
GET    /api/orders/:id          # 발주 상세
PUT    /api/orders/:id          # 발주 수정 (시간/상태 제한)
POST   /api/orders/:id/confirm  # 발주 확정 (QC, 당일/익일)
POST   /api/orders/bulk-confirm # 일괄 확정

PUT    /api/orders/:id/shipment         # 출고 단계 변경
PUT    /api/orders/:id/shipment/assign  # 담당자 배정
PUT    /api/orders/:id/shipment/tracking # 송장번호 입력

GET    /api/orders/:id/status   # 출고 상태 조회 (거래처용)
```

### 5.4 매입/입고/재고

```
GET    /api/purchases           # 매입 목록
POST   /api/purchases           # 매입 등록
GET    /api/purchases/:id       # 매입 상세

POST   /api/inventory/receive   # 입고 등록
GET    /api/inventory           # 재고 현황 (필터: category, status)
GET    /api/inventory/logs      # 재고 변동 이력
PUT    /api/inventory/adjust    # 재고 수동 조정

POST   /api/samples             # 샘플 출고 등록
GET    /api/samples             # 샘플 이력
```

### 5.5 정산/수금

```
GET    /api/payments            # 수금 목록
POST   /api/payments            # 입금 등록
GET    /api/payments/:id        # 수금 상세

GET    /api/invoices            # 거래명세서 목록
GET    /api/invoices/:id/pdf    # 명세서 PDF 다운로드
POST   /api/invoices/:id/resend # 명세서 재발송

GET    /api/ledger              # 마감 원장 목록
POST   /api/ledger/generate     # 원장 생성 (기간 지정)
PUT    /api/ledger/:id/confirm  # 원장 확정
POST   /api/ledger/:id/send     # 원장 메일 발송
GET    /api/ledger/:id/pdf      # 원장 PDF 다운로드
```

### 5.6 보고서

```
GET    /api/reports/daily       # 일일 보고서
GET    /api/reports/period      # 기간별 매출 보고서
GET    /api/reports/inventory   # 일일 재고 현황
GET    /api/reports/export      # 엑셀 다운로드 (type, filter)
```

### 5.7 영업

```
GET    /api/usage               # 사용량 목록
POST   /api/usage               # 사용량 입력
PUT    /api/usage/:id           # 사용량 수정
```

---

## 6. 핵심 비즈니스 로직 구현 방침

| BR | 로직 | 구현 위치 |
|----|------|----------|
| BR-01 | 15:30 이후 자동 익일 | `POST /api/orders/:id/confirm` 서버 시간 체크 |
| BR-02 | 발주 수정 제한 | `PUT /api/orders/:id` 미들웨어에서 시간+상태 검증 |
| BR-03 | 할인단가 우선순위 | `lib/pricing.ts` — 고정단가 > 할인율 > 기본단가 |
| BR-04 | 무료배송 기준 | `lib/shipping.ts` — 카테고리별 최소수량 체크 |
| BR-05 | 직송 명세서 비고 | `lib/pdf.ts` — 명세서 생성 시 alt_address → 비고란 |
| BR-06 | 마감 기간 설정 | `clients.closing_period` 파싱 → 원장 자동 생성 cron |
| BR-07 | 계산서 발행 기준 | `clients.payment_type` 기반 자동 판단 |
| BR-08 | 사용량 결제 | `usage_records` 미입력 시 원장 금액 보류 |
| BR-09 | 명세서 양식 선택 | `clients.invoice_type` → PDF 템플릿 분기 |
| BR-10 | 재고 차감 시점 | `shipment.stage = 'done'` 이벤트 → inventory 차감 |
| BR-11 | 샘플 출고 | `sample_shipments` → 재고 차감만, 매출 미반영 |
| BR-12 | 세트 상품 환산 | `products.set_qty` × 주문수량 = 재고 차감 수량 |

---

## 7. 데이터 이관 계획

### 7.1 이관 대상

| 데이터 | 원본 | 이관 테이블 | 비고 |
|--------|------|------------|------|
| 거래처 정보 | 얼마에요 엑셀 | clients, client_discounts | 할인율·결제방식 포함 |
| 제품 마스터 | 얼마에요 엑셀 | products | 품목코드 매핑 |
| 거래 이력 | 얼마에요 엑셀 | orders, order_items | 과거 발주 데이터 (통계용) |
| 미수금 잔액 | 얼마에요 엑셀 | ledger_periods | 이관 시점 잔액 초기값 |

### 7.2 이관 프로세스

```
1. RTBIO에서 얼마에요 엑셀 내보내기
2. 엑셀 컬럼 → DB 컬럼 매핑 정의
3. scripts/migrate-eolmaeyo.ts 실행
4. 이관 건수 + 검증 결과 리포트 출력
5. RTBIO 검수 → 이상 없으면 운영 전환
```

---

## 8. 보안 체크리스트

- [ ] 비밀번호 bcrypt 암호화 (salt round 12)
- [ ] JWT 세션 + HttpOnly Cookie
- [ ] 로그인 5회 실패 → 30분 잠금
- [ ] API Rate Limiting (분당 60회)
- [ ] 거래처 간 데이터 격리 (모든 쿼리에 client_id 필터)
- [ ] SQL Injection 방지 (Prisma ORM 사용)
- [ ] XSS 방지 (React 기본 이스케이프 + CSP 헤더)
- [ ] CORS 설정 (운영 도메인만 허용)
- [ ] 민감 데이터 로깅 제외
- [ ] 감사 로그 (audit_logs) 1년 보관
