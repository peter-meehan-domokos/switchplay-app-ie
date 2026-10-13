import { expect, test, type Page } from "@playwright/test";
import { formatFactor, formatNumber } from "../core/math/realFactors";

const dropdown = (page: Page) => page.getByRole("combobox", { name: "Layout preview" });
const preview = (page: Page) => page.getByRole("region", { name: "Sparkline preview", exact: true });
const rootSelector = (page: Page) => page.getByRole("combobox", { name: "Sparkline root" });
const guidedGraph = (page: Page) => page.locator("[data-spv-learning-stage]");

test("all static variants share root state and graph geometry throughout the full root range", async ({ page }) => {
  await page.goto("/step-visuals");
  await dropdown(page).selectOption("sparkline");
  await expect(rootSelector(page)).toHaveValue("3");
  await expect(preview(page).locator("[data-spv-sparkline]")).toHaveCount(9);
  const initialPath = await preview(page).locator("[data-spv-sparkline-curve]").first().getAttribute("d");
  for (let root = -5; root <= 5; root++) {
    await rootSelector(page).selectOption(String(root));
    for (const width of [160, 240, 320]) {
      const group = preview(page).locator(`[data-spv-reference-width="${width}"]`);
      const complete = group.locator('[data-spv-sparkline="complete"]');
      const graphics = group.locator('[data-spv-sparkline="graphics-only"]');
      const notation = group.locator('[data-spv-sparkline="notation-only"]');
      for (const component of [complete, graphics, notation]) await expect(component).toHaveAttribute("data-spv-sparkline-value", String(root));
      await expect(complete.getByRole("math")).toHaveAccessibleName(`f of x equals (x − 1) times ${formatFactor({ id: "moving", root })}`);
      await expect(notation.getByRole("math")).toHaveAccessibleName(`f of x equals (x − 1) times ${formatFactor({ id: "moving", root })}`);
      await expect(graphics.getByRole("math")).toHaveCount(0);
      await expect(graphics.locator("p")).toHaveCount(0);
      for (const component of [complete, graphics]) {
        const labels = component.locator("[data-spv-sparkline-root-label]");
        await expect(labels).toHaveText(root === 1 ? ["1"] : ["1", formatNumber(root)]);
        const placement = await labels.evaluateAll((elements) => elements.map((element) => {
          const text = element as SVGTextElement;
          const marker = [...text.ownerSVGElement!.querySelectorAll("circle")].find((circle) => circle.getAttribute("cx") === text.getAttribute("x"))!;
          const bounds = text.getBBox();
          return { belowMarker: bounds.y > Number(marker.getAttribute("cy")) + Number(marker.getAttribute("r")),
            inside: bounds.x >= 0 && bounds.x + bounds.width <= text.ownerSVGElement!.viewBox.baseVal.width && bounds.y + bounds.height <= text.ownerSVGElement!.viewBox.baseVal.height };
        }));
        expect(placement.every((label) => label.belowMarker && label.inside)).toBe(true);
      }
      await expect(notation.locator("svg")).toHaveCount(0);
      const geometry = (locator: typeof complete) => locator.locator("svg").evaluate((svg) => ({
        viewBox: svg.getAttribute("viewBox"), path: svg.querySelector("path")!.getAttribute("d"),
        axes: [...svg.querySelectorAll("line")].map((line) => line.outerHTML),
        roots: [...svg.querySelectorAll("circle")].map((circle) => circle.outerHTML),
        labels: [...svg.querySelectorAll("text")].map((label) => label.outerHTML),
        width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height,
      }));
      expect(await geometry(complete)).toEqual(await geometry(graphics));
      if (root !== 3) expect(await complete.locator("path").getAttribute("d")).not.toBe(initialPath);
      const clipId = await complete.locator("clipPath").getAttribute("id");
      await expect(complete.locator('g[clip-path]')).toHaveAttribute("clip-path", `url(#${clipId})`);
    }
  }
  const ids = await preview(page).locator("clipPath").evaluateAll((clips) => clips.map((clip) => clip.id));
  expect(new Set(ids).size).toBe(ids.length);
  await expect(preview(page).getByRole("slider")).toHaveCount(0);
  await expect(preview(page).getByRole("button")).toHaveCount(0);
});

test("dropdown preview cancels a drag and preserves the guided prediction and settled root", async ({ page }) => {
  await page.goto("/step-visuals");
  const slider = page.getByRole("slider");
  await expect(slider).toHaveAttribute("aria-disabled", "false");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "(x + 3)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test", exact: true })).toBeVisible();
  const settledFrame = await guidedGraph(page).locator("svg").boundingBox();
  const hit = await slider.boundingBox();
  await page.mouse.move(hit!.x + hit!.width / 2, hit!.y + hit!.height / 2);
  await page.mouse.down();
  await page.mouse.move(hit!.x + hit!.width / 2 - 20, hit!.y + hit!.height / 2);
  await expect(guidedGraph(page)).toHaveAttribute("data-spv-editing", "true");
  await dropdown(page).selectOption("sparkline");
  await page.mouse.up();
  await rootSelector(page).selectOption("-4");
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await expect(rootSelector(page)).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(rootSelector(page)).toHaveValue("-4");
  await dropdown(page).selectOption("guided");
  await expect(page.getByRole("heading", { name: "Test", exact: true })).toBeVisible();
  await expect(guidedGraph(page)).toHaveAttribute("data-spv-settled-root", "4");
  await expect(guidedGraph(page)).toHaveAttribute("data-spv-editing", "false");
  await expect(page.getByRole("term")).toContainText("Your prediction");
  await expect(page.getByRole("term")).toContainText("(x + 3)");
  expect(await guidedGraph(page).locator("svg").boundingBox()).toEqual(settledFrame);
  await expect(slider).toHaveAttribute("aria-valuemin", "-5");
  await expect(dropdown(page).locator("option")).toHaveCount(7);
});

for (const width of [320, 360, 390]) for (const enlarged of [false, true]) {
  test(`compact examples fit a ${width}px phone${enlarged ? " with enlarged text" : ""}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/step-visuals");
    if (enlarged) await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await dropdown(page).selectOption("sparkline");
    await rootSelector(page).selectOption("-5");
    await expect(preview(page).locator('[data-spv-sparkline-value="-5"]')).toHaveCount(9);
    for (const requestedWidth of [160, 240, 320]) {
      const group = preview(page).locator(`[data-spv-reference-width="${requestedWidth}"]`);
      const available = await group.boundingBox();
      for (const sample of await group.getByRole("region").all()) {
        const box = await sample.boundingBox();
        expect(box!.width).toBeCloseTo(Math.min(requestedWidth, available!.width), 1);
      }
    }
    for (const component of await preview(page).locator("[data-spv-sparkline]").all()) {
      const box = await component.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      for (const span of await component.locator("p span").all()) {
        const text = await span.boundingBox();
        expect(text!.x).toBeGreaterThanOrEqual(box!.x - 1);
        expect(text!.x + text!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
      }
      if (await component.getAttribute("data-spv-sparkline") === "notation-only") {
        const notation = await component.locator("p").boundingBox();
        expect(box!.height).toBeCloseTo(notation!.height, 1);
      } else {
        const svg = await component.locator("svg").boundingBox();
        expect(svg!.height).toBeCloseTo(112, 1);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 390 && !enlarged) {
      await rootSelector(page).selectOption("3");
      await page.screenshot({ path: testInfo.outputPath("sparkline-root-3.png"), fullPage: true });
    }
  });
}
