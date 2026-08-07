import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";
// Community requests are proxied separately to avoid CORS and to support
// a dedicated public Open Space backend.
const COMMUNITY_API_ORIGIN =
  process.env.COMMUNITY_API_PROXY_TARGET || API_ORIGIN;

const nextConfig: NextConfig = {
  transpilePackages: ["@operate-ai/workflow-schema"],
  // Avoid Next `output: "standalone"` here: on Windows without Developer Mode,
  // standalone staging uses symlinks and fails with EPERM. Packaging uses
  // `pnpm deploy` + `.next` instead (see packaging/build_windows.ps1).
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
