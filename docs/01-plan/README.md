# 기획 문서 인덱스 (docs/01-plan)

**목적**: RTBIO ERP 기술 스택 / 인프라 / 개발 방식 의사결정 문서
**최종 수정**: 2026-04-17
**상태**: ✅ **기술 스택 확정 (Azure + Next.js + PostgreSQL)** · 🟡 **현재는 프로토타입(프론트 Only) 보완 중 → 알티바이오 최종 승인 후 Phase 1 착수**

> ⚠️ **지금 단계**: 백엔드/DB/배포는 아직 착수 안 함. HTML/CSS/JS + Mock 데이터로 **알티바이오에 공유할 프론트 화면**을 완성하는 중.
> 실제 스택 코드 작업은 클라이언트 승인 이후 시작. 상세: `../README.md`, `../superpowers/plans/2026-04-17-prototype-step-abc.md`

---

## 문서 맵

### 📦 A. 기술 스택 결정 (오늘 회의 대상)

| 파일 | 목적 | 상태 |
|------|------|------|
| `tech-stack.md` | 전체 기술 스택, 1~3단계 인프라 로드맵 | 🟢 확정 (Azure) |
| `aws-vs-azure-비교.md` | AWS vs Azure 1:1 비교 (선택 근거 보존) | 🟢 완료 (Azure 선택) |
| `stack-meeting.html` | 회의용 프레젠테이션 (화면 공유) | 🟢 완료 |

### 🤖 B. 하네스 엔지니어링 (개발 방식, 스택 결정 후 착수)

| 파일 | 목적 | 상태 |
|------|------|------|
| `harness-engineering-plan.md` | 하네스 전략 | 🟢 완료 |
| `harness-meeting.html` | 회의용 프레젠테이션 | 🟢 완료 |
| `../superpowers/plans/2026-04-15-harness-engineering-setup.md` | 셋업 실행 플랜 (5 Task) | 🟢 완료 |
| `../../CLAUDE.md` | 프로젝트 도메인 지식 (자동 로드) | 🟢 완료 |

---

## 🎯 현재 상태 (2026-04-15)

### ✅ 확정 사항
- **앱 스택**: Next.js 14 + TypeScript + PostgreSQL 16 + Prisma + NextAuth.js
- **UI**: Tailwind CSS + shadcn/ui + Zustand
- **호스팅 방식**: Container 기반 (Vercel 등 서버리스 배제)
- **멀티테넌시**: 스키마 분리형 (Schema per Tenant)
- **테넌트 라우팅**: 서브도메인 (`{tenant}.rtbio-erp.com`)
- **이메일**: Nodemailer + Daum SMTP (기존 daum.net 계정 연동)
- **시작 단계**: 1단계 (1~5곳, 월 ~$155)
- ✅ **클라우드**: **Azure (Korea Central)** — 2026-04-15 확정
  - 앱: Container Apps · DB: PostgreSQL Flexible B2ms · CDN/WAF: Front Door · 파일: Blob Storage
  - 크레딧: Microsoft for Startups $6,000 (법인 등록 후 신청)

### ⬜ 후속 조치 (Azure 결정 직후)
- 과업내용서의 "AWS" → "Azure" 명시 변경 공문 (클라이언트 발송)
- Azure 스타트업 크레딧 신청 (법인 등록 상태 확인 후)
- Azure 구독 + `rg-rtbio-prod` 리소스 그룹 생성
- 커스텀 도메인 정책 (미결)
- 장애 복구 RTO/RPO 목표 (미결, SLA 문서화 시)

---

## ✅ 결정 기록 (2026-04-15)

```
회의 일자: 2026-04-15
결정 사항:
- 클라우드: ✅ Azure (Korea Central)
- 선택 이유: 크레딧 $6,000 + 비용 5% 우위 + 멀티테넌시 설계 적합
- 과업내용서 수정 필요: Yes (클라이언트 공문 발송 예정)
- Azure 크레딧 신청: Yes (법인 등록 완료 후)
- 인증: NextAuth.js (Firebase 대비 멀티테넌시/규제 대응 유리)

다음 액션:
1. 과업내용서 변경 공문 작성
2. 법인 등록 → Microsoft for Startups 신청
3. 하네스 엔지니어링 셋업 (60분)
4. Phase 1 (스키마 설계) 착수
```

---

## 🔁 결정 반영 상태 (체크리스트)

- [x] `README.md` — 상태 배지 정리, 결정 내용 반영
- [x] `tech-stack.md` — 🟡 제거, 3장 Azure로 통일, 9장 결정 사항 확정
- [x] `aws-vs-azure-비교.md` — 상단 "✅ 최종 선택: Azure" 배너 추가
- [x] `CLAUDE.md` — 클라우드 = Azure 확정으로 업데이트
- [ ] 과업내용서 변경 공문 초안 (클라이언트 발송 대기)
- [ ] `../superpowers/specs/2026-04-14-erp-backend-design.md` 인프라 섹션 점검
- [ ] 하네스 엔지니어링 셋업 실행 중

---

## 🛣️ 다음 단계

1. **Day 0 (현재)**: ✅ 클라우드 결정 완료 → 하네스 엔지니어링 셋업 진행 중
   - 실행 플랜: `../superpowers/plans/2026-04-15-harness-engineering-setup.md`
   - Task 0~1: 사전 체크 + CLAUDE.md 검증 ✅ (완료)
   - Task 2: 플러그인 설치 (`/plugin install oh-my-claudecode`) 🟡 **사용자 직접 실행 필요**
   - Task 3: 동작 검증 (`/ask`, `/autopilot`)
   - Task 4: 커스텀 도메인 에이전트 3개 작성 중 (schema/pricing/inventory)
   - Task 5: Phase 1 dry-run
2. **Day 1~**: Phase 1 (Schema 설계) 착수
   - `/autopilot "prisma schema 초안"` 으로 시작
   - 완료 후 `/learner` 로 패턴 축적

---

## 📎 관련 문서

- `../superpowers/specs/2026-04-14-erp-backend-design.md` — 백엔드 설계서 (비즈니스 규칙, 스키마 변경 이력)
- `../개발계획서_RTBIO_ERP.md` — 초기 개발계획서
- `../ERP_기능_분석_및_추가계획.md` — 기능 분석
- `../회의록_260410_알티바이오미팅.md` — 알티바이오 미팅 회의록
