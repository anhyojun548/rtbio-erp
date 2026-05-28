/**
 * GET /api/dashboard/widget-schema
 *
 * Flowise(LLM) agent 의 tool — WidgetSpec JSON 형식 + few-shot examples 제공.
 * LLM 은 이 형식을 보고 사용자 자연어 요청을 WidgetSpec JSON 으로 작성한다.
 *
 * data-catalog (어떤 데이터) + widget-schema (어떤 형식) 두 tool 을 조합하면
 * LLM 이 올바른 spec 을 생성할 수 있다.
 *
 * RBAC: 인증된 사용자
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  WIDGET_KINDS,
  WIDGET_SOURCES,
  FILTER_OPERATORS,
  AGGREGATE_TYPES,
} from "@/lib/widget-spec/schema";
import { PREFAB_SPECS } from "@/lib/widget-spec/presets";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  return Response.json({
    ok: true,
    version: "1.0",
    description:
      "RTBIO 대시보드 위젯 spec 형식. 사용자 자연어 요청을 이 JSON 구조로 변환해 POST /api/dashboard/widgets 로 저장. 데이터 필드는 /api/dashboard/data-catalog 참고.",
    // 최상위 구조 가이드
    structure: {
      version: "'1.0' 고정",
      title: "위젯 제목 (1~100자, 필수)",
      subtitle: "부제목 (선택)",
      kind: `시각화 종류 — ${WIDGET_KINDS.join(" | ")}`,
      layout: "{ w(1~12), h(1~12), x?, y? } — grid 위치/크기",
      data: {
        source: `데이터 소스 — ${WIDGET_SOURCES.join(" | ")}`,
        filter: "{ 필드명: { operator: 값 } } — nested 는 dot 표기(client.createdAt)",
        aggregate: `{ type, field } — type: ${AGGREGATE_TYPES.join("/")}`,
        groupBy: "['필드'] — KPI 는 null, bar/pie 는 그룹 필드",
        orderBy: "[{ field, dir }]",
        limit: "≤100",
      },
      comparison: "{ type: previousPeriod|previousYear|target|none, label, format } — KPI 비교 ▲▼",
      format: "{ value: { type: number|currency|percent, prefix, suffix, compact, decimals }, legend }",
      style: "{ color: #RRGGBB, icon: 이모지, thresholds: [{value,color,label}] }",
      action: "{ type: navigate|none, to: 경로 }",
      permissions: "{ roles: [...], rowLevel: none|ownClientOnly }",
    },
    operators: FILTER_OPERATORS,
    aggregates: AGGREGATE_TYPES,
    kinds: WIDGET_KINDS,
    // few-shot examples — 검증된 10개 prefab
    examples: PREFAB_SPECS,
    tips: [
      "매출 위젯은 source=invoice, filter.status in [ISSUED,SENT], aggregate sum:totalAmount",
      "이번 달 범위는 filter 에 { gte: '{{now.startOfMonth}}', lt: '{{now.startOfMonth.plus(1,month)}}' }",
      "Top N 거래처는 groupBy + orderBy desc + limit",
      "KPI 는 groupBy=null. bar/pie 는 groupBy 필수.",
      "CLIENT 거래처 포털 위젯이면 permissions.rowLevel='ownClientOnly' 로 자기 데이터만.",
    ],
  });
}
