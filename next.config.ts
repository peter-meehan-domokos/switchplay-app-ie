import type { NextConfig } from "next";
import { resolve, sep } from "node:path";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
const fixture = process.env.SWITCHPLAY_DATABASE_MODE === "disposable" && process.env.PHASE2_BROWSER_TEST === "1" ? process.env.PHASE2_FRAMEWORK_FIXTURE_FILE : undefined;
if (fixture && !resolve(fixture).startsWith(resolve("phase2-test-results") + sep)) throw new Error("Framework fixtures must be generated inside the disposable harness directory");
return {
   devIndicators: false,
   // Bundler-only test substitution: normal development/production keep the
   // checked-in catalogue and default compiler, with no runtime fixture feature.
   ...(fixture ? { webpack(config, { webpack }) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/configuration(?:\.ts)?$/, (resource: { context: string; request: string }) => {
         if (resource.request === "@/lib/frameworks/configuration" || resolve(resource.context, resource.request) === resolve("src/lib/frameworks/configuration")) resource.request = resolve(fixture);
      }));
      return config;
   } } : {}),
   serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
   outputFileTracingIncludes: { "/api/info-cards/*/check-rendering": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/playwright-core/**", "./src/components/info-cards/fonts/**"] },
   ...(process.env.SWITCHPLAY_DATABASE_MODE === "disposable" && process.env.PHASE2_BROWSER_TEST === "1" && process.env.PHASE2_OPTIMIZED === "1" ? {
      distDir: ".next-phase2-optimized",
      typescript: { tsconfigPath: `phase2-test-results/tsconfig-${process.env.PHASE2_INTERACTIVE === "0" ? "test" : "dev"}.json` },
   } : phase === PHASE_DEVELOPMENT_SERVER && process.env.PHASE2_BROWSER_TEST === "1" ? {
      allowedDevOrigins: (process.env.SWITCHPLAY_REVIEW_ORIGINS ?? "127.0.0.1").split(",").filter(Boolean),
      distDir: process.env.PHASE2_INTERACTIVE === "0" ? ".next-phase2-test" : ".next-phase2",
      typescript: { tsconfigPath: `phase2-test-results/tsconfig-${process.env.PHASE2_INTERACTIVE === "0" ? "test" : "dev"}.json` },
   } : {}),
}; }
