/**
 * 거래처 배송지 (ClientAddress) Server Actions.
 *
 * 핵심 규칙:
 * - `isDefault = true` 인 배송지는 거래처당 1개. 앱 로직(트랜잭션)으로 enforce.
 * - 삭제 시 기본 배송지였다면 남아있는 활성 배송지 중 가장 오래된 것을 자동 승격.
 * - 배송지 삭제는 소프트 삭제(`active=false`) — 과거 주문 스냅샷은 그대로 유지.
 */
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  addressCreateSchema,
  addressUpdateSchema,
  type AddressCreateInput,
  type AddressUpdateInput,
} from "@/lib/validators/client";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

export async function listAddresses(clientId: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.clientAddress.findMany({
    where: { clientId, active: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * 배송지 생성.
 * - 거래처의 첫 배송지는 자동으로 isDefault=true
 * - isDefault=true 로 생성 요청 시 기존 기본값을 모두 해제 (트랜잭션)
 */
export async function createAddress(
  clientId: string,
  input: AddressCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = addressCreateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return fail("존재하지 않는 거래처입니다.");

  const existingCount = await prisma.clientAddress.count({
    where: { clientId, active: true },
  });
  const makeDefault = parsed.data.isDefault || existingCount === 0;

  const created = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.clientAddress.updateMany({
        where: { clientId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.clientAddress.create({
      data: {
        clientId,
        label: parsed.data.label,
        recipientName: parsed.data.recipientName,
        phone: parsed.data.phone,
        postalCode: parsed.data.postalCode,
        address: parsed.data.address,
        addressDetail: parsed.data.addressDetail,
        memo: parsed.data.memo,
        isDefault: makeDefault,
        createdBy: user.id,
      },
      select: { id: true },
    });
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CLIENT_ADDRESS_CREATE",
    resource: `ClientAddress:${created.id}`,
    metadata: { clientId, label: parsed.data.label, isDefault: makeDefault },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return ok(created);
}

export async function updateAddress(
  id: string,
  input: AddressUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = addressUpdateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.clientAddress.findUnique({ where: { id } });
  if (!existing) return fail("존재하지 않는 배송지입니다.");

  await prisma.$transaction(async (tx) => {
    // isDefault=true 로 바꾸는 경우 같은 거래처의 나머지 기본값 해제
    if (parsed.data.isDefault === true && !existing.isDefault) {
      await tx.clientAddress.updateMany({
        where: { clientId: existing.clientId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    await tx.clientAddress.update({
      where: { id },
      data: { ...parsed.data },
    });
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CLIENT_ADDRESS_UPDATE",
    resource: `ClientAddress:${id}`,
    metadata: { clientId: existing.clientId, patch: parsed.data },
  });

  revalidatePath(`/admin/clients/${existing.clientId}`);
  return ok({ id });
}

/**
 * 배송지 삭제 (soft). 기본 배송지였다면 남은 활성 배송지 중 하나를 승격.
 */
export async function deleteAddress(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const existing = await prisma.clientAddress.findUnique({ where: { id } });
  if (!existing) return fail("존재하지 않는 배송지입니다.");

  await prisma.$transaction(async (tx) => {
    await tx.clientAddress.update({
      where: { id },
      data: { active: false, isDefault: false },
    });

    if (existing.isDefault) {
      const promote = await tx.clientAddress.findFirst({
        where: { clientId: existing.clientId, active: true },
        orderBy: { createdAt: "asc" },
      });
      if (promote) {
        await tx.clientAddress.update({
          where: { id: promote.id },
          data: { isDefault: true },
        });
      }
    }
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CLIENT_ADDRESS_DELETE",
    resource: `ClientAddress:${id}`,
    metadata: { clientId: existing.clientId, label: existing.label, wasDefault: existing.isDefault },
  });

  revalidatePath(`/admin/clients/${existing.clientId}`);
  return ok({ id });
}

/**
 * 특정 배송지를 기본으로 지정. 같은 거래처의 다른 기본값은 해제.
 */
export async function setDefaultAddress(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const existing = await prisma.clientAddress.findUnique({ where: { id } });
  if (!existing) return fail("존재하지 않는 배송지입니다.");
  if (!existing.active) return fail("비활성 배송지는 기본값으로 지정할 수 없습니다.");

  await prisma.$transaction(async (tx) => {
    await tx.clientAddress.updateMany({
      where: { clientId: existing.clientId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
    await tx.clientAddress.update({
      where: { id },
      data: { isDefault: true },
    });
  });

  logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CLIENT_ADDRESS_SET_DEFAULT",
    resource: `ClientAddress:${id}`,
    metadata: { clientId: existing.clientId, label: existing.label },
  });

  revalidatePath(`/admin/clients/${existing.clientId}`);
  return ok({ id });
}
