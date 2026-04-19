/**
 * CEO 대시보드 위젯 편집 — Phase 3G-4 (R24).
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import {
  getAllPresets,
  listMyWidgets,
} from "@/lib/actions/widget-dashboard";
import { WidgetCustomizer } from "@/components/ceo/WidgetCustomizer";

export default async function CeoCustomizePage() {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "SUPER_ADMIN");
  const [widgets, allPresets] = await Promise.all([
    listMyWidgets(),
    Promise.resolve(getAllPresets()),
  ]);

  return (
    <>
      <TopBar portal="임원진" userName={user.name} role={user.role} />
      <main className="p-8 max-w-5xl mx-auto space-y-6">
        <header>
          <div className="text-xs text-slate-500 mb-1">
            <Link href="/ceo" className="hover:underline">
              ← 대시보드로 돌아가기
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">위젯 편집</h1>
          <p className="text-sm text-slate-500 mt-1">
            프리셋에서 선택하여 대시보드를 구성합니다. 순서/크기/기간 override 는
            즉시 저장됩니다.
          </p>
        </header>

        <WidgetCustomizer widgets={widgets} allPresets={allPresets} />
      </main>
    </>
  );
}
