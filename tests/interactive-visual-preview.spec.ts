import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

test.use({ viewport: { width: 390, height: 844 } });
let bundle: string, css: string;
test.beforeAll(async () => {
  const compiled = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import Preview from './src/components/interactiveVisuals/InteractiveVisualPreview';
    import {createDevelopmentVisualPersistence} from './src/lib/interactiveVisuals/developmentPersistence';
    const base=createDevelopmentVisualPersistence();window.previewCalls={reads:0,opens:0};
    const persistence={...base,hasAttempt:async id=>{
      window.previewCalls.reads++;
      if(window.previewFault==='lookup-error')throw new Error('Injected lookup failure');
      if(window.previewFault==='lookup-stall')return new Promise(resolve=>window.finishLookup=()=>resolve(false));
      return base.hasAttempt(id);
    },open:async(id,origin)=>{
      window.previewCalls.opens++;
      if(window.previewFault==='open-error')throw new Error('Injected opening failure');
      if(window.previewFault==='open-stall')await new Promise(resolve=>window.finishOpening=resolve);
      return base.open(id,origin);
    }};
    createRoot(document.getElementById('root')).render(<div style={{width:320,height:500,position:'relative'}}>
      <Preview activityId={window.previewActivity} origin={{kind:'direct'}} persistence={window.previewFault==='provider-stall'?null:persistence}/>
    </div>);
  ` }, bundle: true, write: false, outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".ttf": "dataurl", ".woff": "dataurl", ".woff2": "dataurl" }, define: { "process.env.NODE_ENV": '"test"' } });
  bundle = compiled.outputFiles!.find(file => file.path.endsWith(".js"))!.text;
  css = await readFile("src/app/globals.css", "utf8") + compiled.outputFiles!.find(file => file.path.endsWith(".css"))!.text;
});
type Probe = { previewFault: string; previewCalls: { reads: number; opens: number }; finishLookup(): void; finishOpening(): void };
async function setup(page: Page, fault: string, activity = "integration-area") {
  await page.route("https://preview.invalid/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/interactive-visuals/")) return route.fulfill({ contentType: "image/png", body: await readFile(`public${path}`) });
    return route.fulfill({ contentType: "text/html", body: `<style>${css}</style><div id="root"></div><script>window.previewFault=${JSON.stringify(fault)};window.previewActivity=${JSON.stringify(activity)};${bundle}</script>` });
  });
  await page.goto("https://preview.invalid/");
}
const calls = (page: Page) => page.evaluate(() => (window as unknown as Probe).previewCalls);
const recover = (page: Page) => page.evaluate(() => { (window as unknown as Probe).previewFault = "none"; });

for (const [activity, title] of [["integration-area", "Integration"], ["roots-and-factors", "Roots and Factors"]]) {
  test(`${title} failed status lookup offers an inert retry instead of a disabled spinner`, async ({ page }) => {
    await setup(page, "lookup-error", activity);
    const preview = page.locator("[data-interactive-visual-preview]");
    await expect(page.getByRole("alert")).toContainText("Unable to check progress");
    await expect(preview).toBeEnabled(); await expect(preview).not.toHaveAttribute("aria-busy", "true");
    await expect(preview).toHaveAccessibleName(`Retry checking progress: ${title}`);
    expect((await calls(page)).opens).toBe(0);
    await recover(page); await preview.click(); await expect(preview).toHaveAccessibleName(`Start: ${title}`);
    expect((await calls(page)).opens).toBe(0); // Retrying metadata is still read-only.
    await preview.click(); await expect(page.getByRole("dialog", { name: title, exact: true })).toBeVisible();
  });
}

test("a stalled lookup has a deadline and a late result cannot overwrite the retry state", async ({ page }) => {
  await page.clock.install(); await setup(page, "lookup-stall");
  await expect.poll(async () => (await calls(page)).reads).toBeGreaterThan(0);
  await page.clock.fastForward(15_001);
  const preview = page.locator("[data-interactive-visual-preview]");
  await expect(preview).toHaveAccessibleName("Retry checking progress: Integration");
  await expect(preview).toBeEnabled(); await expect(preview).not.toHaveAttribute("aria-busy", "true");
  await page.evaluate(() => (window as unknown as Probe).finishLookup());
  await expect(preview).toHaveAccessibleName("Retry checking progress: Integration");
  expect((await calls(page)).opens).toBe(0);
  await recover(page); await preview.click(); await expect(preview).toHaveAccessibleName("Start: Integration");
});

test("failed opening can retry and Continue retains the same saved stage through repeated closes", async ({ page }) => {
  await setup(page, "open-error");
  const preview = page.locator("[data-interactive-visual-preview]");
  await expect(preview).toHaveAccessibleName("Start: Integration"); await preview.click();
  await expect(page.getByRole("alert")).toContainText("Unable to open"); await expect(preview).toBeEnabled();
  await recover(page); await preview.click();
  const host = page.getByRole("dialog", { name: "Integration", exact: true });
  await host.getByRole("button", { name: "Next", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await expect(host.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", "2");
    await host.getByRole("button", { name: "Close interactive visual" }).click();
    await expect(preview).toHaveAccessibleName("Continue: Integration"); await expect(preview).toBeEnabled();
    await preview.click();
  }
  await expect(host.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", "2");
});

test("stalled opening offers reload without retrying an unresolved mutating operation", async ({ page }) => {
  await page.clock.install(); await setup(page, "open-stall");
  const preview = page.locator("[data-interactive-visual-preview]");
  await expect(preview).toHaveAccessibleName("Start: Integration"); await preview.click();
  await expect.poll(async () => (await calls(page)).opens).toBe(1);
  await page.clock.fastForward(15_001);
  await expect(preview).toHaveAccessibleName("Reload to open: Integration"); await expect(preview).toBeEnabled();
  await expect(preview).not.toHaveAttribute("aria-busy", "true");
  await page.evaluate(() => (window as unknown as Probe).finishOpening());
  await expect(page.getByRole("dialog")).toHaveCount(0); expect((await calls(page)).opens).toBe(1);
  await Promise.all([page.waitForEvent("framenavigated"), preview.click()]);
  await expect(preview).toHaveAccessibleName("Start: Integration");
});

test("service preparation cannot leave a permanent spinner either", async ({ page }) => {
  await page.clock.install(); await setup(page, "provider-stall");
  await expect(page.locator("[data-interactive-visual-preview]")).toBeVisible();
  await page.clock.fastForward(15_001);
  const preview = page.locator("[data-interactive-visual-preview]");
  await expect(preview).toHaveAccessibleName("Reload to open: Integration"); await expect(preview).toBeEnabled();
  await expect(preview).not.toHaveAttribute("aria-busy", "true"); expect((await calls(page)).opens).toBe(0);
});
