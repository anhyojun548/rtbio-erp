/**
 * 거래처 포털 — 판매 계약서 상세 (읽기 전용).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyContract } from "@/lib/actions/client-portal";
import { classifyContract } from "@/lib/validators/sales-contract";

export default async function ClientContractDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const c = await getMyContract(params.id);
  if (!c) notFound();

  const { status: stage, daysLeft } = classifyContract(
    c.startDate,
    c.endDate,
    new Date(),
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/client/contracts" className="text-caption text-primary hover:underline">
        ← 계약서 목록
      </Link>

      <header>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-display m-0">📝 {c.title}</h1>
          <StageBadge stage={stage} daysLeft={daysLeft} />
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-3 text-sm">
        <Row
          k="시작일"
          v={new Date(c.startDate).toLocaleDateString("ko-KR")}
        />
        <Row
          k="종료일"
          v={
            c.endDate ? new Date(c.endDate).toLocaleDateString("ko-KR") : "무기한"
          }
        />
        <Row k="서명 여부" v={c.signed ? "✅ 서명 완료" : "서명 대기"} />
        {c.pdfUrl && (
          <div className="flex">
            <dt className="w-28 text-slate-500">PDF</dt>
            <dd className="flex-1">
              <a
                href={c.pdfUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sky-700 hover:underline"
              >
                📎 계약서 PDF 열기
              </a>
            </dd>
          </div>
        )}
        {c.note && (
          <div className="flex">
            <dt className="w-28 text-slate-500">메모</dt>
            <dd className="flex-1 whitespace-pre-wrap">{c.note}</dd>
          </div>
        )}
      </section>

      <footer className="text-xs text-slate-400">
        등록 {new Date(c.createdAt).toLocaleDateString("ko-KR")} · 최종 수정{" "}
        {new Date(c.updatedAt).toLocaleDateString("ko-KR")}
      </footer>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex">
      <dt className="w-28 text-slate-500">{k}</dt>
      <dd className="flex-1 text-slate-800">{v}</dd>
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
