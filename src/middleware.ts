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
import { getToken } from "next-auth/jwt";
import { canAccessPath } from "@/lib/rbac";
import { getAuthSecret } from "@/lib/auth-secret";

const PUBLIC_PATHS = ["/login", "/api/auth", "/403", "/_next", "/favicon.ico"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
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
    const clean = new URL("/" + portalMatch[1], req.url);
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

  // ── 2) 인증 게이트 ─────────────────────────────────────────
  if (isPublic(pathname) || pathname === "/") {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = await getToken({
    req,
    secret: getAuthSecret(),
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + url.search);
    return NextResponse.redirect(loginUrl);
  }

  // ── 3) RBAC — 포털별 접근 제한 ────────────────────────────
  const role = token.role;
  if (role && !canAccessPath(role, pathname)) {
    return NextResponse.redirect(new URL("/403", req.url));
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
