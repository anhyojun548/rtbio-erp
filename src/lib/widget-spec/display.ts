/** ID 필드 → 참조 모델·라벨필드 (groupBy 라벨 해석용). prisma 모델 키 사용. */
export const LABEL_RESOLVERS: Record<string, { model: string; labelField: string }> = {
  clientId: { model: "client", labelField: "name" },
  productId: { model: "product", labelField: "name" },
};

/**
 * groupBy 별칭 보정 — LLM(빌더)이 "거래처별"을 자연스럽게 `clientName`/`client.name` 로 쓰는데
 * 대부분 소스의 Prisma groupBy 는 스칼라 FK(`clientId`)만 받는다. 흔한 표시필드 별칭을 FK 로 정규화.
 * (라벨은 LABEL_RESOLVERS 가 FK → 이름으로 해석하므로 차트엔 거래처명이 표시됨.)
 */
const GROUPBY_ALIASES: Record<string, string> = {
  clientname: "clientId",
  "client.name": "clientId",
  client: "clientId",
  productname: "productId",
  "product.name": "productId",
  product: "productId",
};

/**
 * 소스 인지 보정. `scalarFields`(해당 소스의 실제 스칼라 필드 집합)를 주면:
 *  1) 이미 실제 스칼라인 필드는 그대로 둔다 — 예: `TransactionLedger.clientName`(비정규화 문자열)는 보정 금지.
 *  2) 별칭이고 그 FK 가 실제 스칼라일 때만 FK 로 보정 — 예: `Invoice.clientName`→`clientId`.
 *  3) 어느 쪽도 아니면 원본 유지(Prisma 가 명확한 에러를 내도록).
 * `scalarFields` 미제공 시(레거시/단위테스트)는 무조건 별칭 보정(구버전 동작).
 */
export function normalizeGroupBy(
  fields: string[],
  scalarFields?: ReadonlySet<string>,
): string[] {
  return fields.map((f) => {
    if (scalarFields?.has(f)) return f; // 실제 스칼라 → 보정하지 않음
    const alias = GROUPBY_ALIASES[f.toLowerCase()];
    if (!alias) return f;
    if (!scalarFields || scalarFields.has(alias)) return alias;
    return f;
  });
}

/** 소스별 table 표시 컬럼(순서·한글 라벨; 관계는 dot). 미정의 소스는 폴백(원시 6컬럼). */
export const DISPLAY_COLUMNS: Record<string, Array<{ field: string; label: string }>> = {
  order: [
    { field: "orderNumber", label: "주문번호" }, { field: "client.name", label: "거래처" },
    { field: "status", label: "상태" }, { field: "orderDate", label: "주문일" },
  ],
  invoice: [
    { field: "invoiceNumber", label: "번호" }, { field: "client.name", label: "거래처" },
    { field: "status", label: "상태" }, { field: "totalAmount", label: "합계" },
    { field: "issueDate", label: "발행일" },
  ],
  payment: [
    { field: "client.name", label: "거래처" }, { field: "amount", label: "입금액" },
    { field: "status", label: "상태" }, { field: "paidAt", label: "입금일" },
  ],
  salesContract: [
    { field: "title", label: "계약명" }, { field: "client.name", label: "거래처" },
    { field: "startDate", label: "시작일" }, { field: "endDate", label: "종료일" },
    { field: "signed", label: "서명" },
  ],
  productSize: [
    { field: "product.name", label: "제품" }, { field: "sizeCode", label: "사이즈" },
    { field: "availableStock", label: "가용재고" }, { field: "reorderPoint", label: "안전재고" },
  ],
};

export function getDisplayColumns(source: string) {
  return DISPLAY_COLUMNS[source] ?? null;
}

/** dot 경로로 중첩 값 추출 (관계 컬럼). */
export function getValueByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

/** displayColumns 의 dot 컬럼들 → Prisma include (예: client.name → {client:{select:{name:true}}}). */
export function buildIncludeForColumns(
  cols: Array<{ field: string }>,
): Record<string, unknown> | undefined {
  const include: Record<string, { select: Record<string, true> }> = {};
  for (const { field } of cols) {
    const parts = field.split(".");
    if (parts.length === 2) {
      const [rel, sub] = parts as [string, string];
      include[rel] = include[rel] ?? { select: {} };
      include[rel].select[sub] = true;
    }
  }
  return Object.keys(include).length ? include : undefined;
}
