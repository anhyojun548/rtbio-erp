import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

export default async function ForbiddenPage() {
  const user = await getCurrentUser();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="text-5xl">🚫</div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900">접근 권한이 없습니다</h1>
          <p className="text-sm text-slate-500">
            {user
              ? `현재 역할 (${user.role}) 로 해당 포털에 접근할 수 없습니다.`
              : "로그인이 필요합니다."}
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Link
            href="/"
            className="h-9 px-4 leading-9 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm rounded-md"
          >
            홈으로
          </Link>
          {!user && (
            <Link
              href="/login"
              className="h-9 px-4 leading-9 bg-sky-600 hover:bg-sky-700 text-white text-sm rounded-md"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
