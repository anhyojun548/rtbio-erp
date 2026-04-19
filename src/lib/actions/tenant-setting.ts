/**
 * 테넌트 설정(TenantSetting) Server Actions — Phase 3E-2 (R13).
 *
 * DB 는 key/value 공용 문자열 테이블이며, 이 모듈이 타입 안전한 래퍼를 제공한다.
 *
 * 주요 메서드
 *   - listSettings()               → 알려진 키의 현재 값 + description
 *   - getSettingValue(key)         → 단일 키 값 (없으면 null)
 *   - getSettings()                → Record<key,value> 맵 (없는 키는 undefined)
 *   - updateSetting(input)         → 단일 upsert
 *   - bulkUpdateSettings(input)    → 복수 upsert (tx) + 업무시간 비즈니스 규칙
 *
 * RBAC: 전체 조회는 로그인만, 쓰기는 TENANT_OWNER / ADMIN.
 */
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  updateSettingSchema,
  bulkUpdateSettingsSchema,
  validateBusinessHours,
  TENANT_SETTING_KEYS,
  type UpdateSettingInput,
  type BulkUpdateSettingsInput,
  type TenantSettingKey,
} from "@/lib/validators/tenant-setting";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

const KEY_DESCRIPTIONS: Record<TenantSettingKey, string> = {
  business_hour_start: "업무 시작 시각",
  business_hour_end: "업무 종료 시각",
  shipping_cutoff: "택배 마감시간 (이후 주문은 익일 출고)",
  reorder_multiplier: "재고 알람 기준 = 월평균 × 값",
  vat_rate: "부가세율 (R18)",
};

// ─── 조회 ─────────────────────────────────────────────────

/**
 * 알려진 키 5개의 현재 값 + description 을 정렬된 배열로 반환.
 * DB 에 없으면 value=null 로 채워준다 (UI 에서 시드 유도).
 */
export async function listSettings(): Promise<
  Array<{
    key: TenantSettingKey;
    value: string | null;
    description: string;
    updatedAt: Date | null;
    updatedBy: string | null;
  }>
> {
  await requireAuth();
  const rows = await prisma.tenantSetting.findMany({
    where: { key: { in: [...TENANT_SETTING_KEYS] } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return TENANT_SETTING_KEYS.map((k) => {
    const r = byKey.get(k);
    return {
      key: k,
      value: r?.value ?? null,
      description: KEY_DESCRIPTIONS[k],
      updatedAt: r?.updatedAt ?? null,
      updatedBy: r?.updatedBy ?? null,
    };
  });
}

/** 단일 키 값. 없으면 null. RBAC: 로그인만. */
export async function getSettingValue(
  key: TenantSettingKey,
): Promise<string | null> {
  await requireAuth();
  const r = await prisma.tenantSetting.findUnique({ where: { key } });
  return r?.value ?? null;
}

/**
 * 알려진 전체 키의 값을 맵으로. 없는 키는 undefined.
 * 서버 사이드 계산에서 편하게 쓰도록 제공.
 */
export async function getSettings(): Promise<Partial<Record<TenantSettingKey, string>>> {
  await requireAuth();
  const rows = await prisma.tenantSetting.findMany({
    where: { key: { in: [...TENANT_SETTING_KEYS] } },
  });
  const map: Partial<Record<TenantSettingKey, string>> = {};
  for (const r of rows) {
    if ((TENANT_SETTING_KEYS as readonly string[]).includes(r.key)) {
      map[r.key as TenantSettingKey] = r.value;
    }
  }
  return map;
}

// ─── 쓰기: 단일 ────────────────────────────────────────────

export async function updateSetting(
  input: UpdateSettingInput,
): Promise<ActionResult<{ key: string; value: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = updateSettingSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { key, value } = parsed.data;

  await prisma.tenantSetting.upsert({
    where: { key },
    update: { value, updatedBy: user.id },
    create: {
      key,
      value,
      description: KEY_DESCRIPTIONS[key],
      updatedBy: user.id,
    },
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "TENANT_SETTING_UPDATE",
    resource: `TenantSetting:${key}`,
    metadata: { key, value },
  });

  revalidatePath("/admin/settings");
  return ok({ key, value });
}

// ─── 쓰기: 복수 ────────────────────────────────────────────

export async function bulkUpdateSettings(
  input: BulkUpdateSettingsInput,
): Promise<ActionResult<{ count: number }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = bulkUpdateSettingsSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { items } = parsed.data;

  // 업무시간 교차 규칙 — 둘 다 변경되거나, 현재 DB 값과 결합해 검증.
  const startPatch = items.find((i) => i.key === "business_hour_start");
  const endPatch = items.find((i) => i.key === "business_hour_end");
  if (startPatch || endPatch) {
    const cur = await prisma.tenantSetting.findMany({
      where: {
        key: { in: ["business_hour_start", "business_hour_end"] },
      },
    });
    const curMap = new Map(cur.map((c) => [c.key, c.value] as const));
    const newStart = startPatch?.value ?? curMap.get("business_hour_start");
    const newEnd = endPatch?.value ?? curMap.get("business_hour_end");
    if (newStart && newEnd) {
      const chk = validateBusinessHours(newStart, newEnd);
      if (!chk.ok) return fail(chk.message);
    }
  }

  const count = await prisma.$transaction(async (tx) => {
    for (const it of items) {
      await tx.tenantSetting.upsert({
        where: { key: it.key },
        update: { value: it.value, updatedBy: user.id },
        create: {
          key: it.key,
          value: it.value,
          description: KEY_DESCRIPTIONS[it.key],
          updatedBy: user.id,
        },
      });
    }
    return items.length;
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "TENANT_SETTING_BULK_UPDATE",
    resource: `TenantSetting:bulk(${items.length})`,
    metadata: { items },
  });

  revalidatePath("/admin/settings");
  return ok({ count });
}
