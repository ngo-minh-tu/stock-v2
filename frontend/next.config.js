/** @type {import('next').NextConfig} */
// Proxy `/api/*` sang FastAPI BE để browser chỉ thấy same-origin (ngrok URL).
// BE target lấy từ `BACKEND_INTERNAL_URL` (server-side env), fallback localhost:8000.
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:8000';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
