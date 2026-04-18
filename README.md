# RTBIO ERP

알티바이오 ERP — 멀티테넌트 SaaS ERP. Next.js 14 + PostgreSQL 16 + Prisma.

**현재 단계**: 🟢 Phase 1 (Prisma 스키마) 진행 중 (2026-04-18 착수)

---

## 🏃 빠른 시작 (로컬)

```bash
# 1) 의존성 설치 (이미 완료 시 건너뜀)
pnpm install

# 2) Docker Desktop 실행 후 PostgreSQL 컨테이너 띄우기
pnpm db:up

# 3) Prisma 마이그레이션 + 클라이언트 생성
pnpm prisma migrate dev --name init

# 4) 샘플 데이터 시드
pnpm prisma:seed

# 5) Next.js 개발 서버
pnpm dev   # http://localhost:3000
```

### 테스트 계정 (seed 후)
| 역할 | 이메일 | 비밀번호 |
|------|--------|---------|
| 대표 | owner@altibio.local | rtbio1234! |
| 경영지원 | admin@altibio.local | rtbio1234! |
| 품질관리 | qc@altibio.local | rtbio1234! |
| 영업 1 | sales1@altibio.local | rtbio1234! |
| 영업 2 | sales2@altibio.local | rtbio1234! |

---

## 📂 프로젝트 구조

```
rtbio-erp/
├── src/
│   ├── app/              Next.js App Router 페이지
│   ├── lib/              도메인 로직 (pricing, prisma client 등)
│   └── middleware.ts     테넌시 서브도메인 라우팅
├── prisma/
│   ├── schema.prisma     DB 스키마 (public + tenant_altibio)
│   ├── seed.ts           샘플 데이터
│   └── init.sql          PostgreSQL 초기 스크립트
├── docker-compose.yml    로컬 PostgreSQL 16
├── docs/                 기획/스펙/플랜 (프로젝트 문서)
├── prototype/            클라이언트 검증용 HTML 프로토타입
├── CLAUDE.md             프로젝트 도메인 지식 (자동 로드)
└── .claude/agents/       커스텀 도메인 에이전트 3종
```

---

## 🗄️ 스택

- **앱**: Next.js 14 (App Router) · TypeScript strict · Tailwind CSS · Zustand
- **DB**: PostgreSQL 16 (Docker 로컬) · Prisma (multiSchema)
- **인증**: NextAuth.js · bcrypt
- **유틸**: Zod · @react-pdf/renderer · Nodemailer (Daum SMTP)
- **테스트**: Vitest
- **배포**: Azure Container Apps (Korea Central, 향후)

---

## 📚 주요 문서

| 용도 | 문서 |
|------|------|
| **도메인 규칙 SSOT** | `CLAUDE.md` |
| **마스터 진행 계획** | `docs/superpowers/plans/2026-04-18-master-plan.md` |
| **과업내용서 (계약용)** | `docs/3. 과업내용서_RTBIO_상세_260417.docx` |
| **기술 스택 확정본** | `docs/01-plan/tech-stack.md` |
| **하네스 운영 원칙** | `docs/01-plan/harness-engineering-plan.md` |
| **프로토타입** | `prototype/index.html` |

---

## 🎯 Phase 로드맵

| Phase | 기간 | 내용 |
|-------|------|------|
| **P1 스키마** | W1-2 (현재) | Prisma 스키마, 멀티테넌시, 마이그레이션 |
| P2 인증 | W3 | NextAuth, RBAC, 미들웨어, 감사로그 |
| P3 마스터 | W4-5 | 제품/거래처/재고 CRUD, 할인율 |
| P4 주문 | W6-7 | 발주→확정→출고 칸반, 가격스냅샷 |
| P5 경영지원 | W8-9 | 명세서/원장/수금/보고서 |
| P6 영업 | W10 | 담당자 매출, 학회 방명록 |
| P7 통합·알림 | W11 | 재고알람, 이메일큐, CEO 대시보드 |
| P8 QA | W12-13 | 통합테스트, PDF, 모바일, 성능 |
| P9 배포 | W14 | Azure Container Apps, DB 프로비저닝 |

---

## 🛠️ 명령어

| 명령 | 용도 |
|------|------|
| `pnpm dev` | Next.js 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm test` | Vitest 실행 |
| `pnpm typecheck` | TypeScript 검증 |
| `pnpm db:up` / `db:down` | PostgreSQL 컨테이너 |
| `pnpm prisma:migrate` | 마이그레이션 생성·적용 |
| `pnpm prisma:studio` | DB 시각화 UI |
| `pnpm prisma:seed` | 샘플 데이터 시드 |
