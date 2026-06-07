/**
 * 어시스턴트 지원 챗봇용 "스코프드 토큰".
 *
 * 목적: 외부 windyflo 에이전트가 RTBIO 데이터를 조회할 때, 공유 ADMIN 토큰
 * (SERVICE_PRINCIPAL) 대신 **로그인한 본인 권한**의 단명(短命) 토큰만 쓰게 한다.
 *
 * 흐름:
 *   1) 포털(로그인 세션) → POST /api/assistant/token → 이 토큰 발급
 *   2) 포털이 windyflo prediction 호출 시 overrideConfig.vars.token 으로 전달
 *   3) windyflo 툴이 Authorization: Bearer <token> 으로 /api/assistant/* 호출
 *   4) 서버가 검증 → 토큰에 박힌 userId/role/clientId 권한으로만 실행
 *
 * 형식: HMAC-SHA256 서명 (의존성 없는 mini-JWT). `base64url(payload).base64url(sig)`
 *   - 시크릿: NEXTAUTH_SECRET (getAuthSecret) 재사용하되 컨텍스트 문자열로 네임스페이스
 *     분리 → NextAuth 세션 토큰과 키 혼용 불가.
 *   - TTL 10분 (만료 후 거부). 포털이 메시지마다 새로 발급해 항상 유효 유지.
 *   - 스코프 'assistant-read' — 읽기 전용 의도 명시(쓰기 경로 없음).
 */
import crypto from "node:crypto";
import { getAuthSecret } from "@/lib/auth-secret";

const SCOPE = "assistant-read" as const;
const TTL_SECONDS = 10 * 60; // 10분
// NextAuth 세션 토큰과 서명 키를 분리하기 위한 컨텍스트 네임스페이스.
const HMAC_CONTEXT = "rtbio-assistant-token-v1:";

export type AssistantTokenPayload = {
  sub: string; // userId
  role: string;
  clientId: string | null;
  tenantCode: string | null;
  scope: typeof SCOPE;
  iat: number; // epoch seconds
  exp: number; // epoch seconds
};

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(message: string, secret: string): string {
  return crypto
    .createHmac("sha256", HMAC_CONTEXT + secret)
    .update(message)
    .digest("base64url");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * 로그인 사용자 컨텍스트로 스코프드 토큰 발급.
 * 시크릿 미설정(운영에서 NEXTAUTH_SECRET 없음) 시 null → 발급 거부.
 */
export function signAssistantToken(input: {
  userId: string;
  role: string;
  clientId: string | null;
  tenantCode: string | null;
  now?: Date;
}): { token: string; expiresIn: number; exp: number } | null {
  const secret = getAuthSecret();
  if (!secret) return null;
  const iat = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  const payload: AssistantTokenPayload = {
    sub: input.userId,
    role: input.role,
    clientId: input.clientId,
    tenantCode: input.tenantCode,
    scope: SCOPE,
    iat,
    exp: iat + TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  const token = body + "." + sign(body, secret);
  return { token, expiresIn: TTL_SECONDS, exp: payload.exp };
}

/**
 * Authorization 헤더의 스코프드 토큰 검증.
 * 통과 시 payload 반환, 실패(서명불일치/만료/스코프오류/형식오류) 시 null.
 */
export function verifyAssistantToken(
  authHeader: string | null,
  now: Date = new Date(),
): AssistantTokenPayload | null {
  const secret = getAuthSecret();
  if (!secret) return null;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  const dot = token.indexOf(".");
  if (dot <= 0 || dot >= token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  // 서명 먼저 검증(상수시간) — 위변조 차단
  if (!timingSafeEqualStr(sig, sign(body, secret))) return null;

  let payload: AssistantTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as AssistantTokenPayload;
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  if (payload.scope !== SCOPE) return null;
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  if (typeof payload.role !== "string" || !payload.role) return null;
  if (typeof payload.exp !== "number") return null;
  const nowSec = Math.floor(now.getTime() / 1000);
  if (nowSec >= payload.exp) return null; // 만료
  return payload;
}

export const ASSISTANT_TOKEN_TTL_SECONDS = TTL_SECONDS;
