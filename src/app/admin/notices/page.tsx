/**
 * 경영지원팀 공지사항 — Phase 5
 */
export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/session";
import { listNotices } from "@/lib/actions/notice";
import { listClients } from "@/lib/actions/client";
import { prisma } from "@/lib/prisma";
import { NoticeBoard } from "@/components/shared/notice/NoticeBoard";

export default async function AdminNoticesPage() {
  await requireRole("TENANT_OWNER", "ADMIN");
  let notices: Awaited<ReturnType<typeof listNotices>> = [];
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let totalsRaw: { type: string; _count: { _all: number } }[] = [];
  try {
    [notices, clients, totalsRaw] = await Promise.all([
      listNotices({ limit: 100 }),
      listClients({ active: "ACTIVE" }),
      prisma.client.groupBy({
        by: ["type"],
        where: { active: true },
        _count: { _all: true },
      }),
    ]);
  } catch (e) {
    console.warn("[NoticesPage] DB 접근 실패 — 마이그레이션 필요:", (e as Error).message);
  }

  const totals = totalsRaw.reduce(
    (acc, r) => {
      acc.all += r._count._all;
      if (r.type === "AGENCY") acc.dealer = r._count._all;
      if (r.type === "HOSPITAL") acc.hospital = r._count._all;
      return acc;
    },
    { all: 0, dealer: 0, hospital: 0 }
  );

  return (
    <NoticeBoard
      authorTeam="경영지원팀"
      initialNotices={notices.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        target: n.target,
        priority: n.priority,
        pinned: n.pinned,
        createdBy: n.createdBy,
        createdByTeam: n.createdByTeam,
        createdAt: n.createdAt.toISOString(),
        expiresAt: n.expiresAt?.toISOString() ?? null,
        recipients: n.recipients.map((r) => ({ client: r.client })),
        _count: n._count,
      }))}
      clients={clients.map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type }))}
      totalClients={totals}
    />
  );
}
