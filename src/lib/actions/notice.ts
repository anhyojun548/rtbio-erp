"use server";

/**
 * Notice 서버 액션 — Phase 5 (2026-05-22)
 *
 * 4개 포털에서 공지 발송 + 거래처에서 수신/읽음 처리.
 *
 * 권한:
 *   - 발송: TENANT_OWNER / ADMIN / EXEC / QC / SUPER_ADMIN (각 팀별)
 *   - 조회: TENANT_OWNER / ADMIN / EXEC / QC + CLIENT (본인 대상만)
 *   - 삭제: 작성자 본인 또는 TENANT_OWNER / ADMIN
 */
import { prisma } from "@/lib/prisma";
import { requireAuth, requireClient, requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ok, fail, zodFail, type ActionResult } from "@/lib/action-result";
import {
  createNoticeSchema,
  updateNoticeSchema,
  markReadSchema,
  isExpired,
  type CreateNoticeInput,
  type UpdateNoticeInput,
  type MarkReadInput,
  type NoticeAuthorTeam,
  type NoticeTargetType,
  type NoticePriorityType,
} from "@/lib/validators/notice";

/**
 * 공지 목록 조회 (내부 4포털 — 전체 공지 조회)
 */
export async function listNotices(opts?: {
  authorTeam?: NoticeAuthorTeam;
  target?: NoticeTargetType;
  priority?: NoticePriorityType;
  q?: string;
  limit?: number;
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC", "SUPER_ADMIN");
  const where: Record<string, unknown> = {};
  if (opts?.authorTeam) where.createdByTeam = opts.authorTeam;
  if (opts?.target) where.target = opts.target;
  if (opts?.priority) where.priority = opts.priority;
  if (opts?.q) {
    where.OR = [
      { title: { contains: opts.q, mode: "insensitive" as const } },
      { body:  { contains: opts.q, mode: "insensitive" as const } },
    ];
  }

  return prisma.notice.findMany({
    where,
    include: {
      recipients: { select: { clientId: true, client: { select: { id: true, code: true, name: true, type: true } } } },
      _count: { select: { readLogs: true, recipients: true } },
    },
    orderBy: [{ pinned: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: opts?.limit ?? 100,
  });
}

/**
 * 공지 상세 조회
 */
export async function getNotice(id: string) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC", "SUPER_ADMIN");
  return prisma.notice.findUnique({
    where: { id },
    include: {
      recipients: { include: { client: { select: { id: true, code: true, name: true, type: true } } } },
      readLogs: { include: { client: { select: { id: true, code: true, name: true } } } },
    },
  });
}

/**
 * 공지 생성 — 작성자 팀(authorTeam)은 호출 측에서 명시.
 *
 * 예: 영업팀 포털에서 발송 → authorTeam = "영업팀"
 */
export async function createNotice(
  authorTeam: NoticeAuthorTeam,
  input: CreateNoticeInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();

  const parsed = createNoticeSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const data = parsed.data;

  // SPECIFIC 일 때 대상 거래처 검증 (활성 거래처만)
  if (data.target === "SPECIFIC") {
    const cnt = await prisma.client.count({
      where: { id: { in: data.targetClientIds }, active: true },
    });
    if (cnt !== data.targetClientIds.length) {
      return fail("선택한 거래처 중 일부가 비활성/없음 상태입니다");
    }
  }

  const notice = await prisma.notice.create({
    data: {
      title:     data.title,
      body:      data.body,
      target:    data.target,
      priority:  data.priority,
      pinned:    data.pinned,
      expiresAt: data.expiresAt,
      createdBy: user.id,
      createdByTeam: authorTeam,
      recipients: data.target === "SPECIFIC"
        ? { create: data.targetClientIds.map((cid) => ({ clientId: cid })) }
        : undefined,
    },
  });

  await logAudit({
    action: "NOTICE_CREATE",
    resource: `Notice:${notice.id}`,
    metadata: { authorTeam, target: data.target, priority: data.priority, recipientsCount: data.targetClientIds.length },
  });
  revalidatePath("/admin/notices");
  revalidatePath("/exec/notices");
  revalidatePath("/qc/notices");
  revalidatePath("/ceo/notices");
  revalidatePath("/client");
  return ok({ id: notice.id });
}

/**
 * 공지 수정 (title/body/priority/pinned/expiresAt — target/recipient 는 불변)
 */
export async function updateNotice(input: UpdateNoticeInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const parsed = updateNoticeSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { id, ...rest } = parsed.data;

  // 작성자 본인 또는 ADMIN/TENANT_OWNER 만 수정 가능
  const existing = await prisma.notice.findUnique({ where: { id }, select: { createdBy: true } });
  if (!existing) return fail("공지를 찾을 수 없습니다");
  const isOwner = existing.createdBy === user.id;
  const isAdmin = user.role === "ADMIN" || user.role === "TENANT_OWNER";
  if (!isOwner && !isAdmin) return fail("수정 권한이 없습니다");

  await prisma.notice.update({ where: { id }, data: rest });
  await logAudit({ action: "NOTICE_UPDATE", resource: `Notice:${id}`, metadata: rest });
  revalidatePath("/admin/notices");
  return ok({ id });
}

/**
 * 공지 삭제 (Cascade 로 recipients/readLogs 도 자동 삭제)
 */
export async function deleteNotice(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const existing = await prisma.notice.findUnique({ where: { id }, select: { createdBy: true, createdByTeam: true } });
  if (!existing) return fail("공지를 찾을 수 없습니다");
  const isOwner = existing.createdBy === user.id;
  const isAdmin = user.role === "ADMIN" || user.role === "TENANT_OWNER";
  if (!isOwner && !isAdmin) return fail("삭제 권한이 없습니다");

  await prisma.notice.delete({ where: { id } });
  await logAudit({ action: "NOTICE_DELETE", resource: `Notice:${id}`, metadata: { authorTeam: existing.createdByTeam } });
  revalidatePath("/admin/notices");
  return ok({ id });
}

// ============================================================
// 거래처 포털용
// ============================================================

/**
 * 내(거래처) 공지 목록 — 만료된 공지 제외, 우선순위순.
 *  - readLogs 에 본인 거래처 read 기록 포함 (읽음 여부)
 */
export async function listMyNotices(opts?: { limit?: number }) {
  const user = await requireClient();
  const clientId = user.clientId;

  // 거래처 유형 확인 (DEALER/HOSPITAL 필터링용)
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, type: true },
  });
  if (!client) return [];

  const now = new Date();
  // target 필터링: ALL / 우리 type / SPECIFIC + recipient 포함
  const targetTypeMatch = client.type === "AGENCY" ? "DEALER" : client.type === "HOSPITAL" ? "HOSPITAL" : null;

  const notices = await prisma.notice.findMany({
    where: {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
      AND: [
        {
          OR: [
            { target: "ALL" },
            ...(targetTypeMatch ? [{ target: targetTypeMatch as "DEALER" | "HOSPITAL" }] : []),
            { target: "SPECIFIC", recipients: { some: { clientId } } },
          ],
        },
      ],
    },
    include: {
      readLogs: { where: { clientId } },
    },
    orderBy: [{ pinned: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: opts?.limit ?? 50,
  });

  return notices.map((n) => ({
    ...n,
    isRead: n.readLogs.length > 0,
    dontShowAgain: n.readLogs[0]?.dontShowAgain ?? false,
  }));
}

/**
 * 거래처가 공지를 읽음 처리
 *  - dontShowAgain=true → 다음 로그인 시 팝업 안 뜸
 */
export async function markNoticeRead(input: MarkReadInput): Promise<ActionResult<{ noticeId: string }>> {
  const user = await requireClient();
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  await prisma.noticeReadLog.upsert({
    where: { noticeId_clientId: { noticeId: parsed.data.noticeId, clientId: user.clientId } },
    create: {
      noticeId: parsed.data.noticeId,
      clientId: user.clientId,
      dontShowAgain: parsed.data.dontShowAgain,
    },
    update: { dontShowAgain: parsed.data.dontShowAgain, readAt: new Date() },
  });

  await logAudit({
    action: "NOTICE_READ",
    resource: `Notice:${parsed.data.noticeId}`,
    metadata: { clientId: user.clientId, dontShowAgain: parsed.data.dontShowAgain },
  });
  revalidatePath("/client");
  return ok({ noticeId: parsed.data.noticeId });
}

/**
 * 거래처 로그인 시 미읽음 + 우선순위 1건 팝업용
 */
export async function getNextUnreadNotice() {
  const notices = await listMyNotices({ limit: 50 });
  const unread = notices.filter((n) => !n.isRead && !n.dontShowAgain);
  return unread[0] ?? null;
}
