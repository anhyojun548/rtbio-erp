"use client";

/**
 * 클라이언트 SessionProvider wrapper.
 * Server layout 에서 바로 쓰면 "use client" 오염을 막을 수 없어 얇은 래퍼로 분리.
 */
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

export function SessionProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
