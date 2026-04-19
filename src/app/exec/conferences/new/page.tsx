/**
 * 신규 학회 등록 — Phase 3F-3.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { ConferenceForm } from "@/components/exec/conferences/ConferenceForm";

export default async function NewConferencePage() {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <header>
        <div className="text-xs text-slate-500 mb-1">
          <Link
            href="/exec/conferences"
            className="hover:text-sky-700 hover:underline"
          >
            ← 학회 목록
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">신규 학회 등록</h1>
        <p className="text-sm text-slate-500 mt-1">
          학회 정보를 입력하세요. 저장 후 방문자를 추가할 수 있습니다.
        </p>
      </header>

      <ConferenceForm mode="create" />
    </div>
  );
}
