/**
 * 감사 로그 (R23) — 모든 중요 변경은 AuditLog 에 기록.
 *
 * 규칙:
 * - 실패해도 메인 로직은 진행 (fire-and-forget 옵션 제공)
 * - tenantId/userId null 허용 (SUPER_ADMIN / 익명 시스템 액션)
 * - resource 는 `"Model:id"` 형식 권장 → 인덱스 검색 효율
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditInput = {
  tenantId?: string | null;
  userId?: string | null;
  action: string; // 예: "ORDER_CREATE", "INVENTORY_ADJUST", "USER_LOGIN"
  resource: string; // 예: "Order:cuid123", "User:cuid456"
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      resource: input.resource,
      metadata: input.metadata ?? Prisma.JsonNull,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

/**
 * fire-and-forget 버전 — 로깅 실패로 메인 플로우가 막히지 않음.
 * Route Handler 에서 try/catch 없이 한 줄로 쓸 수 있다.
 */
export function logAudit(input: AuditInput): void {
  writeAuditLog(input).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[audit] 실패:", input.action, err);
  });
}

/**
 * 요청 정보(IP, UA) 추출 헬퍼. Next.js Request 헤더에서 가져옴.
 */
export function extractRequestMeta(req: {
  headers: Headers | { get(name: string): string | null };
}): { ipAddress: string | null; userAgent: string | null } {
  const get = (name: string) =>
    typeof (req.headers as Headers).get === "function"
      ? (req.headers as Headers).get(name)
      : (req.headers as { get(name: string): string | null }).get(name);

  const forwarded = get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? get("x-real-ip") ?? null;
  const userAgent = get("user-agent");
  return { ipAddress, userAgent };
}
