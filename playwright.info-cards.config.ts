import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "info-cards.browser.ts",
  workers: 1,
  reporter: [["line"], ["json", { outputFile: join(tmpdir(), "switchplay-info-cards-report.json") }]],
  use: {
    baseURL: "http://127.0.0.1:4179",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "SWITCHPLAY_FIXTURE_PORT=4179 node tests/browser/server.cjs",
    url: "http://127.0.0.1:4179/info-cards",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  outputDir: join(tmpdir(), "switchplay-info-cards-results"),
});
