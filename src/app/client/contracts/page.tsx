/**
 * 거래처 포털 — 판매 계약서 목록 (읽기 전용).
 */
import Link from "next/link";
import { listMyContracts } from "@/lib/actions/client-portal";
import { classifyContract } from "@/lib/validators/sales-contract";

type SearchParams = { q?: string };

export default async function ClientContractsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = searchParams.q?.trim() || undefined;
  const rows = await listMyContracts({ q, limit: 200 });
  const now = new Date();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0">📝 판매 계약서</h1>
        <p className="text-sm text-slate-500 mt-1">
          체결된 판매 계약서 목록입니다. 계약 문의는 담당 영업사원에게 연락해주세요.
        </p>
      </header>

      <form
        action="/client/contracts"
        method="GET"
        className="rounded-lg border border-slate-200 bg-white p-3 flex gap-2 items-end"
      >
        <div className="flex-1">
          <label className="text-[11px] text-slate-500">검색</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="계약 제목"
            className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-sky-600 text-white text-sm px-4 py-1.5 hover:bg-sky-700"
        >
          조회
        </button>
        <Link
          href="/client/contracts"
          className="rounded-md border border-slate-300 bg-white text-sm px-4 py-1.5 text-slate-700 hover:bg-slate-50"
        >
          초기화
        </Link>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            등록된 계약서가 없습니다.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">제목</th>
                <th className="px-4 py-2 text-left">시작일</th>
                <th className="px-4 py-2 text-left">종료일</th>
                <th className="px-4 py-2 text-left">상태</th>
                <th className="px-4 py-2 text-left">서명</th>
                <th className="px-4 py-2 text-left">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => {
                const { status: stage, daysLeft } = classifyContract(
                  c.startDate,
                  c.endDate,
                  now,
                );
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/client/contracts/${c.id}`}
                        className="text-sky-700 hover:underline"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600 tabular-nums">
                      {new Date(c.startDate).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600 tabular-nums">
                      {c.endDate
                        ? new Date(c.endDate).toLocaleDateString("ko-KR")
                        : "무기한"}
                    </td>
                    <td className="px-4 py-2">
                      <StageBadge stage={stage} daysLeft={daysLeft} />
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {c.signed ? "✅ 서명" : "대기"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {c.pdfUrl ? (
                        <a
                          href={c.pdfUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-sky-700 hover:underline"
                        >
                          📎 열기
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const STAGE_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  ENDING_SOON: "bg-amber-100 text-amber-800",
  EXPIRED: "bg-rose-100 text-rose-800",
  FUTURE: "bg-sky-100 text-sky-800",
};
const STAGE_LABEL: Record<string, string> = {
  ACTIVE: "진행중",
  ENDING_SOON: "만료임박",
  EXPIRED: "종료",
  FUTURE: "예정",
};

function StageBadge({
  stage,
  daysLeft,
}: {
  stage: string;
  daysLeft: number | null;
}) {
  const tone = STAGE_TONE[stage] ?? "bg-slate-100 text-slate-700";
  const label = STAGE_LABEL[stage] ?? stage;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${tone}`}
    >
      {label}
      {daysLeft !== null && stage !== "ACTIVE" && (
        <span className="ml-1 opacity-75">
          {daysLeft >= 0 ? `D-${daysLeft}` : `D+${-daysLeft}`}
        </span>
      )}
    </span>
  );
}
