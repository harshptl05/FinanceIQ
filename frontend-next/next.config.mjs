import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const API_TARGET = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Pin turbopack root to this directory — without this, Next 16 walks up
  // and finds the parent repo's pnpm-lock.yaml, then fails to resolve
  // 'tailwindcss' because it looks for node_modules from the wrong root.
  turbopack: {
    root: __dirname,
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
