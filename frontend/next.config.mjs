/**
 * The Laravel API this app proxies to. Server-side only (no NEXT_PUBLIC_
 * prefix) since it's read here in next.config.mjs and in the rewrites()
 * function below, never shipped to the browser bundle — the browser only
 * ever talks to same-origin `/api/*` and `/storage/*`, which Next rewrites
 * to this URL. Defaults to the local dev backend; set BACKEND_URL in
 * production to point at wherever the Laravel API actually runs.
 */
const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
const backend = new URL(backendUrl);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/storage/:path*',
        destination: `${backendUrl}/storage/:path*`,
      },
      {
        source: '/log-viewer',
        destination: `${backendUrl}/log-viewer`,
      },
      {
        source: '/log-viewer/:path*',
        destination: `${backendUrl}/log-viewer/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: backend.protocol.replace(':', ''),
        hostname: backend.hostname,
        port: backend.port,
        pathname: '/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'loremflickr.com',
      },
    ],
  },
};

export default nextConfig;
