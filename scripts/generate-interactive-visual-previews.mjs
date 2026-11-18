import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Run against a local development server. The capture target never mounts a record-owning activity.
const origin = process.env.VISUAL_PREVIEW_ORIGIN ?? "http://localhost:3171";
const url = new URL(origin);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Preview generation requires a local development server.");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "en-GB", timezoneId: "Europe/Dublin", colorScheme: "light", reducedMotion: "reduce" });
  const directory = resolve("public/interactive-visuals");
  await mkdir(directory, { recursive: true });
  for (const [button, filename] of [["Render inert initial preview", "roots-and-factors-v1.png"], ["Render inert Integration preview", "integration-area-v2.png"]]) {
    await page.goto(`${url.origin}/dev/interactive-visual-host`);
    await page.getByRole("button", { name: button, exact: true }).click();
    const preview = page.locator("[data-inert-preview]");
    await preview.evaluate(element => { Object.assign(element.style, { width: "390px", height: "844px", padding: "0", overflow: "hidden" }); element.style.setProperty("--spv-surface-height", "844px"); });
    await preview.locator("svg").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250); // Allow ResizeObserver projection to settle before capture.
    await preview.screenshot({ path: resolve(directory, filename), animations: "disabled", scale: "css" });
  }
} finally { await browser.close(); }
