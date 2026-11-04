import { expect, test } from "@playwright/test";

const origin = process.env.SPV_TEST_BASE_URL ?? "http://127.0.0.1:3171";
test.use({ viewport: { width: 320, height: 568 } });

for (const width of [320, 375, 390, 430]) test(`development mock proves transparent fixed corners and original visual bounds at ${width} CSS pixels`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${origin}/dev/interactive-visual-host`);
  const trigger = page.getByRole("button", { name: "Open responsive mock" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Development responsive mock" });
  await expect(dialog).toBeVisible();
  const next = dialog.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeEnabled();
  await expect.poll(async () => (await next.boundingBox())!.x + (await next.boundingBox())!.width).toBeLessThanOrEqual(width - 11.9);
  const content = await dialog.locator("[data-visual-host-content]").boundingBox();
  const mock = await dialog.locator("[data-responsive-mock]").boundingBox();
  const button = await next.boundingBox();
  expect(content!.x).toBeCloseTo(12, 1); expect(content!.y).toBeCloseTo(56, 1); expect(content!.height).toBeCloseTo(732, 1); expect(content!.width).toBeCloseTo(width - 24, 1); expect(mock!.width).toBeCloseTo(content!.width, 1); expect(mock!.height).toBeCloseTo(content!.height, 1);
  expect(button!.x + button!.width).toBeLessThanOrEqual(width - 11.9); expect(button!.x).toBeGreaterThan(width * .65);
  expect(button!.y + button!.height).toBeLessThanOrEqual(838.1);
  for (const selector of ["[data-visual-host-header]", "[data-visual-host-footer]"]) {
    const corner = dialog.locator(selector), rect = await corner.boundingBox();
    expect(rect!.width).toBeLessThanOrEqual(width * .35 + .1);
    expect(rect!.x + rect!.width).toBeCloseTo(width - 12, 1);
    expect(await corner.evaluate(node => { const css = getComputedStyle(node); return [css.backgroundColor, css.borderWidth, css.boxShadow]; })).toEqual(["rgba(0, 0, 0, 0)", "0px", "none"]);
    for (const control of await corner.getByRole("button").all()) {
      const box = await control.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  expect(await dialog.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
  await next.click(); await expect(dialog.locator("[data-responsive-mock]")).toContainText("Stage 2");
  const backBox = await dialog.getByRole("button", { name: "Back", exact: true }).boundingBox();
  const nextBox = await next.boundingBox();
  expect(backBox!.y).toBeCloseTo(nextBox!.y, 1); expect(nextBox!.x - backBox!.x - backBox!.width).toBeCloseTo(8, 1); expect(backBox!.width).toBeCloseTo(nextBox!.width, 1);
  await page.screenshot({ path: `/private/tmp/visual-ux-corners-${width}.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.locator("[data-responsive-mock]")).toContainText("366");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

test("Integration keeps mathematical controls local and restores the unchecked calculation", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 1200 });
  await page.goto(`${origin}/dev/interactive-visual-host`);
  await page.getByRole("button", { name: "Open test card" }).click();
  await page.getByRole("button", { name: "IntegrationExplore area.", exact: true }).click();
  const preview = page.getByRole("button", { name: /^(Start|Continue): Integration$/ });
  await preview.click();
  const dialog = page.getByRole("dialog", { name: "Integration", exact: true });
  const content = dialog.locator("[data-visual-host-content]");
  const next = dialog.locator("[data-visual-host-footer]").getByRole("button", { name: "Next", exact: true });
  await expect(content.getByRole("slider", { name: "Right boundary", exact: true })).toBeVisible();
  await expect(content.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await next.click();
  await content.getByRole("button", { name: "y = x", exact: true }).click();
  await next.click();
  await content.getByRole("group", { name: /area/i }).getByRole("button").first().click();
  for (let stage = 4; stage <= 7; stage++) { await next.click(); await expect(content.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", String(stage)); }
  const finish = dialog.locator("[data-visual-host-footer]").getByRole("button", { name: "Finish", exact: true });
  await expect(finish).toBeDisabled();
  const answer = content.getByRole("textbox", { name: "Your answer", exact: true });
  await answer.fill("12.3");
  await dialog.getByRole("button", { name: "Close interactive visual" }).click();
  await expect(preview).toBeFocused(); await preview.click();
  await expect(answer).toHaveValue("12.3"); await expect(finish).toBeDisabled();
  await content.getByRole("button", { name: "Check calculation", exact: true }).click();
  await expect(finish).toBeEnabled(); await finish.click();
  await expect(content.locator("[data-integration-part]")).toHaveAttribute("data-integration-part", "finished");
  await dialog.getByRole("button", { name: "Close interactive visual" }).click();
  await expect(preview).toHaveAccessibleName("Continue: Integration"); await preview.click();
  await expect(content.locator("[data-integration-part]")).toHaveAttribute("data-integration-part", "finished");
  const rewind = dialog.locator("[data-visual-host-footer]").getByRole("button", { name: "Rewind", exact: true });
  await expect(dialog.locator("[data-visual-host-header]").getByRole("button", { name: "Rewind", exact: true })).toHaveCount(0);
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(async () => (await content.boundingBox())!.x).toBeCloseTo(12, 1);
    const bounds = await content.boundingBox(), graph = await content.locator("svg").first().boundingBox();
    expect(bounds!.x).toBeCloseTo(12, 1); expect(bounds!.y).toBeCloseTo(56, 1);
    expect(bounds!.width).toBeCloseTo(width - 24, 1); expect(bounds!.height).toBeCloseTo(732, 1);
    expect(graph!.width).toBeCloseTo(width - 24, 1);
    const corner = dialog.locator("[data-visual-host-footer]");
    await expect.poll(async () => (await corner.boundingBox())!.width).toBeLessThanOrEqual(width * .35 + .1);
    await expect(rewind).toBeVisible();
    const box = await rewind.boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(838.1);
    await page.screenshot({ path: `/private/tmp/visual-layout-integration-rewind-${width}.png` });
  }
  await rewind.click();
  await page.setViewportSize({ width: 1000, height: 1200 });
  await expect(content.locator("[data-integration-stage]")).toHaveAttribute("data-integration-stage", "1");
  for (let i = 0; i < 6; i++) await next.click();
  await expect(answer).toHaveValue("12.3"); await expect(finish).toBeEnabled();
  await expect(content.locator("[data-integration-part]")).toHaveAttribute("data-integration-part", "calculate");
});

test("card attachment opens the real visual and returns with state retained", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1100 });
  await page.goto(`${origin}/dev/interactive-visual-host`);
  await page.getByRole("button", { name: "Open test card" }).click();
  await page.getByRole("button", { name: "ExploreExplore roots and factors.", exact: true }).click();
  const preview = page.getByRole("button", { name: /^(Start|Continue): Roots and Factors$/ });
  await expect(preview).toHaveAccessibleName("Start: Roots and Factors");
  const image = preview.getByRole("img");
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(390);
  expect(await image.evaluate((node: HTMLImageElement) => node.naturalHeight)).toBe(844);
  expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe("cover");
  // The outer corner of the image is an entry target too, with no nested button.
  await expect(preview.getByRole("button")).toHaveCount(0);
  await preview.click({ position: { x: 5, y: 5 } });
  const dialog = page.getByRole("dialog", { name: "Roots and Factors", exact: true });
  const slider = dialog.getByRole("slider");
  await expect(slider).toHaveAttribute("aria-valuenow", "3");
  await slider.focus(); await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "4");
  await expect(dialog.getByRole("button", { name: "Next", exact: true })).toHaveCount(1);
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "(x + 3)", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close interactive visual" }).click();
  await expect(preview).toBeFocused(); await expect(preview).toHaveAccessibleName("Continue: Roots and Factors"); await preview.click();
  await expect(dialog.getByRole("button", { name: "(x + 3)", exact: true })).toBeVisible();
  await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveCount(0);
});

test("Roots reports and exposes Next at both supported stages despite mathematical overflow", async ({ page }) => {
  await page.goto(`${origin}/dev/interactive-visual-host`);
  await page.getByRole("button", { name: "Open test card" }).click();
  await page.getByRole("button", { name: "ExploreExplore roots and factors.", exact: true }).click();
  await page.getByRole("button", { name: "Start: Roots and Factors", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Roots and Factors", exact: true });
  const content = dialog.locator("[data-visual-host-content]"), slider = dialog.getByRole("slider");
  await expect.poll(async () => (await content.boundingBox())!.x).toBeCloseTo(12, 1);
  const bounds = await content.boundingBox(), graph = await content.locator("svg").first().boundingBox();
  expect(bounds!.x).toBeCloseTo(12, 1); expect(bounds!.y).toBeCloseTo(56, 1);
  expect(bounds!.width).toBeCloseTo(296, 1); expect(bounds!.height).toBeCloseTo(456, 1);
  expect(graph!.width).toBeCloseTo(296, 1);
  const next = dialog.getByRole("button", { name: "Next", exact: true });
  await slider.focus(); await page.keyboard.press("ArrowRight");
  for (const stage of ["orientation", "reveal-explanation"]) {
    if (stage === "reveal-explanation") {
      await next.click(); await dialog.getByRole("button", { name: "(x + 3)", exact: true }).click();
      await slider.focus(); await page.keyboard.press("Home"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    }
    await expect(content).toHaveAttribute("data-visual-stage", stage);
    await expect(next).toBeEnabled();
    await expect.poll(() => next.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return rect.width >= 44 && rect.height >= 44 && rect.bottom <= window.innerHeight && node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBe(true);
    await page.screenshot({ path: `/private/tmp/visual-ux-roots-${stage}-320.png` });
  }
  await next.click(); await expect(content).toHaveAttribute("data-visual-stage", "retrieval");
});
