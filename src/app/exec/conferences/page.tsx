/**
 * 학회 목록 — Phase 3F-3 (R21).
 *
 * - ?q= 검색 (이름·위치) / ?upcoming=1 오늘 이후만
 * - 우측에 신규 학회 폼 링크
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listConferences } from "@/lib/actions/conference";

type SearchParams = { q?: string; upcoming?: string };

export default async function ConferenceListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");

  const upcomingOnly = searchParams.upcoming === "1";
  const conferences = await listConferences({
    q: searchParams.q,
    upcoming: upcomingOnly || undefined,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display m-0">🎓 학회 방명록</h1>
          <p className="text-caption text-ink-secondary mt-1">
            참여한 학회와 방문자 명단을 관리합니다. 방문자별 담당자 배정 가능.
          </p>
        </div>
        <Link
          href="/exec/conferences/new"
          className="h-9 px-4 inline-flex items-center bg-primary text-white text-caption font-semibold rounded-xs hover:bg-primary-light transition"
        >
          + 신규 학회
        </Link>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
      >
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="학회명·장소 검색"
          className="flex-1 min-w-[14rem] rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            name="upcoming"
            value="1"
            defaultChecked={upcomingOnly}
          />
          예정/진행중만
        </label>
        <button
          type="submit"
          className="rounded-md bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700"
        >
          검색
        </button>
        {(searchParams.q || upcomingOnly) && (
          <Link
            href="/exec/conferences"
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            초기화
          </Link>
        )}
        <span className="ml-auto text-xs text-slate-500 tabular-nums">
          {conferences.length}건
        </span>
      </form>

      {conferences.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          등록된 학회가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {conferences.map((c) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isPast = c.endDate
              ? new Date(c.endDate).getTime() < today.getTime()
              : new Date(c.startDate).getTime() < today.getTime();
            return (
              <Link
                key={c.id}
                href={`/exec/conferences/${c.id}`}
                className={`rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm hover:border-sky-300 transition ${isPast ? "opacity-75" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{c.name}</h3>
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      isPast
                        ? "bg-slate-100 text-slate-500"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {isPast ? "종료" : "예정/진행"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                  <div>📅 {fmtRange(c.startDate, c.endDate)}</div>
                  {c.location && <div>📍 {c.location}</div>}
                  <div className="pt-1 font-medium text-sky-700">
                    방문자 {c._count.visitors}명
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtRange(start: Date, end: Date | null) {
  const s = new Date(start).toLocaleDateString("ko-KR");
  if (!end) return s;
  const e = new Date(end).toLocaleDateString("ko-KR");
  return s === e ? s : `${s} ~ ${e}`;
}
