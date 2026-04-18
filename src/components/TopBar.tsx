"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export function TopBar({
  portal,
  userName,
  role,
}: {
  portal: string;
  userName: string;
  role: string;
}) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-bold text-slate-900 text-lg">
          RTBIO ERP
        </Link>
        <span className="text-xs px-2 py-0.5 bg-sky-100 text-sky-700 rounded">
          {portal}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-700">{userName}</span>
        <span className="text-xs text-slate-400">({role})</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="h-8 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs rounded-md"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
