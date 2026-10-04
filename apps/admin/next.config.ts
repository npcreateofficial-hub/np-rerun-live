import type { NextConfig } from 'next';

const apiOrigin = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4100';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    webpackBuildWorker: false,
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/backend-api/:path*',
          destination: `${apiOrigin}/api/NP/:path*`,
        },
        {
          source: '/backend-media/:path*',
          destination: `${apiOrigin}/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
