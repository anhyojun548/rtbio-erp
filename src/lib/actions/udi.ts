"use server";

/**
 * UDI 공급내역 보고 — Phase 5
 *
 * 월 단위로 병원 납품 거래를 집계해서 식약처에 보고.
 * - 자동 집계: 해당 월 ISSUED+SENT 거래명세서의 HOSPITAL 거래처 라인
 * - 수동 추가/수정 가능
 * - submit → 식약처 전송 → receiptNo 발급
 */
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { z } from "zod";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// UDI_STATUS_LABEL 은 lib/validators/udi.ts 에 분리

const createUdiReportSchema = z.object({
  reportMonth: z.string().regex(MONTH_RE),
  note:        z.string().max(1000).optional().nullable(),
});

export async function listUdiReports() {
  // QC 도 조회 허용 (R03 — 품질팀 모니터링)
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  return prisma.udiReport.findMany({
    include: { items: { take: 1 }, _count: { select: { items: true } } },
    orderBy: { reportMonth: "desc" },
  });
}

export async function getUdiReport(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  return prisma.udiReport.findUnique({
    where: { id },
    include: {
      items: {
        include: { client: { select: { id: true, code: true, name: true, businessNumber: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
}

/**
 * 보고서를 생성하기 전에 해당 월에 어떤 데이터가 잡힐지 미리보기.
 * 병원수/품목수/총수량/총금액 + 미보고 invoice 라인 카운트.
 */
export async function getUdiMonthPreview(reportMonth: string): Promise<{
  reportMonth: string;
  hospitalCount: number;
  itemCount: number;
  totalQty: number;
  totalAmount: number;
  hasExistingReport: boolean;
}> {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  if (!MONTH_RE.test(reportMonth)) {
    return { reportMonth, hospitalCount: 0, itemCount: 0, totalQty: 0, totalAmount: 0, hasExistingReport: false };
  }
  const [y, m] = reportMonth.split("-").map(Number);
  const monthStart = new Date(y!, m! - 1, 1);
  const nextMonth  = new Date(y!, m!, 1);

  const [invoices, existing] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status:    { in: ["ISSUED", "SENT"] },
        issueDate: { gte: monthStart, lt: nextMonth },
        client:    { type: "HOSPITAL" },
      },
      include: { items: true },
    }),
    prisma.udiReport.findUnique({ where: { reportMonth }, select: { id: true } }),
  ]);

  const hospitalCount = new Set(invoices.map((i) => i.clientId)).size;
  let itemCount = 0;
  let totalQty = 0;
  let totalAmount = 0;
  for (const inv of invoices) {
    for (const it of inv.items) {
      itemCount += 1;
      totalQty += it.quantity;
      totalAmount += Number(it.amount);
    }
  }
  return {
    reportMonth,
    hospitalCount,
    itemCount,
    totalQty,
    totalAmount,
    hasExistingReport: !!existing,
  };
}

/** DRAFT 상태 보고서 삭제 (실수 정정용) */
export async function deleteUdiReport(id: string): Promise<ActionResult<{ id: string }>> {
  await requireRole("TENANT_OWNER", "ADMIN");
  const r = await prisma.udiReport.findUnique({ where: { id }, select: { id: true, status: true, reportMonth: true } });
  if (!r) return fail("보고서를 찾을 수 없습니다");
  if (r.status !== "DRAFT") return fail(`${r.status} 상태 보고서는 삭제할 수 없습니다 (DRAFT 만 가능)`);
  await prisma.udiReport.delete({ where: { id } });
  await logAudit({ action: "UDI_REPORT_DELETE", resource: `UdiReport:${id}`, metadata: { reportMonth: r.reportMonth } });
  revalidatePath("/admin/udi");
  return ok({ id });
}

/**
 * 월별 병원 납품 자동 집계 → UDI 보고서 생성
 *  - ISSUED+SENT Invoice 의 HOSPITAL 거래처 라인 집계
 *  - 이미 보고서 있으면 fail
 */
export async function createUdiReportFromInvoices(
  input: z.input<typeof createUdiReportSchema>,
): Promise<ActionResult<{ id: string; itemCount: number }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = createUdiReportSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "검증 실패");

  const existing = await prisma.udiReport.findUnique({ where: { reportMonth: parsed.data.reportMonth } });
  if (existing) return fail(`${parsed.data.reportMonth} 보고서가 이미 존재합니다 (id: ${existing.id})`);

  // 해당 월 ISSUED+SENT 거래명세서 (HOSPITAL 만)
  const [y, m] = parsed.data.reportMonth.split("-").map(Number);
  const monthStart = new Date(y!, m! - 1, 1);
  const nextMonth  = new Date(y!, m!,     1);

  const invoices = await prisma.invoice.findMany({
    where: {
      status:    { in: ["ISSUED", "SENT"] },
      issueDate: { gte: monthStart, lt: nextMonth },
      client:    { type: "HOSPITAL" },
    },
    include: {
      client: { select: { id: true, businessNumber: true } },
      items:  true,
    },
  });

  // UdiReportItem 데이터 빌드
  const items = invoices.flatMap((inv) =>
    inv.items.map((it) => ({
      clientId:    inv.clientId,
      bizNumber:   inv.client.businessNumber ?? "",
      productId:   null as string | null,
      udiCode:     it.id, // 실개발 시 productSize → UDI-DI 14자리 변환
      productName: it.description,
      spec:        null as string | null,
      qty:         it.quantity,
      unitPrice:   it.unitPrice,
      totalAmount: it.amount,
    })),
  );

  const totalAmount = items.reduce((s, i) => s + Number(i.totalAmount), 0);

  const report = await prisma.udiReport.create({
    data: {
      reportMonth: parsed.data.reportMonth,
      status:      "DRAFT",
      totalItems:  items.length,
      totalAmount: totalAmount.toString(),
      note:        parsed.data.note,
      createdBy:   user.id,
      items: { create: items.map((i) => ({ ...i, unitPrice: i.unitPrice.toString(), totalAmount: i.totalAmount.toString() })) },
    },
  });
  await logAudit({ action: "UDI_REPORT_CREATE", resource: `UdiReport:${report.id}`, metadata: { itemCount: items.length, reportMonth: parsed.data.reportMonth } });
  revalidatePath("/admin/udi");
  return ok({ id: report.id, itemCount: items.length });
}

/** 식약처 전송 — receiptNo mock 생성 (실개발 시 외부 API 연동) */
export async function submitUdiReport(id: string): Promise<ActionResult<{ receiptNo: string }>> {
  await requireRole("TENANT_OWNER", "ADMIN");

  const report = await prisma.udiReport.findUnique({ where: { id } });
  if (!report) return fail("보고서를 찾을 수 없습니다");
  if (report.status !== "DRAFT") return fail("DRAFT 상태만 전송 가능");

  // Mock 접수번호: UDI-YYMMDD-NNNN
  const now = new Date();
  const dt = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const receiptNo = `UDI-${dt}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

  await prisma.udiReport.update({
    where: { id },
    data: { status: "ACCEPTED", receiptNo, submittedAt: now },
  });
  await logAudit({ action: "UDI_REPORT_SUBMIT", resource: `UdiReport:${id}`, metadata: { receiptNo } });
  revalidatePath("/admin/udi");
  return ok({ receiptNo });
}
