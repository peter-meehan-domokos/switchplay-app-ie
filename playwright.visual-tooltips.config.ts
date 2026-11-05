import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests", testMatch: "interactive-visual-tooltips.spec.ts", workers: 1,
  outputDir: "./test-results/visual-tooltips", reporter: "list",
  use: { contextOptions: { reducedMotion: "reduce" }, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
