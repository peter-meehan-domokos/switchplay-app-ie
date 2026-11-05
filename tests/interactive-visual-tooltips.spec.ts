import { expect, test, type Locator, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

let html: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: ["tests/browser/interactive-visual-tooltips-fixture.tsx"],
    bundle: true, write: false, outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"', "process.env": "{}" }, loader: { ".ttf": "dataurl", ".woff": "dataurl", ".woff2": "dataurl" } });
  html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${await readFile("src/app/globals.css", "utf8")}\n${result.outputFiles.find(file => file.path.endsWith(".css"))!.text}</style><div id="root"></div><script>${result.outputFiles.find(file => file.path.endsWith(".js"))!.text}</script>`;
});

async function open(page: Page, standalone = false) {
  await page.route("https://tooltip.invalid/**", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto(`https://tooltip.invalid/${standalone ? "?standalone" : ""}`);
}

async function openFromCard(page: Page) {
  await open(page);
  await page.locator(".active-step-item").press("Enter");
  const preview = page.getByRole("button", { name: /^(Start|Continue): Integration$/ });
  await preview.click();
  const dialog = page.getByRole("dialog", { name: "Integration", exact: true });
  await dialog.locator("[data-visual-host-footer]").getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", "2");
  return { dialog, preview };
}

async function expectExposed(tip: Locator, width: number, height: number) {
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("The estimated area is found by adding together the areas of all the rectangles.");
  // Visibility alone misses the original bug: a body portal was behind the modal.
  await expect.poll(() => tip.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
  const box = (await tip.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(7);
  expect(box.y).toBeGreaterThanOrEqual(7);
  expect(box.x + box.width).toBeLessThanOrEqual(width - 7);
  expect(box.y + box.height).toBeLessThanOrEqual(height - 7);
}

test("card step tooltips support clicks, keyboard, dismissal and return to the card", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 1200 });
  const { dialog, preview } = await openFromCard(page);
  const trigger = dialog.getByRole("button", { name: "estimated", exact: true });
  const feedback = dialog.getByRole("button", { name: "Estimated", exact: true });
  const tip = page.getByRole("tooltip");
  const graph = dialog.locator("[data-integration-graph]");
  const geometry = await graph.boundingBox();
  const saves = await page.evaluate(() => window.tooltipSaveCount);

  await trigger.click();
  await expectExposed(tip, 1000, 1200);
  await expect(dialog.locator("[data-visual-tooltip-overlay] [role=tooltip]")).toHaveCount(1);
  await expect(trigger).toHaveAccessibleDescription(/Estimated area.*all the rectangles/);
  await tip.click();
  await expect(tip).toBeVisible();
  await page.keyboard.press("Escape"); await expect(tip).toHaveCount(0);
  await expect(dialog).toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click(); await expectExposed(tip, 1000, 1200);
  await trigger.click(); await expect(tip).toHaveCount(0);

  await trigger.focus(); await page.keyboard.press("Enter"); await expectExposed(tip, 1000, 1200);
  await page.keyboard.press("Escape"); await expect(tip).toHaveCount(0);
  await expect(dialog).toBeVisible(); await expect(trigger).toBeFocused();
  await page.keyboard.press("Space"); await expectExposed(tip, 1000, 1200);
  await page.keyboard.press("Space"); await expect(tip).toHaveCount(0);
  await feedback.click(); await expectExposed(tip, 1000, 1200);
  await graph.click({ position: { x: 5, y: 5 } }); await expect(tip).toHaveCount(0);
  await trigger.click(); await trigger.focus(); await page.keyboard.press("Tab"); await expect(tip).toHaveCount(0);
  expect(await graph.boundingBox()).toEqual(geometry);
  expect(await page.evaluate(() => window.tooltipSaveCount)).toBe(saves);

  await trigger.click();
  await dialog.locator("[data-visual-host-footer]").getByRole("button", { name: "Back", exact: true }).click();
  await expect(tip).toHaveCount(0);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await expect(preview).toBeFocused();
  await expect(page.locator(".step-view-layer")).toHaveAttribute("data-step-view-item", "step");
  await preview.click();
  await expect(dialog.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", "1");
  await expect(tip).toHaveCount(0);
});

test("touch tooltips fit a phone viewport, survive resize and do not dismiss the visual", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    const { dialog } = await openFromCard(page);
    const trigger = dialog.getByRole("button", { name: "estimated", exact: true });
    const tip = page.getByRole("tooltip");
    await trigger.tap(); await expectExposed(tip, 390, 844);
    await page.setViewportSize({ width: 375, height: 667 }); await expectExposed(tip, 375, 667);
    await trigger.tap(); await expect(tip).toHaveCount(0);
    await trigger.tap(); await expectExposed(tip, 375, 667);
    await dialog.locator("[data-integration-graph]").tap({ position: { x: 5, y: 5 } });
    await expect(tip).toHaveCount(0); await expect(dialog).toBeVisible();
    await trigger.tap();
    await dialog.getByRole("button", { name: "Close interactive visual", exact: true }).tap();
    await expect(dialog).toHaveCount(0); await expect(tip).toHaveCount(0);
  } finally { await context.close(); }
});

test("standalone visual keeps body tooltips and keyboard dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, true);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const trigger = page.getByRole("button", { name: "estimated", exact: true });
  const tip = page.getByRole("tooltip");
  await trigger.click(); await expectExposed(tip, 390, 844);
  expect(await tip.evaluate(node => node.parentElement === document.body)).toBe(true);
  await page.keyboard.press("Escape"); await expect(tip).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter"); await expectExposed(tip, 390, 844);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(tip).toHaveCount(0);
});
