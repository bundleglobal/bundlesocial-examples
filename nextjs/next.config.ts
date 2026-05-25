import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow larger uploads to the compose server action (default 1MB is too small for images).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
