/**
 * NextAuth 시크릿 단일 소스 — auth.ts 와 middleware.ts 가 반드시 동일 값을 써야 하므로 분리.
 *
 * 보안 정책 (실서비스):
 *  - 운영(NODE_ENV=production)에서는 `NEXTAUTH_SECRET` 환경변수가 **필수**.
 *  - 미설정 시 약한 폴백을 조용히 쓰지 않는다(취약점) → undefined 반환.
 *    · auth.ts: NextAuth 가 자체적으로 "secret 누락" 에러를 던져 fail-loud.
 *    · middleware: getToken 이 토큰 검증 실패 → 로그인 유도(인증 우회 없음).
 *  - 개발(dev)에서만 로컬 편의를 위한 폴백 허용.
 *
 * 생성: `openssl rand -base64 32`
 */
const DEV_FALLBACK =
  "dev-only-change-in-prod-d8f3a1b9c7e5f2d4a6b8c0e1f3d5a7b9c1e3d5f7a9b1c3e5d7f9a1b3c5e7d9";

export function getAuthSecret(): string | undefined {
  const s = process.env.NEXTAUTH_SECRET;
  if (s && s.length > 0) return s;
  // 운영에서는 폴백 금지 (약한 시크릿 무음 사용 방지)
  return process.env.NODE_ENV !== "production" ? DEV_FALLBACK : undefined;
}
