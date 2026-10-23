import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig { return {
   devIndicators: false,
   ...(phase === PHASE_DEVELOPMENT_SERVER && process.env.PHASE2_BROWSER_TEST === "1" ? {
      allowedDevOrigins: (process.env.SWITCHPLAY_REVIEW_ORIGINS ?? "127.0.0.1").split(",").filter(Boolean),
      distDir: process.env.PHASE2_INTERACTIVE === "0" ? ".next-phase2-test" : ".next-phase2",
      typescript: { tsconfigPath: `phase2-test-results/tsconfig-${process.env.PHASE2_INTERACTIVE === "0" ? "test" : "dev"}.json` },
   } : {}),
}; }
