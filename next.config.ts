import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   devIndicators: false,
   ...(process.env.PHASE2_BROWSER_TEST === "1" ? {
      distDir: ".next-phase2",
      typescript: { tsconfigPath: "phase2-test-results/tsconfig.json" },
   } : {}),
};

export default nextConfig;
