import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async redirects() {
    return [
      { source: "/dialer",                destination: "/dashboard", permanent: true },
      { source: "/dashboard/dialer",      destination: "/dashboard", permanent: true },
      { source: "/dashboard/live-call",   destination: "/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
