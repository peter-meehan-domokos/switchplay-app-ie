import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests/maths-renderer",
  testMatch: "**/*.browser.ts",
  workers: 1,
  reporter: [["line"], ["json", { outputFile: join(tmpdir(), "switchplay-maths-stage1-report.json") }]],
  outputDir: join(tmpdir(), "switchplay-maths-stage1-results"),
  use: { baseURL: process.env.MATHS_REVIEW_BASE_URL ?? "http://127.0.0.1:4181", viewport: { width: 1100, height: 900 } },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
