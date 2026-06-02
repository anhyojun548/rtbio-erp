/**
 * Flowise 등 외부 에이전트용 API 토큰 인증.
 * - 토큰은 WIDGET_API_TOKEN env (미설정 시 기능 비활성 — 안전 기본값).
 * - 상수시간 비교로 타이밍 공격 완화.
 * - 토큰 인증 요청은 SERVICE_PRINCIPAL(고정 서비스 유저)로 동작.
 */
export const SERVICE_PRINCIPAL = {
  userId: "svc-integration",
  role: "ADMIN" as const,
  tenantCode: "altibio",
  tenantId: null as string | null,
  clientId: null as string | null,
  isTeamAdmin: true,
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isValidApiToken(authHeader: string | null): boolean {
  const expected = process.env.WIDGET_API_TOKEN;
  if (!expected) return false; // 미설정 = 비활성
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const provided = authHeader.slice("Bearer ".length);
  if (!provided) return false;
  return timingSafeEqual(provided, expected);
}

/** 토큰 인증 요청이 호출 가능한 쓰기 경로 (위젯 생성만). */
export function isTokenWriteAllowed(method: string, pathname: string): boolean {
  if (method === "GET" || method === "HEAD") return true;
  return pathname === "/api/dashboard/widgets/spec";
}
