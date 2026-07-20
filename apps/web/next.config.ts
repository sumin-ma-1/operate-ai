import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  transpilePackages: ["@operate-ai/workflow-schema"],
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
