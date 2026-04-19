/**
 * CEO 대시보드 — Phase 3G-4 (R24).
 *
 * 로그인 유저의 DashboardWidget 레이아웃을 그리드로 렌더링한다.
 * 첫 방문(위젯 0건) 이면 "기본 레이아웃 추가" CTA 노출.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { getMyDashboard } from "@/lib/actions/widget-dashboard";
import { WidgetCard } from "@/components/ceo/WidgetCard";

export default async function CeoHome() {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "SUPER_ADMIN");
  const { widgets, values } = await getMyDashboard();

  return (
    <>
      <TopBar portal="임원진" userName={user.name} role={user.role} />
      <main className="p-8 max-w-7xl mx-auto space-y-6">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">임원진 대시보드</h1>
            <p className="text-sm text-slate-500 mt-1">
              내 위젯을 자유롭게 구성하세요 (R24). 각 카드를 클릭하면 상세
              페이지로 이동합니다.
            </p>
          </div>
          <Link
            href="/ceo/customize"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            ⚙️ 위젯 편집
          </Link>
        </header>

        {widgets.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-slate-700 font-medium">
              아직 위젯이 없습니다.
            </div>
            <p className="text-sm text-slate-500 mt-1">
              위젯 편집에서 기본 레이아웃을 추가해보세요.
            </p>
            <Link
              href="/ceo/customize"
              className="inline-block mt-4 rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700"
            >
              편집으로 이동
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {widgets.map((w) => {
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
                    fallbackIcon={w.meta?.icon}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
