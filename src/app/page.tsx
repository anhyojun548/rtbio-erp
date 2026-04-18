import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import type { UserRole } from "@prisma/client";

/**
 * 홈 — 로그인 상태면 역할별 기본 포털로 리다이렉트, 아니면 랜딩 표시.
 */
const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: "/system",
  TENANT_OWNER: "/ceo",
  ADMIN: "/admin",
  QC: "/qc",
  EXEC: "/exec",
  CLIENT: "/client",
  VIEWER: "/admin",
};

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(ROLE_HOME[user.role]);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-2xl space-y-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <header>
          <h1 className="text-3xl font-bold text-rtbio-primary">RTBIO ERP</h1>
          <p className="mt-2 text-sm text-slate-500">
            알티바이오 ERP · Phase 2 (인증·RBAC) 진행 중
          </p>
        </header>

        <section className="space-y-2">
          <p className="text-sm text-slate-600">
            시스템 이용을 위해 먼저 로그인해주세요.
          </p>
          <Link
            href="/login"
            className="inline-block h-10 px-6 leading-10 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md transition"
          >
            로그인
          </Link>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">포털</h2>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>경영지원 (/admin) · 품질관리 (/qc) · 영업 (/exec)</li>
            <li>거래처 (/client) · 임원진 (/ceo)</li>
          </ul>
        </section>

        <footer className="border-t pt-4 text-xs text-slate-400">
          계약 기준: 과업내용서 상세 2026-04-17 · Phase 2 진행 중
        </footer>
      </div>
    </main>
  );
}
