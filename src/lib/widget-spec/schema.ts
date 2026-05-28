/**
 * Widget Spec — LLM-native 대시보드 위젯 정의 표준 (v1.0)
 *
 * 설계 목표:
 *  - **self-describing**: 모든 필드가 명시적 — LLM 이 schema 만 보고 spec 작성 가능
 *  - **composable**: source + filter + aggregate 조합으로 무한 위젯
 *  - **safe**: source 는 whitelist, read-only 만. 임의 SQL 불가
 *  - **Flowise tool 친화적**: 이 Zod schema 를 JSON Schema 로 추출해 Flowise agent 의 tool 정의에 사용
 *
 * 데이터 흐름:
 *  Flowise(LLM) → POST /api/dashboard/widgets (이 spec JSON)
 *    → widgetSpecSchema 검증 → executeWidgetSpec(spec) dry-run → DB 저장
 *    → 대시보드 로드 시 executeWidgetSpec(spec) 실시간 query → 렌더
 */
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// 1. 조회 가능 데이터 소스 (whitelist — read-only)
// ─────────────────────────────────────────────────────────────
export const WIDGET_SOURCES = [
  "invoice", // 거래명세서
  "order", // 발주
  "payment", // 수금
  "ledger", // 마감원장 (ClosingLedger)
  "client", // 거래처
  "product", // 제품
  "productSize", // 제품 사이즈 (재고)
  "transaction", // 매입매출 거래원장 (TransactionLedger, 41K)
  "shipment", // 출고
  "conference", // 학회
  "expiry", // 유통기한 로트
  "dataUsage", // 데이터 사용량
] as const;
export type WidgetSource = (typeof WIDGET_SOURCES)[number];

// ─────────────────────────────────────────────────────────────
// 2. filter operator (Prisma where 절과 1:1)
// ─────────────────────────────────────────────────────────────
export const FILTER_OPERATORS = [
  "eq", // =
  "ne", // !=
  "gt", // >
  "gte", // >=
  "lt", // <
  "lte", // <=
  "in", // IN [...]
  "notIn", // NOT IN [...]
  "contains", // LIKE %...% (대소문자 무시)
  "startsWith",
  "between", // [min, max]
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

/**
 * 템플릿 변수 — LLM 이 "이번 달", "지난 30일" 같은 표현을 그대로 표기.
 * executeWidgetSpec 가 런타임에 실제 날짜로 치환.
 *
 * 지원 형식:
 *   {{now}}                        — 현재 시각
 *   {{now.startOfMonth}}           — 이번 달 1일 00:00
 *   {{now.endOfMonth}}             — 이번 달 말일 23:59:59
 *   {{now.startOfYear}}
 *   {{now.minus(30,'day')}}        — 30일 전
 *   {{now.minus(1,'month')}}       — 1개월 전
 *   {{now.plus(1,'month')}}
 *   {{today}}                      — 오늘 'YYYY-MM-DD'
 *   {{thisMonth}}                  — 'YYYY-MM'
 */
const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number()])), // in / between
]);

// 단일 컬럼의 operator 맵 — { ">=": "{{now.startOfMonth}}", "<": "..." }
const columnFilterSchema = z
  .record(z.string(), filterValueSchema)
  .describe(
    "컬럼별 operator 맵. 예: { \"gte\": \"{{now.startOfMonth}}\", \"in\": [\"ISSUED\",\"SENT\"] }",
  );

// filter 는 컬럼명 → operator맵. nested relation 은 'client.createdAt' 처럼 dot 표기.
export const widgetFilterSchema = z
  .record(z.string(), columnFilterSchema)
  .describe(
    "필드명 → operator 맵. nested relation 은 dot 표기(client.createdAt). 예: { \"status\": { \"in\": [\"ISSUED\",\"SENT\"] }, \"issueDate\": { \"gte\": \"{{now.startOfMonth}}\" } }",
  );

// ─────────────────────────────────────────────────────────────
// 3. aggregate
// ─────────────────────────────────────────────────────────────
export const AGGREGATE_TYPES = ["sum", "count", "avg", "min", "max", "countDistinct"] as const;
export type AggregateType = (typeof AGGREGATE_TYPES)[number];

export const widgetAggregateSchema = z
  .object({
    type: z.enum(AGGREGATE_TYPES).describe("집계 함수"),
    field: z
      .string()
      .nullable()
      .optional()
      .describe("집계 대상 필드. count 는 null 가능(행 수)."),
  })
  .describe("집계 정의. KPI/차트 값 계산.");

// ─────────────────────────────────────────────────────────────
// 4. data 섹션 (위젯의 핵심)
// ─────────────────────────────────────────────────────────────
export const widgetDataSchema = z
  .object({
    source: z.enum(WIDGET_SOURCES).describe("데이터 소스 (whitelist, read-only)"),
    filter: widgetFilterSchema.optional().describe("where 조건. 생략 시 전체."),
    aggregate: widgetAggregateSchema.optional().describe("집계. groupBy 와 함께 차트 계열 생성."),
    groupBy: z
      .array(z.string())
      .nullable()
      .optional()
      .describe("그룹핑 필드. KPI 는 null, bar/pie/line 은 ['status'] 등."),
    orderBy: z
      .array(
        z.object({
          field: z.string(),
          dir: z.enum(["asc", "desc"]).default("desc"),
        }),
      )
      .optional()
      .describe("정렬. list/top-N 위젯용."),
    limit: z.number().int().positive().max(100).nullable().optional().describe("최대 행 수 (≤100)."),
  })
  .describe("데이터 조회 정의 — source/filter/aggregate/groupBy/orderBy/limit");

// ─────────────────────────────────────────────────────────────
// 5. 시각화 종류
// ─────────────────────────────────────────────────────────────
export const WIDGET_KINDS = [
  "kpi", // 단일 숫자 (+ 비교)
  "bar", // 세로 막대
  "hbar", // 가로 막대
  "line", // 선
  "pie", // 파이
  "donut", // 도넛
  "table", // 테이블
  "gauge", // 게이지 (목표 달성률)
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

// ─────────────────────────────────────────────────────────────
// 6. 비교 (전월 대비 등)
// ─────────────────────────────────────────────────────────────
export const widgetComparisonSchema = z
  .object({
    type: z
      .enum(["previousPeriod", "previousYear", "target", "none"])
      .describe("비교 기준"),
    label: z.string().optional(),
    targetValue: z.number().optional().describe("type=target 일 때 목표값"),
    format: z.enum(["delta-absolute", "delta-percent"]).default("delta-percent"),
  })
  .describe("KPI 비교 (▲▼). 전월/전년/목표 대비.");

// ─────────────────────────────────────────────────────────────
// 7. 포맷 / 스타일 / 액션 / 권한
// ─────────────────────────────────────────────────────────────
export const widgetFormatSchema = z
  .object({
    value: z
      .object({
        type: z.enum(["number", "currency", "percent"]).default("number"),
        locale: z.string().default("ko-KR"),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
        compact: z.boolean().default(false).describe("큰 수 축약(₩1.2억)"),
        decimals: z.number().int().min(0).max(4).default(0),
      })
      .optional(),
    legend: z.enum(["top", "right", "bottom", "none"]).default("right").optional(),
  })
  .describe("표시 포맷");

export const widgetStyleSchema = z
  .object({
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe("주 색상 #RRGGBB"),
    icon: z.string().optional().describe("이모지 또는 아이콘 키"),
    thresholds: z
      .array(
        z.object({
          value: z.number(),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          label: z.string().optional(),
        }),
      )
      .optional()
      .describe("임계치별 색상 (gauge/kpi)"),
  })
  .describe("시각 스타일");

export const widgetActionSchema = z
  .object({
    type: z.enum(["navigate", "none"]).default("none"),
    to: z.string().optional().describe("navigate 시 이동 경로 (예: /admin/clients?filter=new)"),
  })
  .describe("클릭 시 동작");

export const widgetPermissionSchema = z
  .object({
    roles: z
      .array(z.enum(["TENANT_OWNER", "ADMIN", "EXEC", "QC", "CLIENT", "SUPER_ADMIN"]))
      .describe("이 위젯을 볼 수 있는 역할"),
    rowLevel: z
      .enum(["none", "ownClientOnly"])
      .default("none")
      .optional()
      .describe("ownClientOnly = CLIENT 역할은 자기 거래처 데이터만"),
  })
  .describe("접근 권한");

// ─────────────────────────────────────────────────────────────
// 8. 최상위 WidgetSpec
// ─────────────────────────────────────────────────────────────
export const widgetSpecSchema = z
  .object({
    version: z.literal("1.0").default("1.0"),
    title: z.string().min(1).max(100).describe("위젯 제목"),
    subtitle: z.string().max(200).optional(),
    kind: z.enum(WIDGET_KINDS).describe("시각화 종류"),
    layout: z
      .object({
        w: z.number().int().min(1).max(12).default(3).describe("grid cols 1-12"),
        h: z.number().int().min(1).max(12).default(2),
        x: z.number().int().min(0).max(11).optional(),
        y: z.number().int().min(0).optional(),
      })
      .default({ w: 3, h: 2 }),
    data: widgetDataSchema,
    comparison: widgetComparisonSchema.optional(),
    format: widgetFormatSchema.optional(),
    style: widgetStyleSchema.optional(),
    action: widgetActionSchema.optional(),
    permissions: widgetPermissionSchema.optional(),
    llm: z
      .object({
        createdBy: z.string().optional().describe("생성 모델 (예: flowise/claude-3.7)"),
        userPrompt: z.string().optional().describe("원본 자연어 요청"),
        confidence: z.number().min(0).max(1).optional(),
      })
      .optional()
      .describe("LLM 생성 메타데이터 (선택)"),
  })
  .describe(
    "RTBIO 대시보드 위젯 정의 v1.0. LLM(Flowise) 이 자연어 요청을 이 JSON 으로 변환해 POST /api/dashboard/widgets 로 저장.",
  );

export type WidgetSpec = z.infer<typeof widgetSpecSchema>;

// ─────────────────────────────────────────────────────────────
// 9. 검증 헬퍼 — LLM 교정 힌트 포함
// ─────────────────────────────────────────────────────────────
export type SpecValidation =
  | { ok: true; spec: WidgetSpec }
  | { ok: false; errors: Array<{ path: string; message: string; hint?: string }> };

export function validateWidgetSpec(input: unknown): SpecValidation {
  const parsed = widgetSpecSchema.safeParse(input);
  if (parsed.success) return { ok: true, spec: parsed.data };

  // Flowise/LLM 이 교정하기 좋은 형태로 에러 변환
  const errors = parsed.error.issues.map((iss) => {
    const path = iss.path.join(".");
    let hint: string | undefined;
    // 자주 틀리는 케이스에 교정 힌트
    if (path === "kind") hint = `kind 는 다음 중 하나: ${WIDGET_KINDS.join(", ")}`;
    else if (path === "data.source") hint = `source 는 다음 중 하나: ${WIDGET_SOURCES.join(", ")}`;
    else if (path.startsWith("data.aggregate.type")) hint = `aggregate.type 은: ${AGGREGATE_TYPES.join(", ")}`;
    else if (path.startsWith("permissions.roles")) hint = "roles 는 TENANT_OWNER/ADMIN/EXEC/QC/CLIENT/SUPER_ADMIN 중 선택";
    return { path: path || "(root)", message: iss.message, hint };
  });
  return { ok: false, errors };
}
