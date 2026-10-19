import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the phone on the local network and temporary LocalTunnel hostnames
  // to load Next's development assets.
  allowedDevOrigins: ["192.168.100.8", "192.168.1.35", "loca.lt", "*.loca.lt"],
  experimental: {
    serverActions: {
      allowedOrigins: ["192.168.100.8:3000", "192.168.1.35:3000", "loca.lt", "*.loca.lt"],
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
