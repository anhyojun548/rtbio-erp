// ── 타임존 고정 (KST / Asia/Seoul) ─────────────────────────────────
// 모든 "현재 시점" 계산(위젯 이번달/오늘/주간, 월간보고서, 유통기한, billingMonth 등)은
// new Date() + 로컬시간 메서드(getMonth/getDate…)를 쓰므로 **런타임 TZ 에 의존**한다.
// 운영(리눅스 컨테이너)은 기본 UTC 라 KST 와 9시간 어긋난다 → 여기서 KST 로 고정한다.
// Node 는 런타임 process.env.TZ 변경을 tzset() 으로 반영(검증됨). 외부에서 TZ 가
// 명시되면(컨테이너 env 등) 그것을 우선한다 — defense-in-depth.
process.env.TZ = process.env.TZ || "Asia/Seoul";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // 멀티테넌시 서브도메인 라우팅은 middleware.ts 에서 처리

  /**
   * 클린 URL — 프로토타입 HTML 을 .html 노출 없이 서빙 (실서비스 전환).
   * beforeFiles: 파일시스템 라우트(app/admin/page.tsx 등)보다 우선.
   * URL 바는 /admin 그대로, 내용은 public/portals/*.html 을 rewrite.
   * 자산은 절대경로(/portals/...)로 참조하므로 어느 URL 에서도 정상 로드.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/admin", destination: "/portals/admin-portal.html" },
        { source: "/qc", destination: "/portals/qc-portal.html" },
        { source: "/exec", destination: "/portals/exec-portal.html" },
        { source: "/ceo", destination: "/portals/ceo-portal.html" },
        { source: "/client", destination: "/portals/client-portal.html" },
      ],
    };
  },
};

export default nextConfig;
