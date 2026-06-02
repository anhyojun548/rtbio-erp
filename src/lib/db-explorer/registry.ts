/**
 * DB 탐색기 보안 경계 — 화이트리스트 레지스트리.
 * 여기 정의된 테이블/컬럼/편집필드만 API 가 건드린다. 임의 모델/SQL 접근 불가.
 */
export type DbFieldType = "string" | "int" | "boolean" | "datetime";

export type DbTableDef = {
  key: string; // url-safe (예: 'order')
  label: string; // 한글
  model: string; // Prisma accessor (camelCase, prisma[model])
  group: string; // 메뉴 그룹
  pkField: string; // 기본 'id', TenantSetting='key'
  tenantScoped: boolean; // public 스키마 + tenantId 필터
  sensitiveFields: string[];
  searchFields: string[];
  defaultOrderBy: Record<string, "asc" | "desc">;
  editable: boolean;
  editableFields?: Record<string, DbFieldType>;
};

// 읽기 전용 정의 헬퍼 (장황함 축소)
function ro(
  key: string,
  label: string,
  model: string,
  group: string,
  opts: Partial<
    Pick<DbTableDef, "pkField" | "tenantScoped" | "sensitiveFields" | "searchFields" | "defaultOrderBy">
  > = {},
): DbTableDef {
  return {
    key,
    label,
    model,
    group,
    pkField: opts.pkField ?? "id",
    tenantScoped: opts.tenantScoped ?? false,
    sensitiveFields: opts.sensitiveFields ?? [],
    searchFields: opts.searchFields ?? [],
    defaultOrderBy: opts.defaultOrderBy ?? { createdAt: "desc" },
    editable: false,
  };
}

export const DB_TABLES: DbTableDef[] = [
  // 거래처
  ro("client", "거래처", "client", "거래처", { searchFields: ["name", "code"] }),
  ro("clientAddress", "거래처 배송지", "clientAddress", "거래처", {
    searchFields: ["label", "recipientName"],
  }),
  ro("clientDiscount", "거래처 할인율", "clientDiscount", "거래처", { searchFields: ["category"] }),
  ro("clientFixedPrice", "거래처 고정가", "clientFixedPrice", "거래처", {}),
  // 제품/재고
  ro("product", "제품", "product", "제품", { searchFields: ["name", "code"] }),
  ro("productSize", "제품 사이즈/재고", "productSize", "제품", { searchFields: ["sizeCode"] }),
  ro("expiryLot", "유통기한 로트", "expiryLot", "제품", {
    searchFields: ["lotNumber"],
    defaultOrderBy: { receivedAt: "desc" },
  }),
  // 주문/출고
  ro("order", "주문", "order", "주문", {
    searchFields: ["orderNumber"],
    defaultOrderBy: { orderDate: "desc" },
  }),
  ro("orderItem", "주문 품목", "orderItem", "주문", {}),
  ro("shipment", "출고", "shipment", "주문", {}),
  ro("shipmentAssignee", "출고 담당자", "shipmentAssignee", "주문", {
    defaultOrderBy: { assignedAt: "desc" },
  }),
  // 정산
  ro("invoice", "거래명세서", "invoice", "정산", {
    searchFields: ["invoiceNumber"],
    defaultOrderBy: { issueDate: "desc" },
  }),
  ro("invoiceItem", "명세서 품목", "invoiceItem", "정산", { defaultOrderBy: { id: "desc" } }), // createdAt 없음
  ro("payment", "수금", "payment", "정산", { defaultOrderBy: { paidAt: "desc" } }),
  ro("bankTransaction", "은행거래", "bankTransaction", "정산", {}),
  ro("closingLedger", "마감원장", "closingLedger", "정산", { searchFields: ["closingMonth"] }),
  // 영업
  ro("conference", "학회", "conference", "영업", { searchFields: ["name"] }),
  ro("salesContract", "판매계약", "salesContract", "영업", { searchFields: ["title"] }),
  ro("dataUsage", "데이터 사용량", "dataUsage", "영업", { searchFields: ["category"] }),
  // 기타 업무
  ro("udiReport", "UDI 보고", "udiReport", "기타", {}),
  ro("transactionLedger", "매입매출원장(41K)", "transactionLedger", "기타", {
    searchFields: ["clientName", "productName"],
    defaultOrderBy: { txnDate: "desc" },
  }),
  // 직원 (public 스키마, 민감)
  ro("user", "직원", "user", "시스템", {
    tenantScoped: true,
    sensitiveFields: ["password"],
    searchFields: ["name", "email"],
  }),

  // ── 편집 가능 (설정성 4개) ──
  {
    key: "orgOption",
    label: "부서·직급",
    model: "orgOption",
    group: "설정",
    pkField: "id",
    tenantScoped: true,
    sensitiveFields: [],
    searchFields: ["label"],
    defaultOrderBy: { sortOrder: "asc" },
    editable: true,
    editableFields: { label: "string", sortOrder: "int", active: "boolean" },
  },
  {
    key: "kanbanColumn",
    label: "출고 단계",
    model: "kanbanColumn",
    group: "설정",
    pkField: "id",
    tenantScoped: false,
    sensitiveFields: [],
    searchFields: ["label"],
    defaultOrderBy: { sortOrder: "asc" },
    editable: true,
    editableFields: { label: "string", sortOrder: "int", color: "string", isTerminal: "boolean" },
  },
  {
    key: "tenantSetting",
    label: "테넌트 설정",
    model: "tenantSetting",
    group: "설정",
    pkField: "key",
    tenantScoped: false,
    sensitiveFields: [],
    searchFields: ["key"],
    defaultOrderBy: { key: "asc" },
    editable: true,
    editableFields: { value: "string", description: "string" },
  },
  {
    key: "notice",
    label: "공지",
    model: "notice",
    group: "설정",
    pkField: "id",
    tenantScoped: false,
    sensitiveFields: [],
    searchFields: ["title"],
    defaultOrderBy: { createdAt: "desc" },
    editable: true,
    editableFields: { title: "string", body: "string", pinned: "boolean", expiresAt: "datetime" },
  },
];

export const EDITABLE_KEYS = DB_TABLES.filter((t) => t.editable).map((t) => t.key);

export function getTableDef(key: string): DbTableDef | undefined {
  return DB_TABLES.find((t) => t.key === key);
}
