/**
 * 신규 학회 등록 — Phase 3F-3.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { ConferenceForm } from "@/components/exec/conferences/ConferenceForm";

export default async function NewConferencePage() {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <div className="text-tiny text-ink-muted mb-1">
          <Link href="/exec/conferences" className="text-primary hover:underline">
            ← 학회 목록
          </Link>
        </div>
        <h1 className="text-display m-0">🎓 신규 학회 등록</h1>
        <p className="text-caption text-ink-secondary mt-1">
          학회 정보를 입력하세요. 저장 후 방문자를 추가할 수 있습니다.
        </p>
      </header>

      <ConferenceForm mode="create" />
    </div>
  );
}
