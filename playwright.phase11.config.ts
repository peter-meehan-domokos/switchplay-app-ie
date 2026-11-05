import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
const file = process.env.PHASE11_REVIEW_INFO;
if (!file) throw Error("Set PHASE11_REVIEW_INFO to the isolated disposable test runner metadata");
const review = JSON.parse(readFileSync(file, "utf8"));
if (!/^switchplay_phase2_browser_/.test(review.database) || review.infoCards || !review.groupReview || !review.mediaReviewData || !review.reflectionReview || !/^http:\/\/127\.0\.0\.1:\d+$/.test(review.baseURL)) throw Error("Non-Info disposable Group/media/reflection runner required");
process.env.PHASE11_REVIEW = JSON.stringify(review);
process.env.PHASE10_REVIEW = JSON.stringify(review);
process.env.PHASE7_MEDIA_REVIEW = JSON.stringify(review.mediaReviewData);
process.env.PHASE2_GROUP_FIXTURE = JSON.stringify(review.groupReview);
export default defineConfig({ testDir: "./tests/phase2", testMatch: ["group-integrated-acceptance.browser.ts", "media-ux.browser.ts", "reflections.browser.ts", "group-experience-motion.browser.ts"], workers: 1,
  grepInvert: /50 loaded comparisons/,
  timeout: 120000, expect: { timeout: 20000 }, use: { actionTimeout: 20000, navigationTimeout: 30000, baseURL: review.baseURL, viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "webkit", use: { browserName: "webkit" }, grepInvert: /50 loaded comparisons/ }], outputDir: "/private/tmp/switchplay-phase11-browser-results" });
