import { PageHeader } from "@/components/shared/PageHeader";

/** 준비 중 — Phase 6+ 에서 구현 예정 */
export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="세금계산서"
        subtitle="이 화면은 다음 단계에서 구현 예정입니다."
      />
      <div className="bg-surface border border-border rounded p-12 text-center">
        <div className="text-4xl mb-3"></div>
        <div className="text-h3 text-ink">준비 중인 기능입니다.</div>
        <p className="text-caption text-ink-secondary mt-2"> 담당자에게 우선순위 의견을 보내주시면 다음 스프린트에 포함합니다.
        </p>
      </div>
    </div> );
}
