/**
 * 매뉴얼·절차서·양식 카탈로그 — 경영지원 포털
 */
export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/session";
import { listQualityDocuments, listQualityCategories } from "@/lib/actions/quality-document";
import { QDOC_KIND_LABEL } from "@/lib/validators/quality-document";
import { PageHeader } from "@/components/shared/PageHeader";

type SearchParams = {
  kind?: string;
  category?: string;
  q?: string;
};

export default async function ManualsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");

  const kind = (searchParams.kind === "MANUAL" || searchParams.kind === "PROCEDURE" || searchParams.kind === "FORM")
    ? searchParams.kind
    : undefined;

  let docs: Awaited<ReturnType<typeof listQualityDocuments>> = [];
  let categories: Awaited<ReturnType<typeof listQualityCategories>> = [];
  try {
    [docs, categories] = await Promise.all([
      listQualityDocuments({ kind, category: searchParams.category, q: searchParams.q }),
      listQualityCategories(),
    ]);
  } catch (e) {
    console.warn("[ManualsPage] DB 접근 실패 — 마이그레이션 필요:", (e as Error).message);
  }

  // kind 별 그룹화
  const byKind = {
    MANUAL:    docs.filter((d) => d.kind === "MANUAL"),
    PROCEDURE: docs.filter((d) => d.kind === "PROCEDURE"),
    FORM:      docs.filter((d) => d.kind === "FORM"),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="📚 매뉴얼 · 절차서 · 양식"
        subtitle="ISO 13485 품질경영 문서 카탈로그입니다. 우측 하단 🤖 AI 어시스턴트로 자연어 검색도 가능합니다."
      />

      {/* 분류 통계 */}
      <section className="grid grid-cols-3 gap-3">
        <CategoryStat label="매뉴얼"   count={byKind.MANUAL.length}   variant="primary" />
        <CategoryStat label="절차서"   count={byKind.PROCEDURE.length} variant="accent" />
        <CategoryStat label="양식"     count={byKind.FORM.length}      variant="success" />
      </section>

      {/* 카테고리 칩 */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-tiny text-ink-secondary font-semibold">카테고리:</span>
          {categories.map((c) => (
            <span key={c.category} className="px-2 py-0.5 rounded-full text-tiny bg-canvas border border-border text-ink-secondary">
              {c.category} ({c.count})
            </span>
          ))}
        </div>
      )}

      {/* 문서 목록 (3구역) */}
      {(["MANUAL", "PROCEDURE", "FORM"] as const).map((k) =>
        byKind[k].length > 0 && (
          <section key={k} className="bg-surface border border-border rounded">
            <h2 className="text-h3 px-5 py-3 border-b border-border m-0">
              {QDOC_KIND_LABEL[k]} <span className="text-tiny text-ink-muted ml-2">{byKind[k].length}건</span>
            </h2>
            <ul className="divide-y divide-border">
              {byKind[k].map((d) => (
                <li key={d.id} className="flex items-center px-5 py-3 text-caption hover:bg-canvas transition">
                  <span className="font-mono text-tiny font-semibold text-primary w-20">{d.code}</span>
                  <span className="flex-1 text-ink">{d.title}</span>
                  {d.category && <span className="text-tiny text-ink-muted mr-3">{d.category}</span>}
                  {d.revision && <span className="text-tiny font-mono text-ink-muted">Rev.{d.revision}</span>}
                  {d.filePath && (
                    <a href={d.filePath} target="_blank" className="ml-3 text-tiny text-primary hover:underline">
                      📥 다운로드
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      )}

      {docs.length === 0 && (
        <div className="bg-surface border border-border rounded p-12 text-center text-ink-muted">
          등록된 문서가 없습니다.
        </div>
      )}
    </div>
  );
}

function CategoryStat({ label, count, variant }: { label: string; count: number; variant: "primary" | "accent" | "success" }) {
  const bg = variant === "primary" ? "bg-primary" : variant === "accent" ? "bg-accent" : "bg-success";
  return (
    <div className="bg-surface border border-border rounded shadow-sm p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${bg}`} />
      <div className="pl-2">
        <div className="text-tiny text-ink-secondary uppercase font-semibold">{label}</div>
        <div className="text-3xl font-bold tabular-nums">{count}</div>
      </div>
    </div>
  );
}
