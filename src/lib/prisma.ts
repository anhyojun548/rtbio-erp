import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client 싱글톤.
 * Next.js dev 서버 HMR 시 여러 인스턴스 생성 방지.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
