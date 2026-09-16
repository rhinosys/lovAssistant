import type { NextConfig } from "next";

const basePath = (process.env.NEXT_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
