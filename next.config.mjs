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
