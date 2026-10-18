import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/phase2", testMatch: "**/*.browser.ts", workers: 1,
  outputDir: "phase2-test-results/artifacts",
  timeout: 120_000, expect: { timeout: 15_000 },
  use: { ...devices["Desktop Chrome"], baseURL: process.env.PHASE2_BASE_URL, trace: "retain-on-failure" },
});
