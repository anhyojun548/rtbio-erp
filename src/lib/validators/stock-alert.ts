/**
 * 재고 임계치 알럼 도메인 모델 — Phase 3E-3 (R14).
 *
 * 사이즈 단위 재고 상태를 3단계로 분류한다.
 *
 *   OUT        : physicalStock == 0                         — 최우선, 긴급
 *   LOW        : 0 < physicalStock ≤ reorderPoint           — 재주문 필요
 *   OK         : reorderPoint == null OR physicalStock > reorderPoint
 *
 * `deficit` = max(reorderPoint - physicalStock, 0) — "몇 개 부족한가".
 * `daysOfCover` = 월평균 출고가 있으면 physicalStock / (avg/30) — UI 힌트 용.
 *   Phase 3E-3 범위에서는 월평균 계산은 생략하고 deficit 기반 정렬만 제공.
 *
 * 순수 함수만 둔다 — 테스트 용이성 + "use server" 제약 회피.
 */

export type StockLevel = "OUT" | "LOW" | "OK";

export type StockAlertInput = {
  physicalStock: number;
  availableStock: number;
  reorderPoint: number | null;
};

export type StockAlert = {
  level: StockLevel;
  deficit: number; // reorderPoint - physicalStock (OK 면 0)
};

/**
 * 재고 상태를 분류한다.
 *
 * 주의:
 *   - reorderPoint == null 이면 항상 OK (알럼 대상에서 제외).
 *   - reorderPoint == 0 일 때: physicalStock == 0 이면 OUT, 아니면 OK (≤0 분기).
 */
export function classifyStock(input: StockAlertInput): StockAlert {
  const { physicalStock, reorderPoint } = input;
  if (physicalStock <= 0) {
    const deficit = reorderPoint != null && reorderPoint > 0 ? reorderPoint : 0;
    return { level: "OUT", deficit };
  }
  if (reorderPoint == null || reorderPoint <= 0)
    return { level: "OK", deficit: 0 };
  if (physicalStock <= reorderPoint)
    return { level: "LOW", deficit: reorderPoint - physicalStock };
  return { level: "OK", deficit: 0 };
}

/** UI 정렬용 — OUT 이 제일 위, 같은 level 내에서는 deficit desc. */
export function compareStockUrgency(
  a: StockAlert,
  b: StockAlert,
): number {
  const rank: Record<StockLevel, number> = { OUT: 0, LOW: 1, OK: 2 };
  if (rank[a.level] !== rank[b.level]) return rank[a.level] - rank[b.level];
  return b.deficit - a.deficit;
}

/** level 한글 라벨 (UI 표기용). */
export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  OUT: "품절",
  LOW: "부족",
  OK: "정상",
};
