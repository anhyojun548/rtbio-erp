"use client";

/**
 * 즉시 로그아웃 링크 — NextAuth 기본 "정말 로그아웃?" 확인 페이지를 건너뛴다.
 * (GET /api/auth/signout 은 확인 페이지를 띄우므로, 클라이언트 signOut() 으로 바로 POST.)
 */
import { signOut } from "next-auth/react";

export function SignOutLink({
  className,
  children = "로그아웃",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={`cursor-pointer border-0 bg-transparent p-0 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
