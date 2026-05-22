"use server";

/**
 * QualityDocument — ISO 13485 매뉴얼/절차서/양식 카탈로그
 * (51건: 매뉴얼 1, 절차서 16, 양식 34)
 */
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { z } from "zod";
import type { QualityDocKind } from "@prisma/client";

const KIND_VALUES = ["MANUAL", "PROCEDURE", "FORM"] as const;

// QDOC_KIND_LABEL 은 lib/validators/quality-document.ts 에 분리

const upsertSchema = z.object({
  id:          z.string().cuid().optional(),
  code:        z.string().trim().min(1).max(40),
  title:       z.string().trim().min(1).max(200),
  kind:        z.enum(KIND_VALUES),
  category:    z.string().max(100).optional().nullable(),
  revision:    z.string().max(40).optional().nullable(),
  effectiveAt: z.coerce.date().optional().nullable(),
  filePath:    z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  active:      z.boolean().default(true),
});

export async function listQualityDocuments(opts?: {
  kind?: QualityDocKind;
  category?: string;
  q?: string;
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  return prisma.qualityDocument.findMany({
    where: {
      active: true,
      ...(opts?.kind && { kind: opts.kind }),
      ...(opts?.category && { category: opts.category }),
      ...(opts?.q && {
        OR: [
          { title: { contains: opts.q, mode: "insensitive" } },
          { code:  { contains: opts.q, mode: "insensitive" } },
          { description: { contains: opts.q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [{ kind: "asc" }, { code: "asc" }],
  });
}

export async function listQualityCategories() {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  const rows = await prisma.qualityDocument.groupBy({
    by: ["category"],
    where: { active: true, category: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
  });
  return rows.map((r) => ({ category: r.category!, count: r._count._all }));
}

export async function upsertQualityDocument(input: z.input<typeof upsertSchema>): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("TENANT_OWNER", "ADMIN");
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "검증 실패");
  const { id, ...data } = parsed.data;

  if (id) {
    await prisma.qualityDocument.update({ where: { id }, data });
    await logAudit({ action: "QUALITY_DOC_UPDATE", resource: `QualityDocument:${id}` });
    revalidatePath("/admin/manuals");
    return ok({ id });
  } else {
    const doc = await prisma.qualityDocument.create({
      data: { ...data, createdBy: user.id },
    });
    await logAudit({ action: "QUALITY_DOC_CREATE", resource: `QualityDocument:${doc.id}` });
    revalidatePath("/admin/manuals");
    return ok({ id: doc.id });
  }
}

export async function deleteQualityDocument(id: string): Promise<ActionResult<{ id: string }>> {
  await requireRole("TENANT_OWNER", "ADMIN");
  await prisma.qualityDocument.update({ where: { id }, data: { active: false } });
  await logAudit({ action: "QUALITY_DOC_DELETE", resource: `QualityDocument:${id}` });
  revalidatePath("/admin/manuals");
  return ok({ id });
}

/** AI 어시스턴트용 검색 (외부 노출) */
export async function searchQualityDocuments(query: string, limit = 10) {
  if (!query.trim()) return [];
  return prisma.qualityDocument.findMany({
    where: {
      active: true,
      OR: [
        { title:       { contains: query, mode: "insensitive" } },
        { code:        { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { category:    { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: [{ kind: "asc" }, { code: "asc" }],
  });
}
