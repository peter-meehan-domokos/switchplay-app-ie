import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   devIndicators: false,
   // Permit phone review over Wi-Fi; Next.js 16 otherwise blocks the dev connection.
   allowedDevOrigins: ["192.168.1.38"],
};

export default nextConfig;
