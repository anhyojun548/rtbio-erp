/**
 * 학회 상세 — Phase 3F-3 (R21).
 *
 * 상단: 학회 기본정보 편집 폼
 * 하단: 방문자 테이블 (인라인 CRUD)
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import {
  getConference,
  listAssignableReps,
} from "@/lib/actions/conference";
import { ConferenceForm } from "@/components/exec/conferences/ConferenceForm";
import { VisitorPanel } from "@/components/exec/conferences/VisitorPanel";

function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  const iso = new Date(d).toISOString();
  return iso.slice(0, 10);
}

export default async function ConferenceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  const [conf, reps] = await Promise.all([
    getConference(params.id),
    listAssignableReps(),
  ]);
  if (!conf) notFound();

  const visitors = conf.visitors.map((v) => ({
    id: v.id,
    name: v.name,
    phone: v.phone,
    affiliation: v.affiliation,
    assignedRepId: v.assignedRepId,
    contactStatus: v.contactStatus,
    note: v.note,
    createdAt: v.createdAt.toISOString(),
  }));

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <div className="text-xs text-slate-500 mb-1">
          <Link
            href="/exec/conferences"
            className="hover:text-sky-700 hover:underline"
          >
            ← 학회 목록
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{conf.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              방문자 <strong className="text-slate-800">{visitors.length}</strong>명 ·
              등록일 {new Date(conf.createdAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">학회 정보</h2>
        <ConferenceForm
          mode="edit"
          initial={{
            id: conf.id,
            name: conf.name,
            location: conf.location,
            startDate: toDateInput(conf.startDate),
            endDate: toDateInput(conf.endDate),
            note: conf.note,
          }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">방문자 명단</h2>
        <VisitorPanel
          conferenceId={conf.id}
          initialVisitors={visitors}
          reps={reps}
        />
      </section>
    </div>
  );
}
