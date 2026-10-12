import { expect, test, type Page } from "@playwright/test";

const modes = ["orientation", "prediction", "incorrect-reveal", "retrieval", "assistance"] as const;
const graphBox = (page: Page) => page.getByRole("img", { name: "Quadratic graph", exact: true }).boundingBox();

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }]) {
  test(`all preview compositions fit without clipping or graph shifts at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/step-visuals");
    await expect(page.getByRole("slider", { name: "Movable root" })).toHaveAttribute("aria-disabled", "false");
    const initial = await graphBox(page);
    expect(initial!.height).toBeGreaterThanOrEqual(210);
    expect(initial!.height).toBeLessThanOrEqual(480);
    if (viewport.height === 844) expect(initial!.height).toBeGreaterThan(300);
    for (const mode of modes) {
      await page.getByRole("combobox", { name: "Layout preview" }).selectOption(mode);
      await expect(page.locator("[data-spv-prompt]")).toBeVisible();
      const box = await graphBox(page);
      expect(box!.y).toBeCloseTo(initial!.y, 1);
      expect(box!.height).toBeCloseTo(initial!.height, 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const region = page.getByRole("region", { name: "Roots and factors" });
      const clipped = await region.evaluate((element) => [...element.querySelectorAll<HTMLElement>("button, p, dt, dd")].filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.textContent));
      expect(clipped).toEqual([]);
      const labelsWithinGraph = await page.getByRole("img", { name: "Quadratic graph", exact: true }).evaluate((element) => {
        const svg = element as SVGSVGElement;
        return [...svg.querySelectorAll("text")].every((label) => {
          const bounds = label.getBBox();
          return bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= svg.viewBox.baseVal.width && bounds.y + bounds.height <= svg.viewBox.baseVal.height;
        });
      });
      expect(labelsWithinGraph).toBe(true);
      for (const button of await region.getByRole("button").all()) {
        const bounds = await button.boundingBox();
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
      }
      // Scrolling is permissible, but every prompt/action remains reachable and unclipped.
      await region.locator("[data-spv-prompt] button, [data-spv-navigation] button").last().scrollIntoViewIfNeeded();
      await expect(region.locator("[data-spv-prompt] button, [data-spv-navigation] button").last()).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`${mode}.png`), fullPage: true });
    }
  });
}

test("enlarged text leaves all five previews readable and reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/step-visuals");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await page.evaluate(() => window.scrollTo(0, 0));
  const baseline = await graphBox(page);
  for (const mode of modes) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("combobox", { name: "Layout preview" }).selectOption(mode);
    expect(await graphBox(page)).toEqual(baseline);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const prompt = page.locator("[data-spv-prompt]");
    const lastAction = page.locator("[data-spv-prompt] button, [data-spv-navigation] button").last();
    await lastAction.scrollIntoViewIfNeeded();
    await expect(lastAction).toBeInViewport();
    expect(await prompt.evaluate((element) => [...element.querySelectorAll<HTMLElement>("p, button, dt, dd")].every((node) => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  }
});

test("preview selection survives menu opening and resets only after leaving the experience", async ({ page }) => {
  await page.goto("/step-visuals");
  const selector = page.getByRole("combobox", { name: "Layout preview" });
  await selector.selectOption("incorrect-reveal");
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await expect(page.getByRole("combobox", { name: "Layout preview", includeHidden: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(selector).toHaveValue("incorrect-reveal");
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Interactive visualisation", exact: true }).click();
  await expect(selector).toHaveValue("incorrect-reveal");
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Sparkline preview", exact: true }).click();
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Interactive visualisation", exact: true }).click();
  await expect(selector).toHaveValue("guided");
});

test("reveal substitutions, masking and inactive affordances render without learning behaviour", async ({ page }) => {
  await page.goto("/step-visuals");
  const selector = page.getByRole("combobox", { name: "Layout preview" });
  const graph = page.getByRole("img", { name: "Quadratic graph", exact: true });
  await expect(graph.locator("[data-spv-halo]")).toHaveCount(1);
  expect(await graph.locator("[data-spv-movement-cue] line").count()).toBeGreaterThan(0);
  await selector.selectOption("incorrect-reveal");
  await expect(page.getByText("−3 − 3 = −6", { exact: true })).toBeVisible();
  await expect(page.getByText("−3 + 3 = 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times (x + 3)");
  await expect(graph.locator("[data-spv-halo]")).toHaveCount(0);
  await expect(graph.locator("[data-spv-movement-cue] line")).toHaveCount(0);
  await selector.selectOption("retrieval");
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times a hidden factor");
  await expect(graph).not.toHaveAccessibleDescription(/\(x \+ 3\)/);
  await expect(page.getByText("(x + 3)", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Show explanation" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Movable root" })).toHaveAttribute("aria-valuenow", "-3");
  await expect(selector).toHaveValue("retrieval");
  await expect(graph).toHaveAccessibleDescription(/movable root at x = −3/);
});
