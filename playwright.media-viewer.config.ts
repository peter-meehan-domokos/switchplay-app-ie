import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.browser.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4178",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/browser/server.cjs",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  outputDir: join(tmpdir(), "switchplay-media-viewer-results"),
});
