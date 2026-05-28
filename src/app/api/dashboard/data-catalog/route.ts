/**
 * GET /api/dashboard/data-catalog
 *
 * Flowise(LLM) agent 의 tool — "어떤 데이터·필드·집계가 가능한가" 를 알려준다.
 * LLM 은 이 카탈로그를 먼저 조회해서 올바른 WidgetSpec.data 를 작성한다.
 *
 * 반환: 각 source 별 조회 가능 필드 + 타입 + 설명 + 집계 가능 여부.
 * read-only — 실제 데이터는 노출하지 않고 "스키마 메타데이터" 만.
 *
 * RBAC: 인증된 사용자 (위젯 만들 수 있는 역할)
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { WIDGET_SOURCES, FILTER_OPERATORS, AGGREGATE_TYPES } from "@/lib/widget-spec/schema";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

// source 별 조회 가능 필드 카탈로그 (LLM context)
const DATA_CATALOG = {
  invoice: {
    label: "거래명세서",
    fields: {
      status: { type: "enum", values: ["DRAFT", "ISSUED", "SENT", "CANCELLED"], desc: "발행 상태" },
      totalAmount: { type: "decimal", agg: true, desc: "공급가+VAT 합계" },
      supplyAmount: { type: "decimal", agg: true, desc: "공급가액" },
      vatAmount: { type: "decimal", agg: true, desc: "부가세" },
      issueDate: { type: "date", desc: "발행일" },
      sentAt: { type: "date", desc: "발송일" },
      "client.name": { type: "string", desc: "거래처명 (nested)" },
      "client.type": { type: "enum", values: ["HOSPITAL", "AGENCY", "OTHER"], desc: "거래처 유형" },
    },
    note: "매출 집계는 보통 status in [ISSUED,SENT] 필터 + sum:totalAmount",
  },
  order: {
    label: "발주",
    fields: {
      status: { type: "enum", values: ["DRAFT", "SUBMITTED", "CONFIRMED", "SHIPPING", "COMPLETED", "CANCELLED", "HELD", "REJECTED"], desc: "주문 상태" },
      orderDate: { type: "date", desc: "발주일" },
      billingMonth: { type: "string", desc: "정산월 YYYY-MM" },
      "client.name": { type: "string", desc: "거래처명" },
    },
    note: "진행 중 주문 = status in [DRAFT,SUBMITTED,CONFIRMED,SHIPPING]. count 집계.",
  },
  payment: {
    label: "수금",
    fields: {
      status: { type: "enum", values: ["PENDING", "PARTIAL", "PAID", "OVERDUE"], desc: "수금 상태" },
      amount: { type: "decimal", agg: true, desc: "입금액" },
      paidAt: { type: "date", desc: "입금일" },
    },
    note: "실수금 = status in [PARTIAL,PAID] + sum:amount",
  },
  ledger: {
    label: "마감원장 (ClosingLedger)",
    fields: {
      closingMonth: { type: "string", desc: "마감월 YYYY-MM" },
      carryOver: { type: "decimal", agg: true, desc: "전월 이월" },
      monthlySales: { type: "decimal", agg: true, desc: "당월 매출" },
      received: { type: "decimal", agg: true, desc: "당월 수금" },
      balance: { type: "decimal", agg: true, desc: "미수금 잔액" },
    },
    note: "미수금 합계 = closingMonth={{thisMonth}} + sum:balance",
  },
  client: {
    label: "거래처",
    fields: {
      type: { type: "enum", values: ["HOSPITAL", "AGENCY", "OTHER"], desc: "유형" },
      active: { type: "boolean", desc: "활성 여부" },
      createdAt: { type: "date", desc: "등록일" },
    },
    note: "활성 거래처 수 = active=true + count. 신규 = createdAt gte {{now.minus(30,'day')}}",
  },
  product: {
    label: "제품",
    fields: {
      category: { type: "string", desc: "카테고리(브랜드)" },
      active: { type: "boolean" },
      basePrice: { type: "decimal", agg: true, desc: "기본가" },
    },
  },
  productSize: {
    label: "제품 사이즈 (재고)",
    fields: {
      sizeCode: { type: "string", desc: "사이즈" },
      physicalStock: { type: "int", agg: true, desc: "창고 실재고" },
      availableStock: { type: "int", agg: true, desc: "가용재고(예약 제외)" },
      reorderPoint: { type: "int", desc: "재주문점" },
    },
    note: "재고 부족 = availableStock lte reorderPoint. 단순 임계 비교는 앱-레벨 분류 필요(classifyStock).",
  },
  transaction: {
    label: "매입매출 거래원장 (41K)",
    fields: {
      kind: { type: "string", desc: "거래 종류(매출/매입)" },
      clientCode: { type: "string" },
      clientName: { type: "string" },
      productCode: { type: "string" },
      amount: { type: "decimal", agg: true },
      txnDate: { type: "date" },
    },
    note: "대량 데이터. 반드시 날짜/거래처 필터 + limit 권장.",
  },
  shipment: {
    label: "출고",
    fields: {
      completedAt: { type: "date", desc: "출고완료일" },
      "currentStage.label": { type: "string", desc: "현재 단계" },
    },
  },
  conference: {
    label: "학회",
    fields: {
      startDate: { type: "date" },
      endDate: { type: "date" },
      name: { type: "string" },
    },
  },
  expiry: {
    label: "유통기한 로트",
    fields: {
      expiryDate: { type: "date", desc: "유통기한" },
      remainingQty: { type: "int", agg: true, desc: "잔여 수량" },
    },
  },
  dataUsage: {
    label: "데이터 사용량",
    fields: {
      month: { type: "string", desc: "YYYY-MM" },
      category: { type: "string" },
      amount: { type: "decimal", agg: true },
    },
  },
} as const;

const TEMPLATE_VARS = [
  "{{now}}", "{{now.startOfMonth}}", "{{now.endOfMonth}}", "{{now.startOfYear}}",
  "{{now.minus(N,'day')}}", "{{now.minus(N,'month')}}", "{{now.plus(N,'month')}}",
  "{{now.startOfMonth.plus(1,'month')}}", "{{today}}", "{{thisMonth}}",
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  return Response.json({
    ok: true,
    version: "1.0",
    description:
      "RTBIO 대시보드 위젯 데이터 카탈로그. WidgetSpec.data 작성 시 이 source/field 만 사용 가능. operator/aggregate/templateVars 참고.",
    sources: WIDGET_SOURCES,
    catalog: DATA_CATALOG,
    operators: FILTER_OPERATORS,
    aggregates: AGGREGATE_TYPES,
    templateVars: TEMPLATE_VARS,
    kinds: ["kpi", "bar", "hbar", "line", "pie", "donut", "table", "gauge"],
  });
}
