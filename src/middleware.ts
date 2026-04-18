import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 멀티테넌시 서브도메인 라우팅.
 *
 * 규칙: {tenant}.rtbio-erp.com → header `x-tenant-id` 주입
 *       localhost 개발환경에서는 `?tenant=altibio` 쿼리로 override
 *
 * Phase 2 (인증)에서 세션·RBAC 추가 예정.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const url = req.nextUrl;

  // 개발 환경 override
  const tenantQuery = url.searchParams.get("tenant");

  let tenant: string | null = tenantQuery;

  if (!tenant) {
    // {tenant}.rtbio-erp.com 에서 tenant 추출
    const match = host.match(/^([^.]+)\.rtbio-erp\.(com|local)$/);
    if (match) tenant = match[1] ?? null;
  }

  const res = NextResponse.next();
  if (tenant) {
    res.headers.set("x-tenant-id", tenant);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
