/**
 * Edge middleware — 모든 요청을 통과시키며 순차 처리:
 *
 *   1) 테넌트 서브도메인 추출 → `x-tenant-id` 헤더 주입
 *   2) 보호 경로 인증 게이트 (미인증 시 /login redirect)
 *   3) RBAC — 역할에 따른 포털 접근 제한 (ROLE_PORTAL_ACCESS)
 *
 * 감사 로그 기록은 Route Handler/Server Action 에서 `logAudit()` 사용
 * (Edge 런타임에서 Prisma 직접 사용 불가).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken, encode } from "next-auth/jwt";
import { canAccessPath } from "@/lib/rbac";
import { getAuthSecret } from "@/lib/auth-secret";
import {
  isValidApiToken,
  isTokenWriteAllowed,
  SERVICE_PRINCIPAL,
} from "@/lib/widget-spec/api-auth";

const PUBLIC_PATHS = ["/login", "/api/auth", "/403", "/_next", "/favicon.ico"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * 리다이렉트 URL 을 "외부에서 본 호스트" 기준으로 구성한다.
 * Cloudflare 터널·리버스프록시는 원본 도메인을 x-forwarded-host 로 전달하고
 * 오리진(Next)의 Host 는 localhost 로 바뀔 수 있다 → req.url 그대로 쓰면 localhost 로 튕김.
 * 따라서 x-forwarded-host 가 있으면 그것을 우선 사용한다.
 */
function externalRedirectUrl(path: string, req: NextRequest): URL {
  const fwdHost = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto") || "https";
  if (fwdHost) return new URL(path, `${fwdProto}://${fwdHost}`);
  return new URL(path, req.url);
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // ── 0) 클린 URL 정규화 — 프로토타입 .html 직접 접근 → /admin 등으로 redirect
  //     (rewrite 내부 서빙은 미들웨어를 재실행하지 않으므로 충돌 없음. 실서비스: .html 노출 금지)
  const portalMatch = pathname.match(
    /^\/portals\/(admin|qc|exec|ceo|client)-portal\.html$/,
  );
  if (portalMatch) {
    const clean = externalRedirectUrl("/" + portalMatch[1], req);
    clean.search = url.search;
    return NextResponse.redirect(clean);
  }

  // ── 1) 테넌트 컨텍스트 주입 ───────────────────────────────────
  const host = req.headers.get("host") ?? "";
  const tenantQuery = url.searchParams.get("tenant");
  let tenant: string | null = tenantQuery;
  if (!tenant) {
    const match = host.match(/^([^.]+)\.rtbio-erp\.(com|local)$/);
    if (match) tenant = match[1] ?? null;
  }

  const requestHeaders = new Headers(req.headers);
  if (tenant) requestHeaders.set("x-tenant-id", tenant);

  // ── 1.5) API 토큰 게이트 (Flowise 등 외부 에이전트) ──
  //     Authorization: Bearer <WIDGET_API_TOKEN> 요청은 서비스 계정 세션 JWT 를
  //     쿠키로 주입해 기존 getServerSession 기반 핸들러가 정상 ADMIN 세션으로 인식.
  const authz = req.headers.get("authorization");
  if (authz && authz.startsWith("Bearer ")) {
    // 어시스턴트 스코프드 토큰(/api/assistant/*)은 라우트 핸들러가 자체 검증한다.
    // WIDGET_API_TOKEN 게이트를 건너뛰고 통과 — 원본 Authorization 헤더는
    // requestHeaders(req.headers 복제)에 보존되어 핸들러로 전달된다.
    if (pathname.startsWith("/api/assistant/")) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    if (!pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (!isValidApiToken(authz)) {
      return NextResponse.json(
        { ok: false, error: "Invalid API token" },
        { status: 401 },
      );
    }
    if (!isTokenWriteAllowed(req.method, pathname)) {
      return NextResponse.json(
        { ok: false, error: "토큰은 읽기 + 위젯 생성만 허용됩니다", path: pathname },
        { status: 403 },
      );
    }
    const secret = getAuthSecret();
    if (!secret) {
      // 운영에서 NEXTAUTH_SECRET 미설정 — 세션 브리지 불가 (fail-loud, 우회 없음)
      return NextResponse.json(
        { ok: false, error: "Server auth not configured" },
        { status: 500 },
      );
    }
    const svcJwt = await encode({
      token: {
        userId: SERVICE_PRINCIPAL.userId,
        role: SERVICE_PRINCIPAL.role,
        tenantId: SERVICE_PRINCIPAL.tenantId,
        tenantCode: SERVICE_PRINCIPAL.tenantCode,
        clientId: SERVICE_PRINCIPAL.clientId,
        isTeamAdmin: SERVICE_PRINCIPAL.isTeamAdmin,
      },
      secret,
    });
    // 쿠키명은 환경 의존: 운영 HTTPS 는 __Secure- 접두사
    const secure = (process.env.NEXTAUTH_URL || "").startsWith("https");
    const cookieName = (secure ? "__Secure-" : "") + "next-auth.session-token";
    requestHeaders.set("cookie", cookieName + "=" + svcJwt);
    requestHeaders.set("x-tenant-id", SERVICE_PRINCIPAL.tenantCode);
    requestHeaders.set("x-api-principal", SERVICE_PRINCIPAL.userId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── 2) 인증 게이트 ─────────────────────────────────────────
  if (isPublic(pathname) || pathname === "/") {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = await getToken({
    req,
    secret: getAuthSecret(),
  });

  if (!token) {
    const loginUrl = externalRedirectUrl("/login", req);
    loginUrl.searchParams.set("callbackUrl", pathname + url.search);
    return NextResponse.redirect(loginUrl);
  }

  // ── 3) RBAC — 포털별 접근 제한 ────────────────────────────
  const role = token.role;
  if (role && !canAccessPath(role, pathname)) {
    return NextResponse.redirect(externalRedirectUrl("/403", req));
  }

  // 세션에 tenantId 가 있으면 우선 적용 (구독자별 격리)
  if (!tenant && token.tenantCode) {
    requestHeaders.set("x-tenant-id", token.tenantCode);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
