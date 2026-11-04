import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const file = process.env.PHASE7_REVIEW_INFO;
if (!file) throw Error("Set PHASE7_REVIEW_INFO to the owned disposable review-server.json");
const review = JSON.parse(readFileSync(file, "utf8"));
if (!/^switchplay_phase2_browser_/.test(review.database) || !review.mediaReviewData || !/^http:\/\/127\.0\.0\.1:\d+$/.test(review.baseURL)) throw Error("Requires the disposable Group media runner");
process.env.PHASE7_MEDIA_REVIEW = JSON.stringify(review.mediaReviewData);
process.env.PHASE2_GROUP_FIXTURE = JSON.stringify(review.groupReview);
export default defineConfig({ testDir: "./tests/phase2", testMatch: "media-ux.browser.ts", workers: 1, timeout: 90000, expect: { timeout: 15000 },
  use: { baseURL: review.baseURL, viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "webkit", use: { browserName: "webkit" } }], outputDir: join(tmpdir(), "switchplay-phase7b-browser-results") });
