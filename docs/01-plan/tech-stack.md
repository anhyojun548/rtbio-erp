# RTBIO ERP 기술 스택 및 인프라 확장 계획

**작성일**: 2026-04-14
**최종 수정**: 2026-04-15
**상태**: 1단계 기준으로 시작 → 성장에 따라 2, 3단계로 확장
**클라우드**: ✅ **Azure (Korea Central)** — 2026-04-15 확정 · 과업내용서 수정 필요 (사유: 크레딧 $6,000 + 5% 비용 우위)
**관련 자료**: 비교근거 `aws-vs-azure-비교.md` · 회의자료 `stack-meeting.html`

---

## 1. 개요

RTBIO ERP는 단일 고객(알티바이오)에서 시작하여 **여러 의료용품 업체에 판매되는 SaaS**로 확장될 예정이다. 이에 따라 인프라 설계를 **3단계 성장 로드맵**으로 구성한다.

| 단계 | 대상 | 거래처 수 | 월 예상 비용 | 특징 |
|------|------|-----------|--------------|------|
| **1단계** (현재) | 론칭 ~ 1년차 | 1~5곳 | $100~200 | 컨테이너 1~2개, 단일 DB |
| **2단계** | 본격 SaaS | 5~30곳 | $500~1,500 | 오토스케일, Read Replica, 캐시, 큐 |
| **3단계** | 엔터프라이즈 | 30곳+ | $2,000~5,000+ | 전용 인스턴스 옵션, 멀티리전 |

---

## 2. 애플리케이션 기술 스택 (공통, 전 단계 유지)

| 영역 | 기술 | 선정 이유 | 주요 대안 |
|------|------|----------|----------|
| **프레임워크** | Next.js 14 (App Router) | 프론트+API 통합, SSR, 컨테이너 배포 용이 | Nuxt 3 / Remix / SvelteKit |
| **언어** | TypeScript | 타입 안정성, ERP 데이터 모델 복잡도 대응 | JavaScript(ES2024) |
| **DB** | PostgreSQL 16 | 트랜잭션 안정성, 스키마 분리형 멀티테넌시, Read Replica 지원 | MySQL 8 / MariaDB / CockroachDB |
| **ORM** | Prisma | 타입세이프 쿼리, 멀티스키마 지원, 마이그레이션 관리 | Drizzle ORM / Kysely / TypeORM |
| **인증** | NextAuth.js + bcrypt | JWT 세션, 거래처/내부 이중 인증, 오픈소스 무료 | Clerk(유료) / Auth0(유료) / Supabase Auth |
| **UI** | Tailwind CSS | 프로토타입 디자인 시스템 호환 | Chakra UI / Styled Components / CSS Modules |
| **상태관리** | Zustand | 경량, 대시보드 실시간 상태 | Redux Toolkit / Jotai / Valtio |
| **PDF** | @react-pdf/renderer | 거래명세서, 원장 PDF 생성 (React 컴포넌트로) | Puppeteer(HTML→PDF) / jsPDF / PDFKit |
| **유효성 검증** | Zod | 입력 검증, API 스키마 타입 추론 | Yup / Joi / Valibot |
| **이메일 발송** | Nodemailer + Daum SMTP | 기존 daum.net 메일 계정으로 발송 (브랜드 일관성, 별도 도메인 불필요) | SES / SendGrid / Resend (대량 발송 확장 시) |

### 2.1 멀티테넌시 전략

**스키마 분리형 (PostgreSQL Schema per Tenant)** 채택

- 공통 스키마: `public` (사용자, 테넌트 마스터, 인증)
- 테넌트별 스키마: `tenant_{id}` (제품, 거래처, 주문, 재고)
- 장점: 쿼리 격리, 백업/복원 단위 명확, 감사 대응 유리
- 단점: 마이그레이션 자동화 필요 (모든 스키마에 DDL 적용 스크립트)

### 2.2 테넌트 라우팅

- **서브도메인**: `{tenant}.rtbio-erp.com` (우선)
- 대안: 경로 기반 (`/t/{tenant}/...`) — 커스텀 도메인 요구 시 전환

### 2.3 이메일 발송 전략 (Daum 연동)

**배경**: 알티바이오가 기존에 `daum.net` 메일 계정을 사용 중. 거래처에 보내는 거래명세서/알림이 기존과 동일한 발신자로 나가야 브랜드 일관성 유지.

**선택**: Nodemailer + Daum SMTP 릴레이

**연결 설정**:
```javascript
// Nodemailer SMTP 설정
{
  host: "smtp.daum.net",
  port: 465,
  secure: true,      // SSL
  auth: {
    user: process.env.DAUM_EMAIL,         // 예: rtbio@daum.net
    pass: process.env.DAUM_APP_PASSWORD,  // Daum 앱 비밀번호
  }
}
```

**필요 조치 (알티바이오 측)**:
1. Daum 메일 계정의 **IMAP/SMTP 사용 허용** 활성화 (메일 설정 → 외부 메일 연결)
2. **앱 비밀번호 발급** (2단계 인증 사용 시)
3. 발송 전용 계정 권장 (예: `rtbio-noreply@daum.net`)

**용도별 발송**:
| 용도 | 수신자 | 내용 |
|------|--------|------|
| 거래명세서 | 거래처 담당자 | PDF 첨부 + 본문 요약 |
| 주문 확인 | 거래처 담당자 | 주문 번호, 품목, 금액 |
| 입금 확인 | 거래처 담당자 | 수령 금액, 남은 잔액 |
| 재고 알림 (내부) | 알티바이오 내부 담당자 | 재고 임계치 도달 |
| 계정 비밀번호 재설정 | 사용자 본인 | 재설정 링크 |

**제약 및 확장 시점**:
- Daum SMTP 일일 발송 한도: 약 **500~1,000통** (계정 상태에 따라 다름)
- 월 발송량이 1,000통을 넘으면 → **Amazon SES** 또는 **SendGrid**로 전환
  - 전환 시점에 별도 도메인(예: `noreply@rtbio-erp.com`) SPF/DKIM 설정 필요
- 초기 1단계(거래처 1~5곳)에서는 Daum SMTP로 충분

**대체 이메일 서비스 비교 (향후 전환 시)**:
| 서비스 | 월 비용(1,000통 기준) | 장점 | 단점 |
|--------|---------------------|------|------|
| Daum SMTP | $0 (계정 무료) | 설정 간단, 기존 계정 재사용 | 일일 한도 낮음, 도메인 고정 |
| Amazon SES | ~$0.10 | 저렴, 안정적 | 도메인 인증 필요, Sandbox 모드 해제 |
| SendGrid | $0 (100통/일 무료) | 대시보드, 템플릿 관리 | 무료 티어 제한적 |
| Resend | $0 (3,000통/월 무료) | 개발자 친화적 API | 신규 서비스(2023~) |

---

## 3. 1단계 인프라 — 론칭 (현재, Azure)

### 3.1 구성

```
[사용자]
    ↓
[Azure Front Door] (CDN + WAF)
    ↓
[Azure Container Apps] × 1~2 (Next.js)
    ↓
[Azure Database for PostgreSQL Flexible Server] (Burstable B2ms)
    ↓
[Azure Blob Storage] (PDF/엑셀)
```

### 3.2 상세 서비스

| 계층 | 서비스 | 사양 | 월 비용(USD) |
|------|--------|------|-------------|
| CDN/WAF | Azure Front Door Basic | 표준 | ~$35 |
| 앱 실행 | Container Apps (0.5 vCPU, 1GB) × 1 | Consumption | ~$30 |
| DB | PostgreSQL Flexible B2ms (2 vCPU, 4GB, 128GB) | Single Server | ~$80 |
| 파일 | Blob Storage (50GB + 트래픽) | Hot tier | ~$10 |
| 이메일 | Daum SMTP 릴레이 (Nodemailer) | 기존 daum.net 계정 | $0 |
| 모니터링 | Application Insights (기본) | Free ~5GB | $0 |
| **합계** | | | **~$155** |

**Azure 스타트업 크레딧 $6,000 적용 시**: 약 37개월간 무료 운영 가능

> AWS 동급 구성 비교는 `aws-vs-azure-비교.md` 참조 (선택 근거 보존용).

### 3.3 1단계에서 생략하는 것

**원칙**: YAGNI (You Aren't Gonna Need It) + 측정 기반 스케일업. 1~5곳 규모에서는 비용/복잡도 증가 대비 효과가 미미하므로 2단계 전환 시그널 발생 시점에 단계적 투입.

| 생략 항목 | 대체 | 생략 이유 | 절약 비용 | 도입 시점 |
|----------|------|----------|----------|----------|
| **Redis 캐시** | Node.js `lru-cache` (앱 메모리) | 동시 사용자 10~30명 수준, 반복 쿼리 QPS 낮음. 컨테이너 1개 운영이라 분산 캐시 불필요 | +$45/월 | 컨테이너 2개 이상 운영 시 (세션 공유 필요) |
| **Read Replica** | 단일 DB (`t3.medium` 1대) | 읽기+쓰기 QPS 모두 여유. Prisma 읽기/쓰기 라우팅 분기 복잡도 회피 | +$150/월 | 대시보드/보고서 쿼리로 OLTP 저하 체감 시 |
| **별도 큐 서비스** (SQS / Azure Queue) | PG `FOR UPDATE SKIP LOCKED` + `node-cron` | 큐 작업 하루 수십~수백 건. 트랜잭션과 큐가 같은 DB에 있어 정합성 유리 | +$25/월 | 큐 처리량 >1,000건/일 또는 DLQ 요구 발생 시 |
| **Multi-AZ DB** | Single-AZ + 컨테이너 자동 복구 + PITR 백업 | 의료용품 ERP는 초단위 가용성 불요. AZ 장애 시 복구 30분 이내 수용 가능 | +$80/월 | SLA 99.9% 약정 또는 거래처 5곳 초과 시 |

**"풀스펙" 1단계와 비교**

| 구성 | 월 비용 |
|------|---------|
| **현재 1단계 (생략 적용)** | **~$160** |
| 위 4항목 모두 추가 시 | ~$460 (2.9배) |

→ 월 +$300 투자해도 1~5곳 시점에서는 체감 효과 0에 가까움.

**단, 코드 레벨 준비는 미리**
- Prisma 읽기/쓰기 클라이언트 구조 분리 가능하게 설계
- 큐 작업은 인터페이스 추상화 (나중에 SQS/Redis 붙일 때 최소 변경)
- 세션 저장소는 swap-able 하게 (메모리 → Redis 전환 준비)

---

## 4. 2단계 인프라 — SaaS 확장 (거래처 5~30곳)

### 4.1 구성

```
[사용자]
    ↓
[Azure Front Door Premium]
    ↓
[Azure Container Apps] × 2~5 (오토스케일)
    ↓                      ↓
[Azure Cache for Redis]   [PostgreSQL Flexible Server (General Purpose)]
    ↓                      ↓
[Azure Storage Queue]     [Read Replica × 1~2]
    ↓
[Azure Functions] (백그라운드 작업)
    ↓
[Azure Blob Storage]
```

### 4.2 추가되는 요소

| 추가 요소 | 목적 | 월 비용 증가분(USD) |
|----------|------|--------------------|
| Container Apps 오토스케일 2~5 | 피크 부하 대응 | +$100 |
| DB General Purpose 승급 | 동시 커넥션 ↑, 성능 ↑ | +$200 |
| Read Replica × 1 | 대시보드/보고서 쿼리 분산 | +$150 |
| Azure Cache for Redis (C1) | 세션, 쿼리 캐시 | +$45 |
| Azure Functions | 정산 마감, 알림, 배치 | +$20 |
| Storage Queue | 이메일/PDF 작업 큐 | +$5 |
| **합계 증분** | | **+$520** |
| **1단계 비용 포함 총액** | | **~$680** |

### 4.3 2단계에서 도입하는 것

- **백그라운드 작업 분리**: PDF 생성, 이메일 발송, 엑셀 내보내기를 Azure Functions로 이동
- **캐시 계층**: Redis로 세션 공유(다중 인스턴스) + 자주 조회되는 마스터 데이터 캐시
- **DB 커넥션 풀링**: PgBouncer 또는 Prisma Accelerate
- **모니터링 강화**: Application Insights + 커스텀 대시보드, 알림 규칙
- **CI/CD 고도화**: GitHub Actions → Azure Container Registry → 자동 배포

---

## 5. 3단계 인프라 — 엔터프라이즈 (거래처 30곳+)

### 5.1 구성

```
[사용자]
    ↓
[Azure Front Door Premium] (멀티리전)
    ↓
[AKS (Kubernetes)] × 여러 노드
    ↓                    ↓
[공용 테넌트 Pool]      [전용 테넌트 Pool]
    ↓                    ↓
[PostgreSQL Hyperscale (Citus)]  or  [전용 DB 인스턴스]
    ↓
[Redis Enterprise]
    ↓
[Event Grid / Service Bus]
    ↓
[Blob Storage (CDN 연계)]
```

### 5.2 주요 변경 사항

| 항목 | 2단계 | 3단계 |
|------|-------|-------|
| 컨테이너 | Container Apps | AKS (Kubernetes) |
| DB | Flexible Server + Replica | Hyperscale (Citus) 또는 테넌트별 분리 |
| 메시징 | Storage Queue | Service Bus / Event Grid |
| 캐시 | Cache Redis C1 | Redis Enterprise (클러스터) |
| 배포 | 단일 리전 | 멀티 리전 (국내 + 글로벌) |
| 격리 | 스키마 분리 | 대형 고객은 **전용 인스턴스 옵션 제공** |

### 5.3 엔터프라이즈 대응 추가 요소

- **SOC 2 / ISO 27001** 인증 준비
- **전용 인스턴스 옵션**: 대형 고객 대상 단독 DB + VPC 분리
- **SLA 99.9%** 보장
- **감사 로그 보존** 7년 (법정 기준)
- **데이터 암호화**: 저장 시 TDE, 전송 시 TLS 1.3

---

## 6. 확장성 관점에서 스택 재검토

각 스택 요소가 1→3단계로 확장 시 병목이 되지 않는지 검증:

### ✅ 문제 없음 (확장 가능)

| 스택 | 확장성 평가 | 비고 |
|------|-------------|------|
| **Next.js** | ⭐⭐⭐⭐⭐ | 컨테이너 수평 확장, Stateless 설계 가능 |
| **TypeScript** | ⭐⭐⭐⭐⭐ | 코드베이스 커질수록 유리 |
| **PostgreSQL** | ⭐⭐⭐⭐⭐ | Read Replica, Partitioning, Citus로 수평 확장 가능 |
| **Tailwind CSS** | ⭐⭐⭐⭐⭐ | 빌드타임 처리, 런타임 영향 없음 |
| **Zustand** | ⭐⭐⭐⭐⭐ | 클라이언트 상태관리, 서버 무관 |

### ⚠️ 2~3단계에서 보강 필요

| 스택 | 이슈 | 대응 |
|------|------|------|
| **Prisma** | 서버리스/멀티 인스턴스 환경에서 커넥션 폭증 | Prisma Accelerate 또는 PgBouncer 도입 (2단계) |
| **NextAuth.js** | 기본 DB 세션 → 다중 인스턴스에서 병목 | Redis 세션 스토어로 전환 (2단계) |
| **@react-pdf/renderer** | 대량 생성 시 메모리/CPU 부담 | Azure Functions로 분리 (2단계) |
| **Nodemailer + SMTP** | 대량 발송 시 불안정 | SendGrid/Azure Communication Services (2단계~) |

### ❌ 교체 검토 필요 (시점이 오면)

| 스택 | 이슈 | 대체 후보 |
|------|------|----------|
| **단일 DB 스키마 분리형** | 100곳+ 테넌트에서 한계 | Citus(Hyperscale) 또는 테넌트별 DB 분리 (3단계) |
| **Next.js 내부 스케줄러** | 멀티 인스턴스에서 중복 실행 위험 | 1단계 후반부터 Azure Functions + Queue로 이전 |

---

## 7. 단계 전환 트리거

자동으로 다음 단계로 넘어가는 기준:

### 1단계 → 2단계 이동 시그널
- 거래처 5곳 이상 확보
- 월 평균 동시 접속자 50명 이상
- DB CPU 70% 이상 지속
- 응답 시간 p95 > 1초

### 2단계 → 3단계 이동 시그널
- 거래처 30곳 이상 확보
- 대형 엔터프라이즈 고객 온보딩 (전용 인프라 요구)
- 컴플라이언스 인증 요구 (SOC 2 등)
- 월 매출 3억 이상

---

## 8. 데이터 보안 (전 단계 공통)

의료용품 업체 대상 SaaS의 보안 필수 요구:

- **저장 암호화**: DB TDE, Blob Storage 암호화
- **전송 암호화**: TLS 1.3 강제
- **접근 제어**: RBAC (역할 기반 권한), API 키 분리
- **감사 로그**: 모든 데이터 변경 이력 보존 (InventoryLog, AuditLog)
- **백업**: 일일 자동 백업, PITR(Point-in-Time Recovery) 7일
- **개인정보**: 거래처 담당자 정보만 수집, 최소 수집 원칙

---

## 9. 결정 사항 요약

| 항목 | 선택 | 비고 |
|------|------|------|
| 클라우드 | ✅ **Azure (Korea Central)** | 2026-04-15 확정. 크레딧 $6,000 활용 |
| 멀티테넌시 | ✅ **스키마 분리형** | 의료업 데이터 격리 요구 |
| 1단계 앱 실행 | ✅ **Container 기반** (ECS Fargate or Container Apps) | 서버리스 대비 ERP에 적합 |
| 호스팅 | ✅ **Container 기반** | Vercel 배제 (서버리스 한계 — 콜드스타트, DB 커넥션, 함수 타임아웃) |
| 앱 프레임워크 | ✅ **Next.js 14 + TypeScript** | 과업내용서 명시 |
| DB | ✅ **PostgreSQL 16** | 수평 확장 가능 (Replica / Citus) |
| ORM | ✅ **Prisma** | 2단계부터 Prisma Accelerate or PgBouncer 보강 |
| 인증 | ✅ **NextAuth.js** | 2단계부터 Redis 세션 전환 |
| 이메일 발송 | ✅ **Nodemailer + Daum SMTP** | 기존 daum.net 계정 재사용. 월 1,000통 초과 시 SES 전환 |
| 현재 진행 단계 | **1단계** | 2, 3단계는 성장 시점에 전환 |

---

## 10. 후속 조치 (클라우드 결정 후)

1. **과업내용서 "AWS" 명시 → Azure 로 수정 공문** — 클라이언트 발송 예정
2. **Azure 스타트업 크레딧 신청** — 법인 등록 후 Microsoft for Startups 신청 ($6,000)
3. **Azure 구독 + Korea Central 리전 생성** — 프로젝트 리소스 그룹 `rg-rtbio-prod` 예정
4. **커스텀 도메인 정책** — 테넌트별 `{name}.rtbio-erp.com` vs 커스텀 도메인 (미결)
5. **장애 복구 RTO/RPO 목표** — SLA 문서화 시 결정 (미결)
