import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbTableDef, DbFieldType } from "./registry";

export type ColMeta = { name: string; type: string };

/** accessor(camelCase) → DMMF 모델 찾기 → scalar 필드(민감 제외) */
export function getScalarColumns(model: string, sensitive: string[]): ColMeta[] {
  const m = Prisma.dmmf.datamodel.models.find(
    (x) => x.name.charAt(0).toLowerCase() + x.name.slice(1) === model,
  );
  if (!m) return [];
  return m.fields
    // scalar + enum 포함 (status/role/type 같은 enum 이 빠지면 가장 중요한 컬럼이 사라짐).
    // relation(kind==='object')·list 는 제외.
    .filter((f) => (f.kind === "scalar" || f.kind === "enum") && !f.isList && !sensitive.includes(f.name))
    .map((f) => ({ name: f.name, type: f.type }));
}

function coerce(type: DbFieldType, v: unknown): unknown {
  if (v === null || v === undefined || v === "") return type === "string" ? "" : null;
  switch (type) {
    case "int":
      return Math.trunc(Number(v));
    case "boolean":
      return v === true || v === "true" || v === 1 || v === "1";
    case "datetime":
      return new Date(String(v));
    default:
      return String(v);
  }
}

/** 읽기 — 안전컬럼 select + tenant 필터 + 검색 + 페이지 */
export async function queryTable(
  def: DbTableDef,
  opts: { q?: string; limit: number; offset: number; tenantId: string | null },
) {
  const cols = getScalarColumns(def.model, def.sensitiveFields);
  const select = Object.fromEntries(cols.map((c) => [c.name, true]));
  const where: Record<string, unknown> = {};
  if (def.tenantScoped && opts.tenantId) where.tenantId = opts.tenantId;
  if (opts.q && def.searchFields.length) {
    where.OR = def.searchFields.map((f) => ({ [f]: { contains: opts.q, mode: "insensitive" } }));
  }
  const model = (prisma as unknown as Record<string, any>)[def.model];
  const [rows, total] = await Promise.all([
    model.findMany({ where, select, orderBy: def.defaultOrderBy, take: opts.limit, skip: opts.offset }),
    model.count({ where }),
  ]);
  return { rows, columns: cols, total };
}

/** 편집 — editable 테이블 + editableFields 만. tenant 가드. */
export async function updateRow(
  def: DbTableDef,
  id: string,
  patch: Record<string, unknown>,
  tenantId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!def.editable || !def.editableFields) return { ok: false, error: "편집할 수 없는 테이블입니다." };
  const data: Record<string, unknown> = {};
  for (const [field, ftype] of Object.entries(def.editableFields)) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) data[field] = coerce(ftype, patch[field]);
  }
  if (Object.keys(data).length === 0) return { ok: false, error: "변경할 필드가 없습니다." };

  const model = (prisma as unknown as Record<string, any>)[def.model];
  // 소유권/테넌트 가드 — pk + (tenantScoped ? tenantId)
  const findWhere: Record<string, unknown> = { [def.pkField]: id };
  if (def.tenantScoped && tenantId) findWhere.tenantId = tenantId;
  const existing = await model.findFirst({ where: findWhere, select: { [def.pkField]: true } });
  if (!existing) return { ok: false, error: "대상 행을 찾을 수 없습니다." };

  await model.update({ where: { [def.pkField]: id }, data });
  return { ok: true };
}
