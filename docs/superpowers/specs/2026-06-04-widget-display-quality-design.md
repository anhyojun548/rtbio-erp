# 위젯 템플릿/표시 품질 정상화 — 설계

**작성일**: 2026-06-04 · **상태**: 설계 확정(구현 대기)

## 배경 / 문제 (dry-run 실측)

대시보드 위젯 prefab 10종을 dry-run한 결과 **3종만 제대로 작동**하고 나머지는 결함:

| 위젯 | 소스 | 결과 | 문제 |
|---|---|---|---|
| 이번 달 매출 / 진행 중 주문 / 활성 거래처 | invoice·order·client | ₩468M / 4 / 129 | ✅ 정상 |
| 미수금 합계 | ledger | 0 | 데이터 없음(당월 원장) |
| 재고 임계치 알림 / 재고 부족 Top5 | productSize | 0 / 0행 | reorderPoint 미설정 + 근사치 |
| 만료 임박 계약 (×2) | **conference** | 0 / 0행 | ❌ **잘못된 소스**(학회≠계약) |
| Top 5 거래처 | invoice | series O | ⚠️ **라벨이 cuid**(거래처명 X) |
| 최근 주문 5건 | order | rows O | ⚠️ **원시 컬럼 통째**(id/clientId/내부필드) |

원인은 (A) 카탈로그에 계약 소스 부재, (B) 엔진이 groupBy id를 이름으로 안 풀고 table을 원시 행 그대로 반환, (C) 데이터 미설정. **엔진·빌더·Flowise는 정상이나 결과 표시 품질과 템플릿이 미완성.**

## 목표

위젯이 **자동으로 사람이 읽는 라벨/컬럼**을 내도록 엔진에 표시 계층을 추가하고, 계약 소스를 더하고, 데이터를 채우고, 실무 템플릿을 보강해 **"바로 쓸 수 있는" 위젯 라이브러리**로 만든다. + 우클릭 "위젯 수정" 시 현재 설정이 보이는 빌더 역-프리필.

## 결정 (사용자 확정)

1. 표시 품질 = **자동 (소스별 displayConfig)** — spec 변경 없이 템플릿·빌더 둘 다 정상화 (명시 override는 후속)
2. 계약 = **SalesContract 소스 추가** (스키마 존재, 화이트리스트 확장)
3. 템플릿 = **기존 복구 + 자주 쓰는 신규 보강**
4. 데이터 = reorderPoint **시드 영속** + 원장/매출은 **실DB 데모용**. 시드 날짜 앵커링(fresh 배포 당월 데이터)은 **범위 밖**(후속)
5. (추가) 우클릭 "위젯 수정" = **빌더 현재-spec 프리필** + 기존 위젯 갱신

---

## 1. 표시 품질 엔진 (핵심)

**신규 `src/lib/widget-spec/display.ts`** — 표시 설정 레지스트리(순수 데이터 + 헬퍼):

```
// ID 필드 → 참조 모델·라벨필드 (groupBy 라벨 해석용; 소스 무관 전역)
LABEL_RESOLVERS = {
  clientId:  { model: "client",  labelField: "name" },
  productId: { model: "product", labelField: "name" },
  // 필요 시 userId/salesRepId 등 확장
}

// 소스별 table 표시 컬럼 (순서 + 한글 라벨; "client.name" 등 관계 dot 허용)
DISPLAY_COLUMNS = {
  order:    [["orderNumber","주문번호"],["client.name","거래처"],["status","상태"],["orderDate","주문일"]],
  invoice:  [["invoiceNumber","번호"],["client.name","거래처"],["status","상태"],["totalAmount","합계"],["issueDate","발행일"]],
  salesContract: [["title","계약명"],["client.name","거래처"],["startDate","시작일"],["endDate","종료일"],["signed","서명"]],
  productSize: [["product.name","제품"],["sizeCode","사이즈"],["availableStock","가용"],["reorderPoint","안전재고"]],
  payment:  [["client.name","거래처"],["amount","입금액"],["status","상태"],["paidAt","입금일"]],
  // 소스별 정의 없으면 기존 6컬럼 슬라이스 폴백(하위호환)
}
```

**`execute.ts` 변경 (2곳):**
- **groupBy 시리즈**: groupBy 필드가 `LABEL_RESOLVERS`에 있으면, 결과의 id들을 모아 `prisma.{model}.findMany({where:{id:{in}}, select:{id,name}})` **1회 배치 조회** → series 라벨을 id→이름으로 치환. resolver 없으면(status/month 등) 값 그대로.
- **table 행(findMany)**: 소스의 `DISPLAY_COLUMNS`가 있으면 (1) 필요한 관계를 `include`로 가져오고 (2) 각 행을 **`{ 한글라벨: 값 }`** 으로 투영(관계 dot 경로 해석, Date→ISO, Decimal→number). 정의 없으면 기존 동작 유지.

→ 렌더러(`_renderSpecTable`)는 키가 곧 헤더라 **수정 거의 불필요**. 템플릿·빌더·Flowise 위젯 전부 자동으로 이름/한글 컬럼.

**의존성/경계**: `display.ts`는 순수 상수+타입(Prisma 의존 X). `execute.ts`만 이를 읽어 조회 보강. 단위 테스트로 격리 가능.

## 2. SalesContract 소스

- `schema.ts`: `WIDGET_SOURCES += "salesContract"`
- `execute.ts`: delegate 맵에 `salesContract → prisma.salesContract`. rowLevel(`ownClientOnly`)은 `clientId` 보유로 자동 적용(CLIENT 격리).
- `data-catalog/route.ts`: `salesContract` 항목 — fields(title, startDate, endDate, signed, "client.name", "client.type") + note("만료 임박 = endDate gte {{now.startOfDay}} lte {{now.startOfDay.plus(30,'day')}}")
- `display.ts`: 위 DISPLAY_COLUMNS + clientId resolver
- `presets.ts`: `kpi_expiring_contracts` / `list_ending_contracts` 의 `source: conference → salesContract` (endDate 필터 동일)

## 3. 데이터 채우기

- **reorderPoint(영속)**: `prisma/seed.ts` 에서 활성 제품 사이즈에 안전재고 시드(예: 사이즈별 50~100). + 실DB 적용. → 재고 임계치/부족 위젯이 실제 OUT/LOW 표시.
- **미수금(실DB)**: 현재월 `recomputeLedgerMonth(thisMonth)` 실행 → kpi_total_ar 채움.
- ⚠️ 한계 명시: 시드는 과거 날짜를 생성 → fresh 배포의 "이번 달" 매출/미수금은 빈다. 완전 해결(시드 현재날짜 앵커링)은 **별도 후속**.

## 4. 템플릿 보강 (표현 가능한 것만)

신규 prefab(표시품질 수정 후 깔끔히 동작):
- `kpi_daily_sales` 일 매출 (invoice, gte {{now.startOfDay}})
- `kpi_weekly_sales` 주간 매출 (invoice, gte {{now.minus(7,'day')}})
- `kpi_received` 수금 합계 (payment, status in [PARTIAL,PAID], 당월)
- `list_top_clients` 는 표시품질로 자동 정상화(거래처명) — 신규 불필요

※ **제품별 매출·시계열(line) 추이**는 품목단위 소스(OrderItem) + 날짜 버킷팅 부재로 **범위 밖**(후속 과제로 문서화).

## 5. 빌더 편집 프리필 (추가 요구)

위젯 **우클릭 → "위젯 수정"** 시 빌더가 **현재 spec으로 채워져** 열려 설정이 보이고 그대로 편집.

- **`public/portals/js/widget-builder.js`**: `fillFormFromSpec(spec)` 신규 — `buildSpecFromForm` 의 역방향(소스→change→측정값/분류 채움, 필터행 재구성, 차트/제목/정렬/limit 세팅). `openBuilder(existingSpec?, widgetId?)` 확장.
- **`public/portals/js/widget-dashboard.js`**: 컨텍스트 메뉴 `edit` 액션을 spec 위젯이면 `window.openBuilderForEdit(widgetId)` 로 연결(현재는 title-only 모달). spec은 `window._specCache[widgetId]` 에서 읽음.
- **저장(편집)**: 빌더 저장이 편집모드면 그리드 아이템의 `_specCache` 갱신 + 재렌더 + `saveDashboard()`(bulk 동기화가 config.spec 갱신 영속). 신규 위젯 생성 아님.

## 6. 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `src/lib/widget-spec/display.ts` | 신규 — LABEL_RESOLVERS + DISPLAY_COLUMNS + 헬퍼 |
| `src/lib/widget-spec/execute.ts` | groupBy 라벨해석 + table 컬럼큐레이션 + salesContract delegate |
| `src/lib/widget-spec/schema.ts` | WIDGET_SOURCES += salesContract |
| `src/app/api/dashboard/data-catalog/route.ts` | salesContract 항목 |
| `src/lib/widget-spec/presets.ts` | 계약 2종 소스 수정 + 신규 prefab 3 |
| `prisma/seed.ts` | reorderPoint 시드 |
| `public/portals/js/widget-builder.js` | fillFormFromSpec + 편집모드 openBuilder |
| `public/portals/js/widget-dashboard.js` | 컨텍스트 edit → 빌더 편집 연결 |
| `docs/02-design/dashboard-widget-api.md` | 카탈로그(salesContract)·표시동작 갱신 |

## 7. 검증

- **단위테스트**: `display.test.ts`(resolver 매핑·컬럼 투영·dot 경로), execute의 salesContract 실행/라벨해석/컬럼큐레이션. 기존 vitest 회귀 + tsc 클린.
- **브라우저 재실측**: 10+신규 prefab 전부 dry-run → cuid·원시컬럼·빈값(계약) 사라짐 확인. reorderPoint/원장 적용 후 재고·미수금 값 표시.
- **편집 프리필**: 템플릿 위젯 추가 → 우클릭 수정 → 빌더가 소스·집계·필터·제목 채워져 열림 → 수정·저장 → 갱신 확인.

## 8. 범위 밖 (후속 과제)

- 시드 현재날짜 앵커링(fresh 배포 당월 데이터)
- 제품별 매출 / 시계열 line 추이 (OrderItem 소스 + 날짜 버킷팅)
- 담당자별(salesRep) 차원·목표(target) (이전 세션 보류)
- spec.columns 명시 override + 빌더 컬럼 선택 UI (자동의 상위호환)

## 리스크

- groupBy 라벨 배치조회는 **추가 쿼리 1회**(N+1 아님, in 절 1회) — 성능 영향 미미.
- table 컬럼 투영 시 관계 include 누락 주의 → resolver/컬럼 정의에 필요한 관계만 정확히 include.
- salesContract rowLevel: clientId 필드 확인됨 → CLIENT 격리 정상.
