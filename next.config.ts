import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow audio file uploads up to 50 MB
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
