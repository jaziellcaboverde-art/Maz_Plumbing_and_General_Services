import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the phone on the local network and temporary LocalTunnel hostnames
  // to load Next's development assets.
  allowedDevOrigins: ["192.168.100.8", "192.168.1.35", "loca.lt", "*.loca.lt"],
  experimental: {
    // The proxy buffers each request body and cuts it off at 10 MB by default. A provider application
    // sends several documents at once, so allow more. Keep this above APPLICATION_MAX_BYTES in src/lib/provider/documents.ts.
    proxyClientMaxBodySize: "64mb",
    serverActions: {
      allowedOrigins: ["192.168.100.8:3000", "192.168.1.35:3000", "loca.lt", "*.loca.lt"],
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
