/**
 * 거래처 (Client) Server Actions.
 *
 * - 모든 액션은 `requireTenant()` 로 테넌트 컨텍스트 확보
 * - 쿼리는 항상 tenant 범위 내에서만 동작 (Prisma schema 자체가 tenant_altibio 스키마)
 *   → 추후 멀티 테넌트 스키마 확장 시에는 prisma 인스턴스를 tenantId 기반으로 스위치
 * - 변경 액션은 fire-and-forget 감사로그 기록
 * - revalidatePath 로 /admin/clients UI 캐시 무효화
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma, type ClientType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  clientCreateSchema,
  clientUpdateSchema,
  type ClientCreateInput,
  type ClientUpdateInput,
} from "@/lib/validators/client";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

type ListOpts = {
  q?: string;
  type?: ClientType | "ALL";
  active?: "ALL" | "ACTIVE" | "INACTIVE";
};

/**
 * 거래처 목록 조회 (경영지원·대표만).
 * 검색어(q)는 code/name/representative/phone 에 대해 case-insensitive.
 */
export async function listClients(opts: ListOpts = {}) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC", "EXEC");

  const where: Prisma.ClientWhereInput = {};
  if (opts.type && opts.type !== "ALL") where.type = opts.type;
  if (opts.active === "ACTIVE") where.active = true;
  else if (opts.active === "INACTIVE") where.active = false;

  if (opts.q && opts.q.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { representative: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  return prisma.client.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { addresses: true, orders: true } },
      // 2026-06: 거래처관리 UI 카드/테이블이 할인율·고정가를 표시하려면 필요.
      // (이전엔 _count 만 include 라 응답에 discounts/fixedPrices 가 없어 UI 가 'undefined%' 표시)
      discounts: { select: { category: true, discountRate: true } },
      fixedPrices: {
        select: {
          fixedPrice: true,
          product: { select: { id: true, code: true, name: true, category: true, part: true } },
        },
      },
      salesRep: { select: { id: true, name: true } },
    },
  });
}

export async function getClient(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.client.findUnique({
    where: { id },
    include: {
      addresses: {
        where: { active: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
      discounts: true,
      fixedPrices: { include: { product: { select: { id: true, name: true, code: true } } } },
    },
  });
}

export async function createClient(
  input: ClientCreateInput,
): Promise<ActionResult<{ id: string; code: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = clientCreateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const data = parsed.data;

  // 코드 중복 체크 (DB unique 제약 전에 친화적 메시지)
  const dup = await prisma.client.findUnique({ where: { code: data.code } });
  if (dup) return fail("이미 사용 중인 거래처 코드입니다.", { fieldErrors: { code: ["중복"] } });

  try {
    const created = await prisma.client.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        businessNumber: data.businessNumber,
        representative: data.representative,
        phone: data.phone,
        email: data.email,
        address: data.address,
        postalCode: data.postalCode,
        paymentTerms: data.paymentTerms,
        salesRepId: data.salesRepId,
        note: data.note,
        createdBy: user.id,
      },
      select: { id: true, code: true },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CLIENT_CREATE",
      resource: `Client:${created.id}`,
      metadata: { code: created.code, name: data.name, type: data.type },
    });

    revalidatePath("/admin/clients");
    return ok(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("중복된 거래처 코드입니다.", { fieldErrors: { code: ["중복"] } });
    }
    throw err;
  }
}

export async function updateClient(
  id: string,
  input: ClientUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = clientUpdateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) return fail("존재하지 않는 거래처입니다.");

  // code 변경 시 중복 체크
  if (parsed.data.code && parsed.data.code !== existing.code) {
    const dup = await prisma.client.findUnique({ where: { code: parsed.data.code } });
    if (dup) return fail("이미 사용 중인 거래처 코드입니다.", { fieldErrors: { code: ["중복"] } });
  }

  try {
    await prisma.client.update({
      where: { id },
      data: { ...parsed.data },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CLIENT_UPDATE",
      resource: `Client:${id}`,
      metadata: {
        before: { code: existing.code, name: existing.name, active: existing.active },
        patch: parsed.data,
      },
    });

    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${id}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("중복된 거래처 코드입니다.", { fieldErrors: { code: ["중복"] } });
    }
    throw err;
  }
}

/**
 * 활성/비활성 토글 (소프트 삭제).
 * 과거 주문·감사로그 보호를 위해 실제 DELETE 는 사용하지 않음.
 */
export async function toggleClientActive(id: string): Promise<ActionResult<{ active: boolean }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) return fail("존재하지 않는 거래처입니다.");

  const next = !existing.active;
  await prisma.client.update({ where: { id }, data: { active: next } });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: next ? "CLIENT_REACTIVATE" : "CLIENT_DEACTIVATE",
    resource: `Client:${id}`,
    metadata: { code: existing.code, name: existing.name },
  });

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return ok({ active: next });
}
