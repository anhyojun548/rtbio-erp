/**
 * 거래명세서 (Invoice) Server Actions — Phase 3D-3a.
 *
 * 주요 액션:
 *   - listInvoices(filter)
 *   - getInvoice(id)
 *   - createInvoiceFromOrder(orderId, {...}) : COMPLETED 주문 → DRAFT invoice
 *   - updateInvoiceDraft(id, {...})          : DRAFT 에서만 수정 가능 (라인 X)
 *   - issueInvoice(id, {...})                : DRAFT → ISSUED (invoiceNumber 채번)
 *   - markInvoiceSent(id, {...})             : ISSUED → SENT
 *   - cancelInvoice(id, {reason})            : DRAFT/ISSUED/SENT → CANCELLED
 *
 * 생성 규칙:
 *   - 원본 주문의 OrderItem 을 InvoiceItem 에 복제:
 *       description = `{제품명} / {사이즈코드}` 포맷
 *       quantity, unitPrice, amount = lineTotal
 *   - supplyAmount = Σ lineTotal, vatAmount = round(supply × 0.1, 2), totalAmount = supply + vat.
 *   - 한 주문당 활성(non-CANCELLED) invoice 1건.
 *
 * RBAC: TENANT_OWNER / ADMIN.
 */
"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  createInvoiceFromOrderSchema,
  updateInvoiceDraftSchema,
  issueInvoiceSchema,
  markInvoiceSentSchema,
  cancelInvoiceSchema,
  calcVatTotal,
  type CreateInvoiceFromOrderInput,
  type UpdateInvoiceDraftInput,
  type IssueInvoiceInput,
  type MarkInvoiceSentInput,
  type CancelInvoiceInput,
} from "@/lib/validators/invoice";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";

class InvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceError";
  }
}

// ─── 채번 ─────────────────────────────────────────────────

/**
 * `INV-YYYYMMDD-NNN` 포맷의 거래명세서 번호 채번.
 *
 * 동시성 전략: orderNumber 채번과 동일한 Postgres advisory lock 패턴.
 *   - 당일 해시키로 advisory lock → 같은 날짜의 채번을 직렬화.
 *   - 같은 prefix 를 가진 최대 seq 조회 후 +1.
 *   - 트랜잭션 외부에서 호출 시 `tx.$executeRaw` 가 아닌 `prisma.$executeRaw` 는 세션 단위라 권장 X → 반드시 tx 에서 호출.
 */
async function issueInvoiceNumber(
  tx: Prisma.TransactionClient,
  issueDate: Date,
): Promise<string> {
  const y = issueDate.getFullYear();
  const m = `${issueDate.getMonth() + 1}`.padStart(2, "0");
  const d = `${issueDate.getDate()}`.padStart(2, "0");
  const prefix = `INV-${y}${m}${d}-`;

  // 당일 advisory lock. orderNumber 와 키 공간이 겹치지 않도록 + 10^10 offset 적용.
  const lockKey = Number(`${y}${m}${d}`) + 10_000_000_000;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

  const rows = await tx.$queryRaw<{ invoiceNumber: string }[]>`
    SELECT "invoiceNumber" FROM "tenant_altibio"."Invoice"
    WHERE "invoiceNumber" LIKE ${prefix + "%"}
    ORDER BY "invoiceNumber" DESC
    LIMIT 1
  `;

  let nextSeq = 1;
  if (rows[0]) {
    const tail = rows[0].invoiceNumber.slice(prefix.length);
    const parsed = Number.parseInt(tail, 10);
    if (Number.isFinite(parsed)) nextSeq = parsed + 1;
  }
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

// ─── 조회 ─────────────────────────────────────────────────

export type InvoiceListFilter = {
  q?: string;
  clientId?: string;
  status?: InvoiceStatus | "ALL";
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function listInvoices(filter: InvoiceListFilter = {}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const where: Prisma.InvoiceWhereInput = {};
  if (filter.clientId) where.clientId = filter.clientId;
  if (filter.status && filter.status !== "ALL") where.status = filter.status;
  if (filter.from || filter.to) {
    where.issueDate = {};
    if (filter.from) where.issueDate.gte = filter.from;
    if (filter.to) where.issueDate.lte = filter.to;
  }
  if (filter.q && filter.q.trim()) {
    const q = filter.q.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { client: { code: { contains: q, mode: "insensitive" } } },
    ];
  }

  return prisma.invoice.findMany({
    where,
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: filter.limit ?? 200,
    include: {
      client: { select: { id: true, code: true, name: true } },
      order: { select: { id: true, orderNumber: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function getInvoice(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      order: { select: { id: true, orderNumber: true, orderDate: true } },
      items: { orderBy: { id: "asc" } },
    },
  });
}

/**
 * 주문 → 연결된 활성(non-CANCELLED) invoice 조회. 발급 버튼 UI 분기에 사용.
 */
export async function getInvoiceByOrderId(orderId: string) {
  await requireRole("TENANT_OWNER", "ADMIN");
  return prisma.invoice.findFirst({
    where: {
      orderId,
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      issueDate: true,
      totalAmount: true,
    },
  });
}

// ─── 생성: 주문 → DRAFT 거래명세서 ────────────────────────

export async function createInvoiceFromOrder(
  orderId: string,
  input: CreateInvoiceFromOrderInput = {},
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = createInvoiceFromOrderSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  // TenantSetting.vat_rate 로 VAT율 override — 없으면 기본 0.10.
  const vatRateSetting = await prisma.tenantSetting.findUnique({
    where: { key: "vat_rate" },
    select: { value: true },
  });
  const vatRate = vatRateSetting?.value ? Number(vatRateSetting.value) : 0.1;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          client: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { name: true, code: true } },
              productSize: { select: { sizeCode: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!order) throw new InvoiceError("존재하지 않는 주문입니다.");
      if (order.status !== "COMPLETED")
        throw new InvoiceError(
          `COMPLETED 주문만 거래명세서를 발급할 수 있습니다 (현재: ${order.status}).`,
        );
      if (order.items.length === 0)
        throw new InvoiceError("라인이 없는 주문입니다.");

      // 한 주문당 활성 invoice 1건 제약
      const existing = await tx.invoice.findFirst({
        where: { orderId, status: { not: "CANCELLED" } },
        select: { id: true, invoiceNumber: true, status: true },
      });
      if (existing)
        throw new InvoiceError(
          `이미 거래명세서가 발급되었습니다 (${existing.invoiceNumber ?? "DRAFT"} · ${existing.status}). 먼저 취소해주세요.`,
        );

      // 공급가액 = Σ lineTotal
      const supplyNumber = order.items.reduce(
        (s, it) => s + Number(it.lineTotal),
        0,
      );
      const { vat, total } = calcVatTotal(supplyNumber, vatRate);
      const supply = new Prisma.Decimal(supplyNumber.toFixed(2));
      const vatDecimal = new Prisma.Decimal(vat.toFixed(2));
      const totalDecimal = new Prisma.Decimal(total.toFixed(2));

      const issueDate = data.issueDate ?? new Date();

      // DRAFT 번호: DRAFT-INV-{cuid8}. 발급(ISSUED) 시 공식 번호로 재발급.
      const draftNumber = `DRAFT-INV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: draftNumber,
          clientId: order.clientId,
          orderId: order.id,
          issueDate,
          dueDate: data.dueDate ?? null,
          supplyAmount: supply,
          vatAmount: vatDecimal,
          totalAmount: totalDecimal,
          status: "DRAFT",
          note: data.note ?? null,
          createdBy: user.id,
          items: {
            create: order.items.map((it) => {
              const amount = new Prisma.Decimal(
                Number(it.lineTotal).toFixed(2),
              );
              return {
                description: `${it.product.name} / ${it.productSize.sizeCode}`,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                amount,
              };
            }),
          },
        },
        select: { id: true, invoiceNumber: true },
      });

      return {
        id: invoice.id,
        tempNumber: invoice.invoiceNumber,
        clientId: order.clientId,
        clientName: order.client.name,
        orderNumber: order.orderNumber,
        itemCount: order.items.length,
        supply: supplyNumber,
        total,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "INVOICE_CREATE_DRAFT",
      resource: `Invoice:${result.id}`,
      metadata: {
        orderId,
        orderNumber: result.orderNumber,
        clientId: result.clientId,
        itemCount: result.itemCount,
        supply: result.supply,
        total: result.total,
      },
    });

    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/orders/${orderId}`);
    return ok({ id: result.id });
  } catch (err) {
    if (err instanceof InvoiceError) return fail(err.message);
    throw err;
  }
}

// ─── DRAFT 수정 ───────────────────────────────────────────

export async function updateInvoiceDraft(
  id: string,
  input: UpdateInvoiceDraftInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = updateInvoiceDraftSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const cur = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, orderId: true },
    });
    if (!cur) throw new InvoiceError("존재하지 않는 거래명세서입니다.");
    if (cur.status !== "DRAFT")
      throw new InvoiceError(
        `DRAFT 상태에서만 수정 가능합니다 (현재: ${cur.status}).`,
      );

    await prisma.invoice.update({
      where: { id },
      data: {
        issueDate: data.issueDate ?? undefined,
        dueDate: data.dueDate ?? null,
        note: data.note ?? null,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "INVOICE_UPDATE_DRAFT",
      resource: `Invoice:${id}`,
      metadata: { patch: data },
    });

    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${id}`);
    if (cur.orderId) revalidatePath(`/admin/orders/${cur.orderId}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof InvoiceError) return fail(err.message);
    throw err;
  }
}

// ─── ISSUE: DRAFT → ISSUED ─────────────────────────────

export async function issueInvoice(
  id: string,
  input: IssueInvoiceInput = {},
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = issueInvoiceSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cur = await tx.invoice.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          orderId: true,
          clientId: true,
          issueDate: true,
          invoiceNumber: true,
        },
      });
      if (!cur) throw new InvoiceError("존재하지 않는 거래명세서입니다.");
      if (cur.status !== "DRAFT")
        throw new InvoiceError(
          `DRAFT 상태에서만 발행 가능합니다 (현재: ${cur.status}).`,
        );

      const issueDate = data.issueDate ?? cur.issueDate ?? new Date();
      const officialNumber = await issueInvoiceNumber(tx, issueDate);

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: "ISSUED",
          invoiceNumber: officialNumber,
          issueDate,
        },
        select: { id: true, invoiceNumber: true },
      });

      // 주문 invoiceIssued 플래그 동기화 — 명세서 발행 = 해당 주문이 청구됨.
      if (cur.orderId) {
        await tx.order.update({
          where: { id: cur.orderId },
          data: { invoiceIssued: true },
        });
      }

      return {
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        prevNumber: cur.invoiceNumber,
        clientId: cur.clientId,
        orderId: cur.orderId,
      };
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "INVOICE_ISSUE",
      resource: `Invoice:${id}`,
      metadata: {
        prevNumber: result.prevNumber,
        newNumber: result.invoiceNumber,
        clientId: result.clientId,
        orderId: result.orderId,
      },
    });

    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${id}`);
    if (result.orderId) revalidatePath(`/admin/orders/${result.orderId}`);
    return ok({ id, invoiceNumber: result.invoiceNumber });
  } catch (err) {
    if (err instanceof InvoiceError) return fail(err.message);
    throw err;
  }
}

// ─── SENT 표시 (ISSUED → SENT) ─────────────────────────

export async function markInvoiceSent(
  id: string,
  input: MarkInvoiceSentInput = {},
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = markInvoiceSentSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { note } = parsed.data;

  try {
    const cur = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        invoiceNumber: true,
        clientId: true,
        orderId: true,
      },
    });
    if (!cur) throw new InvoiceError("존재하지 않는 거래명세서입니다.");
    if (cur.status !== "ISSUED")
      throw new InvoiceError(
        `ISSUED 상태에서만 발송 완료로 표시할 수 있습니다 (현재: ${cur.status}).`,
      );

    await prisma.invoice.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        note: note ?? undefined,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "INVOICE_SENT",
      resource: `Invoice:${id}`,
      metadata: {
        invoiceNumber: cur.invoiceNumber,
        clientId: cur.clientId,
        orderId: cur.orderId,
      },
    });

    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${id}`);
    if (cur.orderId) revalidatePath(`/admin/orders/${cur.orderId}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof InvoiceError) return fail(err.message);
    throw err;
  }
}

// ─── CANCEL ──────────────────────────────────────────

export async function cancelInvoice(
  id: string,
  input: CancelInvoiceInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  const parsed = cancelInvoiceSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { reason } = parsed.data;

  try {
    const cur = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        invoiceNumber: true,
        clientId: true,
        orderId: true,
        note: true,
      },
    });
    if (!cur) throw new InvoiceError("존재하지 않는 거래명세서입니다.");
    if (cur.status === "CANCELLED")
      throw new InvoiceError("이미 취소된 거래명세서입니다.");

    await prisma.invoice.update({
      where: { id },
      data: {
        status: "CANCELLED",
        note: cur.note
          ? `${cur.note}\n[취소] ${reason}`
          : `[취소] ${reason}`,
      },
    });

    logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: "INVOICE_CANCEL",
      resource: `Invoice:${id}`,
      metadata: {
        invoiceNumber: cur.invoiceNumber,
        prevStatus: cur.status,
        clientId: cur.clientId,
        orderId: cur.orderId,
        reason,
      },
    });

    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${id}`);
    if (cur.orderId) revalidatePath(`/admin/orders/${cur.orderId}`);
    return ok({ id });
  } catch (err) {
    if (err instanceof InvoiceError) return fail(err.message);
    throw err;
  }
}
