import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests", testMatch: "integration-container.spec.ts", workers: 1,
  outputDir: "./phase2-test-results/integration-container", reporter: "list",
  use: { contextOptions: { reducedMotion: "reduce" }, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
