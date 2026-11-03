import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
export default defineConfig({
  testDir: "./tests/browser", testMatch: ["media-collection.browser.ts", "media-viewer.browser.ts", "ios-video-download.browser.ts"],
  workers: 1, fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4217", viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "webkit", use: { browserName: "webkit" } }],
  webServer: { command: "SWITCHPLAY_FIXTURE_PORT=4217 node tests/browser/server.cjs", url: "http://127.0.0.1:4217", reuseExistingServer: false, timeout: 60000 },
  outputDir: join(tmpdir(), "switchplay-phase7a-browser-results"),
});
