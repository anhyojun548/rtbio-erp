/**
 * CEO 대시보드 — Phase 3G-4 (R24) → 2026-05-22 UI 재작성.
 *
 * 로그인 유저의 DashboardWidget 레이아웃을 그리드로 렌더링.
 * 첫 방문(위젯 0건)이면 "기본 레이아웃 추가" CTA 노출.
 *
 * TopBar/Sidebar 는 layout.tsx 의 PortalShell 이 처리하므로 본 페이지는 본문만.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getMyDashboard } from "@/lib/actions/widget-dashboard";
import { WidgetCard } from "@/components/ceo/WidgetCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/shared/Button";

export default async function CeoHome() {
  await requireRole("TENANT_OWNER", "ADMIN", "SUPER_ADMIN");
  const { widgets, values } = await getMyDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="임원진 대시보드"
        subtitle="내 위젯을 자유롭게 구성하세요 (R24). 각 카드를 클릭하면 상세 페이지로 이동합니다."
        actions={
          <Button href="/ceo/customize" variant="primary" icon={<span>⚙️</span>}> 위젯 편집
          </Button> }
      /> {widgets.length === 0 ? (
        <div className="rounded border-2 border-dashed border-border bg-surface p-12 text-center">
          <div className="text-4xl mb-3"></div>
          <div className="text-h3 font-semibold text-ink"> 아직 위젯이 없습니다.
          </div>
          <p className="text-caption text-ink-secondary mt-1"> 위젯 편집에서 기본 레이아웃을 추가해보세요.
          </p>
          <Button href="/ceo/customize" variant="primary" className="mt-4"> 편집으로 이동 →
          </Button>
        </div> ) : (
        <div className="grid grid-cols-12 gap-4"> {widgets.map((w) => {
            const v = values[w.preset];
            const span = Math.min(12, Math.max(1, w.width));
            return (
              <div
                key={w.id}
                style={{ gridColumn: `span ${span} / span ${span}` }}
                className="min-h-[120px]"
              >
                <WidgetCard
                  value={v}
                  fallbackLabel={w.meta?.label ?? w.preset}
                />
              </div> );
          })}
        </div> )}
    </div> );
}
