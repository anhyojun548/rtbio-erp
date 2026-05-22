/**
 * 품질관리팀 공지사항 — Phase 5
 */
import { requireRole } from "@/lib/session";
import { listNotices } from "@/lib/actions/notice";
import { listClients } from "@/lib/actions/client";
import { prisma } from "@/lib/prisma";
import { NoticeBoard } from "@/components/shared/notice/NoticeBoard";

export default async function QcNoticesPage() {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");
  const [notices, clients, totalsRaw] = await Promise.all([
    listNotices({ limit: 100 }),
    listClients({ active: "ACTIVE" }),
    prisma.client.groupBy({
      by: ["type"],
      where: { active: true },
      _count: { _all: true },
    }),
  ]);

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
      authorTeam="품질관리팀"
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
