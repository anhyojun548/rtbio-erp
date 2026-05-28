/**
 * Prefab → WidgetSpec 마이그레이션 (v1.0)
 *
 * 기존 CEO 대시보드 프리셋 10종(`DASHBOARD_WIDGET_PRESETS` +
 * `computePresetValue` 의 imperative 집계)을 선언형 `WidgetSpec` JSON 으로 표현.
 *
 * 두 가지 역할:
 *  1. **하위호환** — DB 에 저장된 기존 `DashboardWidget.preset` 키를 spec 으로 매핑해
 *     `executeWidgetSpec` 으로 렌더 가능.
 *  2. **LLM few-shot** — Flowise agent 가 자연어→spec 변환 시 모범 예시로 사용.
 *
 * 타입 전략:
 *  - 저작 편의를 위해 각 prefab 은 `z.input` 형(=defaults 생략 가능)으로 작성하고,
 *    `widgetSpecSchema.parse()` 로 통과시켜 **출력형 `WidgetSpec`** 으로 동결한다.
 *  - 따라서 `PREFAB_SPECS` 의 모든 값은 검증 완료된 정식 `WidgetSpec` 이다(불변).
 *
 * 충실도 노트 (computePresetValue 대비):
 *  - KPI: monthly_sales / total_ar / open_orders / active_clients 는 집계 결과 **동일**.
 *  - kpi_low_stock / list_low_stock: 원본은 `classifyStock` 로 OUT+LOW 분류(가용재고가
 *    아닌 physicalStock 기준 OUT, reorderPoint 기준 LOW). 컬럼-대-컬럼 비교는 Prisma
 *    where 로 직접 불가하므로 **physicalStock>0 이고 physicalStock ≤ 안전재고선** 을
 *    근사하기 위해 reorderPoint>0 필터만 적용 → 실행 후 호출부에서 classifyStock 후처리
 *    권장. (집계 정확도는 후처리에 위임. spec 은 "후보 사이즈" 모집단을 정의.)
 *  - list_top_clients: invoice 를 clientId 로 groupBy(sum totalAmount) → 원본 Map 집계와
 *    동치. 라벨은 clientId (렌더 단에서 거래처명 조인).
 *  - kpi_expiring_contracts / list_ending_contracts: 원본은 SalesContract 기준이나
 *    `WIDGET_SOURCES` 에 계약 전용 소스가 없다(whitelist 고정). conference 소스로
 *    "30일 이내 종료" 의미를 가장 가깝게 보존: conference.endDate ∈ [오늘, +30일].
 *    실제 계약 위젯은 source 화이트리스트 확장(별도 작업) 후 교체 예정 — 아래 주석 참조.
 */
import { widgetSpecSchema, type WidgetSpec } from "./schema";

// 진행 중 주문 상태 (computeKpiOpenOrders 와 동일)
const OPEN_ORDER_STATUSES = ["DRAFT", "SUBMITTED", "CONFIRMED", "SHIPPING"];

// 저작용 입력형 (defaults 생략 가능)
type SpecInput = Parameters<typeof widgetSpecSchema.parse>[0];

/**
 * 원본 prefab 정의 (입력형). 키 = DashboardWidget.preset.
 * widgetSpecSchema.parse 로 동결되어 PREFAB_SPECS 로 export 된다.
 */
const RAW_PREFABS: Record<string, SpecInput> = {
  // ─────────────────────────── KPI 6종 ───────────────────────────

  // 이번 달 매출 — ISSUED+SENT 거래명세서 totalAmount 합
  kpi_monthly_sales: {
    version: "1.0",
    title: "이번 달 매출",
    kind: "kpi",
    layout: { w: 3, h: 2 },
    data: {
      source: "invoice",
      filter: {
        status: { in: ["ISSUED", "SENT"] },
        issueDate: {
          gte: "{{now.startOfMonth}}",
          lt: "{{now.startOfMonth.plus(1,'month')}}",
        },
      },
      aggregate: { type: "sum", field: "totalAmount" },
    },
    comparison: { type: "previousPeriod", label: "전월 대비", format: "delta-percent" },
    format: { value: { type: "currency", prefix: "₩", compact: true } },
    style: { icon: "💰", color: "#1B3A5C" },
    action: { type: "navigate", to: "/admin/invoices" },
  },

  // 미수금 합계 — 이번 달 원장 balance 합
  kpi_total_ar: {
    version: "1.0",
    title: "미수금 합계",
    kind: "kpi",
    layout: { w: 3, h: 2 },
    data: {
      source: "ledger",
      filter: {
        closingMonth: { eq: "{{thisMonth}}" },
      },
      aggregate: { type: "sum", field: "balance" },
    },
    format: { value: { type: "currency", prefix: "₩", compact: true } },
    style: { icon: "🧾", color: "#B45309" },
    action: { type: "navigate", to: "/admin/ledger" },
  },

  // 진행 중 주문 — DRAFT+SUBMITTED+CONFIRMED+SHIPPING 건수
  kpi_open_orders: {
    version: "1.0",
    title: "진행 중 주문",
    kind: "kpi",
    layout: { w: 3, h: 2 },
    data: {
      source: "order",
      filter: {
        status: { in: OPEN_ORDER_STATUSES },
      },
      aggregate: { type: "count", field: null },
    },
    format: { value: { type: "number", suffix: "건" } },
    style: { icon: "📦", color: "#1D4ED8" },
    action: { type: "navigate", to: "/admin/orders" },
  },

  // 활성 거래처 — active=true 거래처 수
  kpi_active_clients: {
    version: "1.0",
    title: "활성 거래처",
    kind: "kpi",
    layout: { w: 3, h: 2 },
    data: {
      source: "client",
      filter: {
        active: { eq: true },
      },
      aggregate: { type: "count", field: null },
    },
    format: { value: { type: "number", suffix: "개" } },
    style: { icon: "🏥", color: "#047857" },
    action: { type: "navigate", to: "/admin/clients" },
  },

  // 재고 임계치 알림 — OUT+LOW 사이즈 수
  // 근사: reorderPoint>0 인 활성 제품 사이즈 모집단. 정확한 OUT/LOW 는 classifyStock 후처리.
  kpi_low_stock: {
    version: "1.0",
    title: "재고 임계치 알림",
    kind: "kpi",
    layout: { w: 3, h: 2 },
    data: {
      source: "productSize",
      filter: {
        reorderPoint: { gt: 0 },
        "product.active": { eq: true },
      },
      aggregate: { type: "count", field: null },
    },
    format: { value: { type: "number", suffix: "건" } },
    style: { icon: "⚠️", color: "#DC2626" },
    action: { type: "navigate", to: "/admin/alerts/stock" },
  },

  // 만료 임박 계약 — 30일 이내 종료.
  // SalesContract 전용 source 부재(whitelist 고정) → conference.endDate 로 의미 근사.
  kpi_expiring_contracts: {
    version: "1.0",
    title: "만료 임박 계약",
    kind: "kpi",
    layout: { w: 3, h: 2 },
    data: {
      source: "conference",
      filter: {
        endDate: {
          gte: "{{now.startOfDay}}",
          lte: "{{now.startOfDay.plus(30,'day')}}",
        },
      },
      aggregate: { type: "count", field: null },
    },
    format: { value: { type: "number", suffix: "건" } },
    style: { icon: "📝", color: "#7C3AED" },
    action: { type: "navigate", to: "/admin/contracts" },
  },

  // ─────────────────────────── LIST 4종 ───────────────────────────

  // Top 5 거래처 (이달 매출) — invoice 를 clientId 로 groupBy(sum totalAmount) desc 5
  list_top_clients: {
    version: "1.0",
    title: "Top 5 거래처 (이달 매출)",
    kind: "hbar",
    layout: { w: 6, h: 4 },
    data: {
      source: "invoice",
      filter: {
        status: { in: ["ISSUED", "SENT"] },
        issueDate: {
          gte: "{{now.startOfMonth}}",
          lt: "{{now.startOfMonth.plus(1,'month')}}",
        },
      },
      aggregate: { type: "sum", field: "totalAmount" },
      groupBy: ["clientId"],
      limit: 5,
    },
    format: { value: { type: "currency", prefix: "₩", compact: true } },
    style: { icon: "🏆", color: "#1B3A5C" },
    action: { type: "navigate", to: "/admin/reports/monthly" },
  },

  // 재고 부족 품목 Top 5 — productSize, 근사 필터 + availableStock asc
  // (원본 classifyStock OUT 우선/deficit desc 는 실행 후 후처리에 위임)
  list_low_stock: {
    version: "1.0",
    title: "재고 부족 품목 Top 5",
    kind: "table",
    layout: { w: 6, h: 4 },
    data: {
      source: "productSize",
      filter: {
        reorderPoint: { gt: 0 },
        "product.active": { eq: true },
      },
      orderBy: [{ field: "availableStock", dir: "asc" }],
      limit: 5,
    },
    style: { icon: "⚠️", color: "#DC2626" },
    action: { type: "navigate", to: "/admin/alerts/stock" },
  },

  // 만료 임박 계약 Top 5 — SalesContract endDate asc 30일 이내.
  // source 부재 → conference.endDate 로 근사 (kpi_expiring_contracts 와 동일 사유).
  list_ending_contracts: {
    version: "1.0",
    title: "만료 임박 계약 Top 5",
    kind: "table",
    layout: { w: 6, h: 4 },
    data: {
      source: "conference",
      filter: {
        endDate: {
          gte: "{{now.startOfDay}}",
          lte: "{{now.startOfDay.plus(30,'day')}}",
        },
      },
      orderBy: [{ field: "endDate", dir: "asc" }],
      limit: 5,
    },
    style: { icon: "📝", color: "#7C3AED" },
    action: { type: "navigate", to: "/admin/contracts" },
  },

  // 최근 주문 5건 — order createdAt desc 5
  list_recent_orders: {
    version: "1.0",
    title: "최근 주문 5건",
    kind: "table",
    layout: { w: 6, h: 4 },
    data: {
      source: "order",
      orderBy: [{ field: "createdAt", dir: "desc" }],
      limit: 5,
    },
    style: { icon: "🕑", color: "#1D4ED8" },
    action: { type: "navigate", to: "/admin/orders" },
  },
};

/**
 * 검증·동결된 prefab spec 맵. 각 값은 widgetSpecSchema 통과를 보장한다.
 * (모듈 로드 시 parse — prefab 정의 오류는 즉시 throw 되어 조기 발견)
 */
export const PREFAB_SPECS: Record<string, WidgetSpec> = Object.fromEntries(
  Object.entries(RAW_PREFABS).map(([key, raw]) => [key, widgetSpecSchema.parse(raw)]),
);

/** preset key → WidgetSpec (없으면 undefined). */
export function getPrefabSpec(key: string): WidgetSpec | undefined {
  return PREFAB_SPECS[key];
}

export const PREFAB_KEYS = Object.keys(PREFAB_SPECS);
