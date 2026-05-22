/**
 * CEO 대시보드 위젯 편집 — Phase 3G-4 (R24) → 2026-05-22 UI 재작성.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  getAllPresets,
  listMyWidgets,
} from "@/lib/actions/widget-dashboard";
import { WidgetCustomizer } from "@/components/ceo/WidgetCustomizer";

export default async function CeoCustomizePage() {
  await requireRole("TENANT_OWNER", "ADMIN", "SUPER_ADMIN");
  const [widgets, allPresets] = await Promise.all([
    listMyWidgets(),
    getAllPresets(),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <div className="text-tiny text-ink-muted mb-1">
          <Link href="/ceo" className="text-primary hover:underline">
            ← 대시보드로 돌아가기
          </Link>
        </div>
        <h1 className="text-display m-0">⚙️ 위젯 편집</h1>
        <p className="text-caption text-ink-secondary mt-1">
          프리셋에서 선택하여 대시보드를 구성합니다. 순서/크기/기간 override 는
          즉시 저장됩니다.
        </p>
      </header>

      <WidgetCustomizer widgets={widgets} allPresets={allPresets} />
    </div>
  );
}
