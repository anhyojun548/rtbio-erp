/**
 * Widget Spec 실행 엔진 (v1.0)
 *
 * `executeWidgetSpec(spec, ctx)` — WidgetSpec(JSON) 을 받아 Prisma 로 실제 데이터를
 * 조회·집계해 `WidgetResult` 로 반환한다.
 *
 * 안전 원칙:
 *  - source 는 WIDGET_SOURCES whitelist 안에서만 허용 (벗어나면 throw)
 *  - **Prisma delegate 만** 사용 — `$queryRaw` 등 raw SQL 절대 금지
 *  - rowLevel='ownClientOnly' + role='CLIENT' → where 에 clientId 강제 주입
 *
 * 흐름:
 *  spec.data → (템플릿 해석) → (filter→where) → 분기
 *    · groupBy 있음              → prisma.X.groupBy(...)   → series (chart)
 *    · groupBy 없음 + aggregate  → prisma.X.aggregate(...) → value  (kpi)
 *    · aggregate 없음            → prisma.X.findMany(...)  → rows   (table/list)
 *  + comparison(previousPeriod/previousYear) → 동일 filter 의 날짜창을 이동해 재조회
 */
import { prisma } from "@/lib/prisma";
import {
  WIDGET_SOURCES,
  type AggregateType,
  type WidgetKind,
  type WidgetSource,
  type WidgetSpec,
} from "./schema";
import {
  LABEL_RESOLVERS,
  getDisplayColumns,
  getValueByPath,
  buildIncludeForColumns,
  normalizeGroupBy,
} from "./display";

// ─────────────────────────────────────────────────────────────
// 0. 실행 컨텍스트 / 결과 타입
// ─────────────────────────────────────────────────────────────
export type ExecuteContext = {
  now: Date;
  userId: string;
  role: string;
  clientId?: string;
};

export type WidgetSeriesPoint = { label: string; value: number };

export type WidgetComparison = {
  current: number;
  previous: number;
  /** (current-previous)/previous * 100. previous=0 이면 null (분모 0). */
  deltaPercent: number | null;
};

export type WidgetResult = {
  kind: WidgetKind;
  /** KPI 단일 값 (aggregate, groupBy 없음) */
  value?: number;
  /** chart 계열 (groupBy 있음) */
  series?: WidgetSeriesPoint[];
  /** table/list 행 (aggregate 없음) */
  rows?: Record<string, unknown>[];
  /** KPI 전기간 대비 */
  comparison?: WidgetComparison;
};

// ─────────────────────────────────────────────────────────────
// 1. source → Prisma delegate 매핑 (whitelist)
// ─────────────────────────────────────────────────────────────
/**
 * Prisma delegate 는 모델마다 메서드 시그니처가 제각각이라
 * 정적으로 union 하기 어렵다. whitelist 통과가 보장되므로
 * 최소 표면(any) 으로 좁혀 사용한다. (raw SQL 은 일절 쓰지 않음)
 */
type AnyDelegate = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany: (args: any) => Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aggregate: (args: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupBy: (args: any) => Promise<any[]>;
};

function delegateFor(source: WidgetSource): AnyDelegate {
  if (!WIDGET_SOURCES.includes(source)) {
    throw new Error(`허용되지 않은 위젯 소스입니다: ${String(source)}`);
  }
  // schema.prisma 실제 모델명에 맞춘 매핑
  switch (source) {
    case "invoice":
      return prisma.invoice as unknown as AnyDelegate;
    case "order":
      return prisma.order as unknown as AnyDelegate;
    case "payment":
      return prisma.payment as unknown as AnyDelegate;
    case "ledger":
      return prisma.closingLedger as unknown as AnyDelegate;
    case "client":
      return prisma.client as unknown as AnyDelegate;
    case "product":
      return prisma.product as unknown as AnyDelegate;
    case "productSize":
      return prisma.productSize as unknown as AnyDelegate;
    case "transaction":
      return prisma.transactionLedger as unknown as AnyDelegate;
    case "shipment":
      return prisma.shipment as unknown as AnyDelegate;
    case "conference":
      return prisma.conference as unknown as AnyDelegate;
    case "salesContract":
      return prisma.salesContract as unknown as AnyDelegate;
    case "expiry":
      return prisma.expiryLot as unknown as AnyDelegate;
    case "dataUsage":
      return prisma.dataUsage as unknown as AnyDelegate;
    default: {
      // 모든 케이스 소진 — 도달 불가
      const _exhaustive: never = source;
      throw new Error(`허용되지 않은 위젯 소스입니다: ${String(_exhaustive)}`);
    }
  }
}

/**
 * rowLevel='ownClientOnly' 일 때 clientId 컬럼이 그 소스에 실제로 존재하는지.
 * (대부분의 거래 데이터에는 있으나 product/productSize 등에는 없음)
 */
const SOURCES_WITH_CLIENT_ID: ReadonlySet<WidgetSource> = new Set<WidgetSource>([
  "invoice",
  "order",
  "payment",
  "ledger",
  "client", // client 자신은 id 로 필터 (아래 특수 처리)
  "salesContract", // 판매계약 (clientId 보유 → CLIENT 격리)
]);

// ─────────────────────────────────────────────────────────────
// 2. 템플릿 변수 해석
//    {{now}} {{now.startOfMonth}} {{now.endOfMonth}} {{now.startOfYear}}
//    {{now.minus(30,'day')}} {{now.plus(1,'month')}}
//    {{now.startOfMonth.plus(1,'month')}}  (체이닝 1단계)
//    {{today}} → 'YYYY-MM-DD'   {{thisMonth}} → 'YYYY-MM'
// ─────────────────────────────────────────────────────────────
const TEMPLATE_RE = /^\{\{\s*(.+?)\s*\}\}$/;

type DateUnit = "day" | "week" | "month" | "year";

function addUnit(d: Date, amount: number, unit: DateUnit): Date {
  const r = new Date(d);
  switch (unit) {
    case "day":
      r.setDate(r.getDate() + amount);
      break;
    case "week":
      r.setDate(r.getDate() + amount * 7);
      break;
    case "month":
      r.setMonth(r.getMonth() + amount);
      break;
    case "year":
      r.setFullYear(r.getFullYear() + amount);
      break;
  }
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date): Date {
  // 다음 달 1일 - 1ms
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0 - 1);
}
function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function ym(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** "minus(30,'day')" / "plus(1,'month')" 토큰 1개를 base Date 에 적용. */
function applyOp(base: Date, op: string): Date {
  const m = op.match(/^(minus|plus)\(\s*(\d+)\s*,\s*['"](day|week|month|year)['"]\s*\)$/);
  if (!m) throw new Error(`템플릿 연산을 해석할 수 없습니다: ${op}`);
  const sign = m[1] === "minus" ? -1 : 1;
  const amount = Number.parseInt(m[2]!, 10) * sign;
  const unit = m[3] as DateUnit;
  return addUnit(base, amount, unit);
}

/**
 * 내부 표현식(중괄호 제거 후)을 Date | string 으로 해석.
 * 점(.)으로 토큰을 나눠 좌→우 순차 적용. minus/plus 안의 점은 보호.
 */
function resolveExpression(expr: string, now: Date): Date | string {
  // 최상위 토큰 분리: 괄호 밖의 '.' 에서만 split
  const tokens: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of expr) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "." && depth === 0) {
      tokens.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);

  const head = tokens[0];
  // 문자열 반환형 변수 (단독 사용만 허용)
  if (head === "today") return ymd(now);
  if (head === "thisMonth") return ym(now);
  if (head !== "now") {
    throw new Error(`알 수 없는 템플릿 변수입니다: ${head}`);
  }

  let d = new Date(now);
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === "startOfMonth") d = startOfMonth(d);
    else if (t === "endOfMonth") d = endOfMonth(d);
    else if (t === "startOfYear") d = startOfYear(d);
    else if (t === "startOfDay") d = startOfDay(d);
    else if (t.startsWith("minus(") || t.startsWith("plus(")) d = applyOp(d, t);
    else throw new Error(`알 수 없는 템플릿 연산입니다: ${t}`);
  }
  return d;
}

/** 단일 filter 값 해석 — 템플릿 문자열이면 치환, 배열이면 원소별 재귀. */
export function resolveTemplate(value: unknown, now: Date): unknown {
  if (typeof value === "string") {
    const m = value.match(TEMPLATE_RE);
    if (!m) return value;
    return resolveExpression(m[1]!, now);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplate(v, now));
  }
  return value;
}

// ─────────────────────────────────────────────────────────────
// 3. filter → Prisma where
// ─────────────────────────────────────────────────────────────
const OP_MAP: Record<string, string> = {
  eq: "equals",
  ne: "not",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  in: "in",
  notIn: "notIn",
  contains: "contains",
  startsWith: "startsWith",
  // between 은 특수 처리 (gte/lte 로 분해)
};

type WhereNode = Record<string, unknown>;

/** dot 표기 경로(['client','createdAt'])에 leaf 조건을 nested 로 set. */
function setNested(root: WhereNode, path: string[], leaf: unknown): void {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    if (typeof node[key] !== "object" || node[key] === null) {
      node[key] = {};
    }
    node = node[key] as WhereNode;
  }
  node[path[path.length - 1]!] = leaf;
}

/** 한 컬럼의 operator 맵 → Prisma leaf 조건 객체. */
function buildLeaf(opMap: Record<string, unknown>, now: Date): unknown {
  const leaf: Record<string, unknown> = {};
  for (const [op, rawVal] of Object.entries(opMap)) {
    const val = resolveTemplate(rawVal, now);
    if (op === "between") {
      if (!Array.isArray(val) || val.length !== 2) {
        throw new Error("between 은 [min, max] 2-원소 배열이어야 합니다.");
      }
      leaf.gte = val[0];
      leaf.lte = val[1];
      continue;
    }
    if (op === "contains" || op === "startsWith") {
      leaf[OP_MAP[op]!] = val;
      // 대소문자 무시 (schema.ts 명세)
      (leaf as Record<string, unknown>).mode = "insensitive";
      continue;
    }
    const prismaOp = OP_MAP[op];
    if (!prismaOp) {
      throw new Error(`지원하지 않는 operator 입니다: ${op}`);
    }
    leaf[prismaOp] = val;
  }
  return leaf;
}

/** spec.data.filter → Prisma where 절. */
export function buildWhere(
  filter: Record<string, Record<string, unknown>> | undefined,
  now: Date,
): WhereNode {
  const where: WhereNode = {};
  if (!filter) return where;
  for (const [fieldPath, opMap] of Object.entries(filter)) {
    const leaf = buildLeaf(opMap, now);
    const path = fieldPath.split(".");
    if (path.length === 1) {
      where[path[0]!] = leaf;
    } else {
      // nested relation: client.createdAt → { client: { createdAt: leaf } }
      setNested(where, path, leaf);
    }
  }
  return where;
}

/** rowLevel 권한 — CLIENT 역할이면 자기 거래처로 강제 제한. */
function applyRowLevel(
  where: WhereNode,
  spec: WidgetSpec,
  ctx: ExecuteContext,
  source: WidgetSource,
): WhereNode {
  const rowLevel = spec.permissions?.rowLevel ?? "none";
  if (rowLevel !== "ownClientOnly") return where;
  if (ctx.role !== "CLIENT") return where;
  if (!ctx.clientId) {
    throw new Error("ownClientOnly 위젯에는 clientId 컨텍스트가 필요합니다.");
  }
  // client 소스는 자기 자신(id)로, 그 외 거래 소스는 clientId 컬럼으로
  if (source === "client") {
    where.id = ctx.clientId;
  } else if (SOURCES_WITH_CLIENT_ID.has(source)) {
    where.clientId = ctx.clientId;
  } else {
    // clientId 가 없는 소스(product 등)에 ownClientOnly 는 부적절 → 안전하게 차단
    throw new Error(
      `소스 '${source}' 에는 거래처 행-레벨 필터를 적용할 수 없습니다.`,
    );
  }
  return where;
}

// ─────────────────────────────────────────────────────────────
// 4. aggregate 헬퍼
// ─────────────────────────────────────────────────────────────
/** aggregate.type → Prisma aggregate 인자 (_sum/_count/_avg/_min/_max). */
function aggregateArg(
  type: AggregateType,
  field: string | null | undefined,
): Record<string, unknown> {
  switch (type) {
    case "count":
      return { _count: true };
    case "sum":
      if (!field) throw new Error("sum 집계에는 field 가 필요합니다.");
      return { _sum: { [field]: true } };
    case "avg":
      if (!field) throw new Error("avg 집계에는 field 가 필요합니다.");
      return { _avg: { [field]: true } };
    case "min":
      if (!field) throw new Error("min 집계에는 field 가 필요합니다.");
      return { _min: { [field]: true } };
    case "max":
      if (!field) throw new Error("max 집계에는 field 가 필요합니다.");
      return { _max: { [field]: true } };
    case "countDistinct":
      // Prisma aggregate 는 distinct count 미지원 → 호출부에서 findMany distinct 로 처리
      throw new Error("countDistinct 는 aggregateArg 로 처리할 수 없습니다.");
  }
}

/** Prisma aggregate 결과에서 단일 숫자 추출 (Decimal → number). */
function extractAggValue(
  result: Record<string, unknown>,
  type: AggregateType,
  field: string | null | undefined,
): number {
  if (type === "count") {
    return toNum(result._count);
  }
  const bucketKey = `_${type}` as "_sum" | "_avg" | "_min" | "_max";
  const bucket = result[bucketKey] as Record<string, unknown> | undefined;
  if (!bucket || !field) return 0;
  return toNum(bucket[field]);
}

/** Decimal / bigint / number / null → number. */
function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  // Prisma.Decimal 은 toNumber() 또는 String 화 가능
  const maybe = v as { toNumber?: () => number };
  if (typeof maybe.toNumber === "function") return maybe.toNumber();
  const n = Number(v as never);
  return Number.isFinite(n) ? n : 0;
}

// ─────────────────────────────────────────────────────────────
// 5. comparison — 날짜 필터창을 한 주기 앞으로 이동
// ─────────────────────────────────────────────────────────────
/**
 * filter 안의 날짜 범위(gte/lt/lte/gt 가 Date 인 컬럼)를 찾아 한 주기 shift.
 * previousPeriod = 같은 길이만큼 앞으로, previousYear = 1년 앞으로.
 * 날짜 컬럼이 없으면 null 반환 (비교 불가).
 */
function shiftWhereForComparison(
  where: WhereNode,
  type: "previousPeriod" | "previousYear",
): WhereNode | null {
  // 깊은 복제 (Date 보존)
  const cloned = cloneWhere(where);
  const range = findDateRange(cloned);
  if (!range) return null;

  const { leaf, lowerKey, upperKey } = range;
  const lower = leaf[lowerKey] as Date | undefined;
  const upper = leaf[upperKey] as Date | undefined;

  if (type === "previousYear") {
    if (lower) leaf[lowerKey] = addUnit(lower, -1, "year");
    if (upper) leaf[upperKey] = addUnit(upper, -1, "year");
    return cloned;
  }

  // previousPeriod: 범위 길이만큼 두 경계를 앞으로 당김
  if (lower && upper) {
    const spanMs = upper.getTime() - lower.getTime();
    leaf[lowerKey] = new Date(lower.getTime() - spanMs);
    leaf[upperKey] = new Date(upper.getTime() - spanMs);
    return cloned;
  }
  // 한쪽 경계만 있으면 30일 기본 이동 (느슨한 fallback)
  const DAY = 24 * 60 * 60 * 1000;
  if (lower) leaf[lowerKey] = new Date(lower.getTime() - 30 * DAY);
  if (upper) leaf[upperKey] = new Date(upper.getTime() - 30 * DAY);
  return cloned;
}

type DateRangeHit = {
  leaf: Record<string, Date | unknown>;
  lowerKey: "gte" | "gt";
  upperKey: "lt" | "lte";
};

/** where 트리를 DFS 하여 Date 경계(gte/gt + lt/lte)를 가진 첫 leaf 반환. */
function findDateRange(node: WhereNode): DateRangeHit | null {
  for (const value of Object.values(node)) {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const obj = value as Record<string, unknown>;
      const lowerKey = obj.gte instanceof Date ? "gte" : obj.gt instanceof Date ? "gt" : null;
      const upperKey = obj.lt instanceof Date ? "lt" : obj.lte instanceof Date ? "lte" : null;
      if (lowerKey || upperKey) {
        return {
          leaf: obj as Record<string, Date | unknown>,
          // 없는 쪽은 사용 안 함 — 타입 만족용 기본
          lowerKey: (lowerKey ?? "gte") as "gte" | "gt",
          upperKey: (upperKey ?? "lt") as "lt" | "lte",
        };
      }
      // 재귀 (nested relation)
      const nested = findDateRange(obj as WhereNode);
      if (nested) return nested;
    }
  }
  return null;
}

/** Date 를 보존하는 얕은-깊은 복제. */
function cloneWhere(node: WhereNode): WhereNode {
  const out: WhereNode = {};
  for (const [k, v] of Object.entries(node)) {
    if (v instanceof Date) out[k] = new Date(v);
    else if (Array.isArray(v)) out[k] = v.slice();
    else if (v && typeof v === "object") out[k] = cloneWhere(v as WhereNode);
    else out[k] = v;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 6. orderBy 변환
// ─────────────────────────────────────────────────────────────
function buildOrderBy(
  orderBy: WidgetSpec["data"]["orderBy"],
): Record<string, "asc" | "desc">[] | undefined {
  if (!orderBy || orderBy.length === 0) return undefined;
  return orderBy.map((o) => {
    const path = o.field.split(".");
    if (path.length === 1) return { [o.field]: o.dir };
    // nested orderBy: client.name → { client: { name: 'desc' } }
    const root: Record<string, unknown> = {};
    setNested(root, path, o.dir);
    return root as Record<string, "asc" | "desc">;
  });
}

// ─────────────────────────────────────────────────────────────
// 7. 메인 실행기
// ─────────────────────────────────────────────────────────────
export async function executeWidgetSpec(
  spec: WidgetSpec,
  ctx: ExecuteContext,
): Promise<WidgetResult> {
  const { source } = spec.data;
  const delegate = delegateFor(source); // whitelist 검증 포함
  const now = ctx.now;

  // where 조립 + 행-레벨 권한
  let where = buildWhere(spec.data.filter, now);
  where = applyRowLevel(where, spec, ctx, source);

  const groupBy = spec.data.groupBy ?? undefined;
  const aggregate = spec.data.aggregate;
  const limit = spec.data.limit ?? undefined;

  // ── (A) groupBy 있음 → 차트 계열 ────────────────────────
  if (groupBy && groupBy.length > 0) {
    return await runGroupBy(delegate, where, groupBy, aggregate, spec, limit);
  }

  // ── (B) groupBy 없음 + aggregate → KPI 단일 값 ─────────
  if (aggregate) {
    const value = await runAggregate(delegate, where, aggregate, source);
    const result: WidgetResult = { kind: spec.kind, value };

    // comparison
    const cmp = spec.comparison;
    if (cmp && (cmp.type === "previousPeriod" || cmp.type === "previousYear")) {
      const prevWhere = shiftWhereForComparison(where, cmp.type);
      if (prevWhere) {
        const previous = await runAggregate(delegate, prevWhere, aggregate, source);
        result.comparison = {
          current: value,
          previous,
          deltaPercent: previous === 0 ? null : ((value - previous) / previous) * 100,
        };
      }
    } else if (cmp && cmp.type === "target" && typeof cmp.targetValue === "number") {
      const previous = cmp.targetValue;
      result.comparison = {
        current: value,
        previous,
        deltaPercent: previous === 0 ? null : ((value - previous) / previous) * 100,
      };
    }
    return result;
  }

  // ── (C) aggregate 없음 → 행 목록 (table/list) ──────────
  const cols = getDisplayColumns(source);
  if (cols) {
    const include = buildIncludeForColumns(cols);
    const rawRows = (await delegate.findMany({
      where, orderBy: buildOrderBy(spec.data.orderBy), take: limit ?? 50,
      ...(include ? { include } : {}),
    })) as Record<string, unknown>[];
    const rows = rawRows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const { field, label } of cols) out[label] = serializeValue(getValueByPath(row, field));
      return out;
    });
    return { kind: spec.kind, rows };
  }
  const rows = (await delegate.findMany({
    where, orderBy: buildOrderBy(spec.data.orderBy), take: limit ?? 50,
  })) as Record<string, unknown>[];
  return { kind: spec.kind, rows: serializeRows(rows) };
}

// ─── (A) groupBy 실행 ─────────────────────────────────
async function runGroupBy(
  delegate: AnyDelegate,
  where: WhereNode,
  groupBy: string[],
  aggregate: WidgetSpec["data"]["aggregate"],
  spec: WidgetSpec,
  limit: number | undefined,
): Promise<WidgetResult> {
  const aggType = aggregate?.type ?? "count";
  const aggField = aggregate?.field ?? null;

  // LLM 별칭 보정: clientName/client.name → clientId 등 (Prisma 는 스칼라 FK 만 허용)
  const by = normalizeGroupBy(groupBy);
  // groupBy 의 distinct/count 는 Prisma groupBy 가 자체 지원
  const args: Record<string, unknown> = { by, where };
  if (aggType === "count" || aggType === "countDistinct") {
    args._count = true;
  } else {
    Object.assign(args, aggregateArg(aggType, aggField));
  }
  if (aggregate?.field && spec.data.orderBy && spec.data.orderBy.length > 0) {
    // groupBy 정렬은 _sum 등 집계 키로만 가능 — 단순화를 위해 메모리 정렬 사용
  }

  const grouped = (await delegate.groupBy(args)) as Record<string, unknown>[];
  const labelKey = groupBy[0]!;
  let series: WidgetSeriesPoint[] = grouped.map((g) => ({
    label: String(g[labelKey] ?? "—"),
    value:
      aggType === "count" || aggType === "countDistinct"
        ? toNum(g._count)
        : extractAggValue(g, aggType, aggField),
  }));

  // 라벨 해석: groupBy 필드가 ID면 참조 모델에서 이름 배치 조회
  const resolver = LABEL_RESOLVERS[labelKey];
  if (resolver) {
    const ids = series.map((s) => s.label).filter((x) => x && x !== "—");
    if (ids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refs = (await (prisma as any)[resolver.model].findMany({
        where: { id: { in: ids } },
        select: { id: true, [resolver.labelField]: true },
      })) as Array<Record<string, unknown>>;
      const nameById = new Map(refs.map((r) => [String(r.id), String(r[resolver.labelField] ?? r.id)]));
      series = series.map((s) => ({ ...s, label: nameById.get(s.label) ?? s.label }));
    }
  }

  // 값 desc 정렬 후 limit (chart 가독성)
  series.sort((a, b) => b.value - a.value);
  if (limit) series = series.slice(0, limit);

  return { kind: spec.kind, series };
}

// ─── (B) aggregate 실행 (countDistinct 특수 처리 포함) ─
async function runAggregate(
  delegate: AnyDelegate,
  where: WhereNode,
  aggregate: NonNullable<WidgetSpec["data"]["aggregate"]>,
  _source: WidgetSource,
): Promise<number> {
  if (aggregate.type === "countDistinct") {
    const field = aggregate.field;
    if (!field) throw new Error("countDistinct 집계에는 field 가 필요합니다.");
    // Prisma aggregate 미지원 → findMany distinct 로 고유값 수 계산
    const rows = (await delegate.findMany({
      where,
      select: { [field]: true },
      distinct: [field],
    })) as Record<string, unknown>[];
    return rows.length;
  }
  const result = (await delegate.aggregate({
    where,
    ...aggregateArg(aggregate.type, aggregate.field),
  })) as Record<string, unknown>;
  return extractAggValue(result, aggregate.type, aggregate.field);
}

// ─── 행 직렬화 (Decimal/BigInt → number, Date → ISO) ──
function serializeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = serializeValue(v);
    }
    return out;
  });
}

function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  const maybe = v as { toNumber?: () => number };
  if (typeof maybe?.toNumber === "function") return maybe.toNumber(); // Decimal
  return v;
}
