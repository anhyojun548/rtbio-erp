# RTBIO ERP 문서 인덱스

**최종 수정**: 2026-04-18
**현재 단계**: 🟢 **프로토타입 + 과업내용서 완료 → 4/21·4/27 데모 → 계약 체결 → Phase 1 실개발**

---

## 🎯 지금 하는 일

> **프론트엔드 프로토타입과 과업내용서(2종) 모두 확정**된 상태.
> 4/21·4/27 알티바이오 데모에서 최종 검증 → 계약 체결 → Phase 1 실개발 착수.
> 계약 체결 전까지 백엔드/DB/배포 코드 금지.

| 구분 | 상태 |
|------|------|
| 기술 스택 결정 | ✅ 확정 (Azure + Next.js + PostgreSQL + Prisma) |
| 하네스 엔지니어링 셋업 | 🟢 원칙·에이전트 준비 완료 (Day 0는 계약 후 실행) |
| 프로토타입 프론트 (Step A/B/C) | ✅ 완료 |
| 팀별 배포본 5개 | ✅ 완료 (`prototype/teams/*/`) |
| 과업내용서 2종 (간소화·상세) | ✅ 완료 (`docs/3. 과업내용서_RTBIO_*_260417.docx`) |
| **마스터 플랜 2026-04-18** | ✅ SSOT 수립 |
| 4/21 1차 데모 | ⬜ 예정 |
| 4/27 2차 데모 | ⬜ 예정 |
| 계약 체결 | ⬜ 예정 (~4/30) |
| Phase 1 (Prisma 스키마) | ⬜ 미착수 (5/4~) |

---

## 📂 폴더 구조

```
docs/
├── README.md                    ← 이 파일 (최상위 인덱스)
├── 01-plan/                     기획/스택/개발방식 결정
│   ├── README.md
│   ├── tech-stack.md            ✅ 확정 기술 스택 (Azure)
│   ├── aws-vs-azure-비교.md     AWS vs Azure 선택 근거
│   ├── harness-engineering-plan.md  하네스 전략 (최종 갱신 4/18)
│   ├── stack-meeting.html
│   └── harness-meeting.html
│
├── superpowers/                 플랜·스펙 (승인된 실행 문서)
│   ├── plans/
│   │   ├── 2026-04-15-harness-engineering-setup.md  Day 0 셋업
│   │   ├── 2026-04-17-team-implementation-plan.md   (이력 — 대체됨)
│   │   ├── 2026-04-17-prototype-step-abc.md         (이력 — 완료됨)
│   │   └── 2026-04-18-master-plan.md                ⭐ SSOT
│   └── specs/
│       ├── 2026-04-03-rtbio-erp-design.md           초기 설계
│       └── 2026-04-14-erp-backend-design.md         백엔드 상세 설계
│
├── 3. 과업내용서_RTBIO_간소화_260417.docx   ⭐ 계약용 (분쟁 예방형)
├── 3. 과업내용서_RTBIO_상세_260417.docx     ⭐ 계약용 (R01~R24 스코프 확정형)
├── 3. 과업내용서_RTBIO_최종_260414.docx     (원본 — 참고용)
├── 개발계획서_RTBIO_ERP.md
├── ERP_기능_분석_및_추가계획.md
├── 회의록_260410_알티바이오미팅.md
│
└── [클라이언트 산출물]
    ├── RTBIO_과업지시서_v3.1_260410.docx
    ├── RTBIO_요구기능명세서_v1.0.html
    ├── RTBIO_업무자동화시스템_설계문서_v1.2.*
    └── RTBIO_견적서_v1.0.* / Option_A/B.xlsx
```

---

## 🧭 어디서부터 봐야 하나

| 질문 | 읽을 문서 |
|------|----------|
| "지금 뭐 하고 있지?" | ⭐ `superpowers/plans/2026-04-18-master-plan.md` |
| "계약 어느 버전으로 보낼까?" | 간소화=분쟁예방 / 상세=스코프확정 |
| "확정된 기능 리스트는?" | 마스터 플랜 §2 (R01~R24) 또는 상세 docx |
| "기술 스택이 뭐로 정해졌지?" | `01-plan/tech-stack.md` §9 |
| "Azure를 왜 골랐지?" | `01-plan/aws-vs-azure-비교.md` |
| "실개발 Phase별 일정은?" | 마스터 플랜 §4 |
| "하네스 명령어 어떻게 쓰지?" | `01-plan/harness-engineering-plan.md` §2 |
| "백엔드 설계 상세?" | `superpowers/specs/2026-04-14-erp-backend-design.md` |
| "도메인 규칙(가격/재고/반품)?" | 루트 `CLAUDE.md` |
| "알티바이오 요구사항 원본?" | `회의록_260410_알티바이오미팅.md` |

---

## 🚦 단계 게이트

```
[완료] 프로토타입 Step A/B/C + 과업내용서 2종
          │
          ▼
   4/21 1차 데모 (QC·경영지원)
          │
          ▼
   4/27 2차 데모 (영업·거래처·CEO)
          │
          ▼
   ✅ 계약 체결 (간소화 or 상세 선택) — 여기 통과 후에만 다음으로
          │
          ▼
   Day 0: 하네스 Day 0 셋업 (60분)
          │
          ▼
   Phase 1: Prisma 스키마 (W1-2)
   Phase 2: 인증·RBAC·미들웨어 (W3)
   Phase 3: 마스터 (제품/거래처/재고) (W4-5)
   Phase 4: 주문·칸반·가격 스냅샷 (W6-7)
   Phase 5: 경영지원 (명세서/원장/수금) (W8-9)
   Phase 6: 영업 (담당자/학회) (W10)
   Phase 7: 통합·알림·CEO 대시보드 (W11)
   Phase 8: QA (W12-13)
   Phase 9: Azure 배포 (W14)
```

> 원칙: **프로토타입은 백엔드 없이, 실개발은 승인 받은 프로토타입 그대로**.
> 스펙 변경 시 문서 먼저 갱신 → 클라이언트 공유 → 구현.

---

## ⬜ 후속 조치 (트래킹)

- [ ] 4/21 데모 리허설 (Chrome 모바일 뷰 포함)
- [ ] 4/21 팀별 배포본 송부 (알티바이오 공용 이메일)
- [ ] 1차 피드백 수집 양식 준비
- [ ] 4/27 영업·CEO·거래처 시나리오 점검
- [ ] 과업내용서 "AWS → Azure" 변경 공문 (계약 시 반영)
- [ ] Microsoft for Startups 크레딧 신청 (법인 등록 후)
- [ ] `docs/개발계획서_RTBIO_ERP.md` 1.2 스택 표 AWS → Azure 교정
- [ ] 커스텀 도메인 정책 (테넌트 서브도메인 vs 커스텀)
- [ ] RTO/RPO 목표 정의
- [ ] Phase 1 착수 전 → `docs/02-design/`, `docs/03-analysis/`, `docs/04-report/` 디렉터리 생성
