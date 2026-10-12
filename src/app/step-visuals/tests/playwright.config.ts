import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "../../../..");
const baseURL = process.env.SPV_TEST_BASE_URL ?? "http://127.0.0.1:3171";

export default defineConfig({
  testDir: __dirname,
  testMatch: "**/*.browser.ts",
  outputDir: resolve(__dirname, ".test-results"),
  workers: 1,
  reporter: "list",
  use: { baseURL, viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: process.env.SPV_TEST_BASE_URL ? undefined : {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3171",
    cwd: projectRoot,
    url: "http://127.0.0.1:3171/step-visuals",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
