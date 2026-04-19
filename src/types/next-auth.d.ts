/**
 * NextAuth.js 타입 확장 — 세션·JWT에 tenantId, role, userId, clientId 필드 추가.
 * 이 파일은 @types 가 아닌 프로젝트 전체 ambient 로 선언되어야 함.
 */
import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      tenantId: string | null;
      tenantCode: string | null;
      clientId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: UserRole;
    tenantId: string | null;
    tenantCode: string | null;
    clientId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: UserRole;
    tenantId: string | null;
    tenantCode: string | null;
    clientId: string | null;
  }
}
