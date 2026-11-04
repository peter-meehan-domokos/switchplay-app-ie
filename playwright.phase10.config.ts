import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
const path = process.env.PHASE10_REVIEW_INFO;
if (!path) throw Error("Set PHASE10_REVIEW_INFO to the owned disposable review-server.json");
const review = JSON.parse(readFileSync(path, "utf8"));
if (!/^switchplay_phase2_browser_/.test(review.database) || !review.reflectionReview || !/^http:\/\/127\.0\.0\.1:\d+$/.test(review.baseURL)) throw Error("Disposable Phase 10 runner required");
process.env.PHASE10_REVIEW = JSON.stringify(review);
export default defineConfig({ testDir: "./tests/phase2", testMatch: "reflections.browser.ts", workers: 1, timeout: 90000, expect: { timeout: 20000 },
  use: { baseURL: review.baseURL, viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "webkit", use: { browserName: "webkit" } }], outputDir: "/private/tmp/switchplay-phase10-browser-results" });
