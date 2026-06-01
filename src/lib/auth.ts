/**
 * NextAuth.js 설정 (Credentials + JWT 세션)
 *
 * 도메인 규칙:
 * - 세션에 tenantId/role 을 반드시 주입 → 이후 미들웨어·서버 컴포넌트·API에서 바로 사용
 * - SUPER_ADMIN 은 tenantId null 허용
 * - 비밀번호는 bcrypt hash (User.password) — R11 부서별 권한의 기반
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

const DEV_SECRET =
  "dev-only-change-in-prod-d8f3a1b9c7e5f2d4a6b8c0e1f3d5a7b9c1e3d5f7a9b1c3e5d7f9a1b3c5e7d9";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 /* 8h */ },
  secret: process.env.NEXTAUTH_SECRET ?? DEV_SECRET,
  pages: { signIn: "/login", error: "/login" },

  providers: [
    CredentialsProvider({
      name: "Email+Password",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: true },
        });
        if (!user || !user.active) return null;

        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;

        // 로그인 시각 갱신 (감사용)
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantCode: user.tenant?.code ?? null,
          clientId: user.clientId ?? null,
          isTeamAdmin: user.isTeamAdmin,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // 로그인 직후에만 user 제공 — 이후 요청은 token 만 존재
      if (user) {
        token.userId = user.id;
        token.role = (user as { role: UserRole }).role;
        token.tenantId = (user as { tenantId: string | null }).tenantId;
        token.tenantCode = (user as { tenantCode: string | null }).tenantCode;
        token.clientId = (user as { clientId: string | null }).clientId ?? null;
        token.isTeamAdmin = (user as { isTeamAdmin: boolean }).isTeamAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.userId as string,
        role: token.role as UserRole,
        tenantId: (token.tenantId as string | null) ?? null,
        tenantCode: (token.tenantCode as string | null) ?? null,
        clientId: (token.clientId as string | null) ?? null,
        isTeamAdmin: (token.isTeamAdmin as boolean) ?? false,
      };
      return session;
    },
  },
};
