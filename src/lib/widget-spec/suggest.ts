/**
 * 자연어 메시지 → 가장 비슷한 prefab 위젯 추천 (Flowise 준비 전 임시 엔진).
 * 순수 함수 — Prisma/네트워크 의존 없음. PREFAB_SPECS 만 점수화한다.
 * Flowise 연결 후에는 라우트가 이 매처 대신 Flowise 프록시를 쓴다(UI 동일).
 */
import { PREFAB_SPECS, PREFAB_KEYS } from "./presets";
import type { WidgetSpec } from "./schema";

export type WidgetSuggestion = {
  key: string;
  title: string;
  kind: string;
  source: string;
  score: number;
  spec: WidgetSpec;
};

/** prefab 별 한글 키워드 힌트 — 공백 무시 부분일치로 점수화. */
const PREFAB_HINTS: Record<string, string[]> = {
  kpi_monthly_sales: ["매출", "이번달매출", "당월매출", "월매출", "판매액", "매출액"],
  kpi_total_ar: ["미수금", "미수", "외상", "받을돈", "채권"],
  kpi_open_orders: ["진행중주문", "진행주문", "처리중주문", "열린주문", "미완료주문"],
  kpi_active_clients: ["활성거래처", "거래처수", "고객수", "업체수"],
  kpi_low_stock: ["재고임계", "재고부족", "재고알림", "안전재고", "품절임박"],
  kpi_expiring_contracts: ["만료임박계약", "만료계약", "계약만료", "계약갱신"],
  list_top_clients: ["거래처별매출", "매출top", "매출상위", "상위거래처", "top거래처", "거래처순위", "매출순"],
  list_low_stock: ["재고부족품목", "부족품목", "재고부족top", "품절품목"],
  list_ending_contracts: ["만료임박계약목록", "만료계약목록", "계약목록"],
  list_recent_orders: ["최근주문", "최신주문", "최근발주"],
  kpi_daily_sales: ["오늘매출", "당일매출", "금일매출", "일매출"],
  kpi_weekly_sales: ["주간매출", "이번주매출", "주매출", "최근7일", "7일매출"],
  kpi_received: ["수금", "입금", "수금액", "받은돈", "회수"],
};

/** 메시지 정규화 — 소문자 + 공백/구분자 제거(부분일치 안정화). */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s,./·]+/g, "");
}

/**
 * 메시지에 가장 잘 맞는 prefab 추천 top-N.
 * 점수 = 힌트 부분일치(각 +2) + "~별" 차원이면 groupBy prefab(+3) + 제목 토큰 일치(각 +1).
 * 1점 이상만, 동점은 PREFAB 정의 순서.
 */
export function suggestWidgets(message: string, limit = 3): WidgetSuggestion[] {
  const raw = message || "";
  const norm = normalize(raw);
  if (!norm) return [];

  const dimGroup = /(거래처|고객|업체|제품|품목)별/.test(raw);
  const scored: WidgetSuggestion[] = [];

  for (const key of PREFAB_KEYS) {
    const spec = PREFAB_SPECS[key];
    const hints = PREFAB_HINTS[key] || [];
    let score = 0;
    for (const h of hints) if (norm.includes(normalize(h))) score += 2;

    const hasGroupBy = Array.isArray(spec.data.groupBy) && spec.data.groupBy.length > 0;
    if (hasGroupBy && dimGroup) score += 3;

    for (const tok of spec.title.split(/[\s()]+/).filter((t) => t.length >= 2)) {
      if (norm.includes(normalize(tok))) score += 1;
    }

    if (score > 0) {
      scored.push({ key, title: spec.title, kind: spec.kind, source: spec.data.source, score, spec });
    }
  }

  scored.sort(
    (a, b) => b.score - a.score || PREFAB_KEYS.indexOf(a.key) - PREFAB_KEYS.indexOf(b.key),
  );
  return scored.slice(0, Math.max(1, limit));
}
