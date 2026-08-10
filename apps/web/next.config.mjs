const API_ORIGIN = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";
// Community requests are proxied separately to avoid CORS and to support
// a dedicated public Open Space backend.
const COMMUNITY_API_ORIGIN =
  process.env.COMMUNITY_API_PROXY_TARGET || API_ORIGIN;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@operate-ai/workflow-schema"],
  // Docker/Linux public image needs standalone (see apps/web/Dockerfile).
  // On Windows host builds, standalone staging uses symlinks and fails with
  // EPERM without Developer Mode — packaging uses `pnpm deploy` instead.
  ...(process.platform === "win32" ? {} : { output: "standalone" }),
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${API_ORIGIN}/:path*`,
      },
      {
        source: "/community-backend/:path*",
        destination: `${COMMUNITY_API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
