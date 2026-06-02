"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const urlError = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(urlError ? "로그인에 실패했습니다." : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (!res || res.error) {
      setErr("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    router.push(res.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm bg-surface rounded shadow-md p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-h1 text-primary m-0"> RTBIO ERP</h1>
          <p className="text-caption text-ink-secondary">알티바이오 업무시스템 로그인</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">이메일</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
              placeholder="owner@rtbio.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">비밀번호</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
              placeholder="rtbio1234!"
            />
          </div> {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"> {err}
            </div> )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white text-sm font-medium rounded-md transition"
          > {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="text-xs text-slate-400 text-center space-y-1 pt-2 border-t border-slate-100">
          <p>테스트 계정 (seed)</p>
          <p className="font-mono text-[11px]"> owner/admin/qc/sales1/sales2 @rtbio.com · rtbio1234!
          </p>
        </div>
      </div>
    </div> );
}
