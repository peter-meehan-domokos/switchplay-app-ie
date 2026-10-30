import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Run against a local development server. The capture target never mounts a record-owning activity.
const origin = process.env.VISUAL_PREVIEW_ORIGIN ?? "http://127.0.0.1:3171";
const url = new URL(origin);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Preview generation requires a local development server.");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(`${url.origin}/dev/interactive-visual-host`);
  await page.getByRole("button", { name: "Render inert initial preview" }).click();
  const preview = page.locator("[data-inert-preview]");
  await preview.locator("svg").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250); // Allow ResizeObserver projection to settle before capture.
  const directory = resolve("public/interactive-visuals");
  await mkdir(directory, { recursive: true });
  await preview.screenshot({ path: resolve(directory, "roots-and-factors-v1.png"), animations: "disabled" });
} finally { await browser.close(); }
