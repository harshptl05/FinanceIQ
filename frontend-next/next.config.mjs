/** @type {import('next').NextConfig} */
const API_TARGET = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_TARGET}/api/:path*` },
      { source: '/health', destination: `${API_TARGET}/health` },
    ];
  },
};

export default nextConfig;
