/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // 멀티테넌시 서브도메인 라우팅은 middleware.ts 에서 처리
};

export default nextConfig;
