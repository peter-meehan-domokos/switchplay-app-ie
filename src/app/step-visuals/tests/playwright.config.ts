import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(testDirectory, "../../../..");
const baseURL = process.env.SPV_TEST_BASE_URL ?? "http://127.0.0.1:3171";

export default defineConfig({
  testDir: testDirectory,
  outputDir: resolve(testDirectory, ".test-results"),
  workers: 1,
  reporter: "list",
  use: { baseURL, viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  projects: [
    { name: "pure", testMatch: "**/*.spec.ts" },
    { name: "chromium", testMatch: "**/*.browser.ts", use: { browserName: "chromium" } },
    { name: "webkit", testMatch: "**/*.browser.ts", use: { browserName: "webkit" } },
  ],
  webServer: process.env.SPV_TEST_BASE_URL || process.env.SPV_PURE_ONLY ? undefined : {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3171",
    cwd: projectRoot,
    url: "http://127.0.0.1:3171/step-visuals",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
