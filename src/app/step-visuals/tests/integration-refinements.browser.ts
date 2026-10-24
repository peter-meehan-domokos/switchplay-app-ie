import { expect, test, type Page } from "@playwright/test";

const open = async (page: Page) => {
  await page.goto("/step-visuals");
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Integration", exact: true }).click();
  await page.locator("li").getByRole("button", { name: "Integration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1. Area under a graph", exact: true })).toBeVisible();
};
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true }).click();
const previous = (page: Page) => page.getByRole("button", { name: "Previous", exact: true }).click();

test("continuous graph motion and native slider keep tenths-based labels/calculation consistent", async ({ page }) => {
  await open(page);
  const handle = page.getByRole("slider", { name: "Right boundary on graph", exact: true });
  const range = page.getByRole("slider", { name: "Right boundary", exact: true });
  await expect(range).toHaveValue("1");
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  const box = (await handle.boundingBox())!;
  const unit = await page.locator("[data-integration-graph] svg").evaluate((element) => ((element as SVGSVGElement).viewBox.baseVal.width - 54) / 5);
  const graph = await page.locator("[data-integration-graph]").boundingBox();
  const axes = await page.locator("[data-integration-plane]").innerHTML();
  const label = page.locator('[data-integration-boundary="b"] text');
  await page.mouse.move(box.x + 24, box.y + 24); await page.mouse.down();
  await page.mouse.move(box.x + 24 + 1.34 * unit, box.y + 24);
  expect(Number(await handle.getAttribute("aria-valuenow"))).toBeCloseTo(2.34, 5);
  await expect(label).toHaveText("b = 2.3");
  await expect(page.getByText("A = 2b = 2 × 2.3 = 4.6 square units", { exact: true })).toBeVisible();
  const firstPath = await page.locator("[data-integration-region]").getAttribute("d");
  const firstMarker = Number(await page.locator('[data-integration-boundary="b"] circle').getAttribute("cx"));
  await page.mouse.move(box.x + 24 + 1.36 * unit, box.y + 24);
  expect(Number(await handle.getAttribute("aria-valuenow"))).toBeCloseTo(2.36, 5);
  await expect(label).toHaveText("b = 2.4");
  await expect(page.getByText("A = 2b = 2 × 2.4 = 4.8 square units", { exact: true })).toBeVisible();
  expect(await page.locator("[data-integration-region]").getAttribute("d")).not.toBe(firstPath);
  expect(Number(await page.locator('[data-integration-boundary="b"] circle').getAttribute("cx"))).toBeGreaterThan(firstMarker);
  await page.mouse.up();
  expect(Number(await range.inputValue())).toBeCloseTo(2.36, 5);
  await expect(range).toHaveAttribute("aria-valuetext", "b = 2.4");
  await range.evaluate((element) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, "2.34");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(label).toHaveText("b = 2.3");
  await expect(page.getByText("A = 2b = 2 × 2.3 = 4.6 square units", { exact: true })).toBeVisible();
  expect(await page.locator("[data-integration-graph]").boundingBox()).toEqual(graph);
  expect(await page.locator("[data-integration-plane]").innerHTML()).toBe(axes);
});

for (const viewport of [{ width: 393, height: 852 }, { width: 390, height: 844 }]) {
  test(`Stage 1 inline units and separate label lanes at ${viewport.width} × ${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await open(page);
    const graph = page.locator("[data-integration-graph]");
    const functionLabel = graph.locator("text").filter({ hasText: /^y = 2$/ });
    const boundaryPlate = page.locator('[data-integration-boundary="b"] rect');
    const range = page.getByRole("slider", { name: "Right boundary", exact: true });
    const originalGraph = await graph.boundingBox();
    const originalLabel = await functionLabel.boundingBox();
    const originalPlane = await page.locator("[data-integration-plane]").innerHTML();
    for (const value of [0, 1, 3.1, 3.3, 3.5, 3.75, 4]) {
      await range.evaluate((element, nextValue) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(nextValue));
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }, value);
      const displayed = Math.round(value * 10) / 10;
      await expect(page.getByRole("math")).toHaveText(`A = 2b = 2 × ${displayed} = ${Math.round(displayed * 20) / 10} square units`);
      const plate = (await boundaryPlate.boundingBox())!;
      const label = (await functionLabel.boundingBox())!;
      expect(label.y - (plate.y + plate.height)).toBeGreaterThanOrEqual(8);
      expect(label).toEqual(originalLabel);
      expect(await graph.boundingBox()).toEqual(originalGraph);
      expect(await page.locator("[data-integration-plane]").innerHTML()).toBe(originalPlane);
      const dimensions = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth }));
      expect(dimensions.height).toBeLessThanOrEqual(viewport.height);
      expect(dimensions.width).toBeLessThanOrEqual(viewport.width);
      if (value === 3.75) await page.screenshot({ path: info.outputPath("stage-1-near-function-label.png"), fullPage: true });
    }
  });
}

test("both Tooltip triggers toggle, support keyboard, dismiss outside, and do not affect navigation", async ({ page }) => {
  await open(page); await next(page);
  const intro = page.getByRole("button", { name: "estimated", exact: true });
  const feedback = page.getByRole("button", { name: "Estimated", exact: true });
  const tooltip = page.getByRole("tooltip");
  const geometry = await page.locator("[data-integration-graph]").boundingBox();
  for (const trigger of [intro, feedback]) {
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await trigger.focus(); await page.keyboard.press("Enter");
    await expect(tooltip).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveAccessibleDescription(/Estimated area.*all the rectangles/);
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0); await expect(trigger).toBeFocused();
    await page.keyboard.press("Space"); await expect(tooltip).toBeVisible();
    await page.keyboard.press("Space"); await expect(tooltip).toHaveCount(0);
  }
  await intro.click(); await feedback.click(); await expect(tooltip).toHaveCount(1);
  await page.getByRole("slider", { name: /Rectangle width/ }).press("End");
  await expect(tooltip).toHaveCount(0);
  await expect(page.getByText("Rectangles: 128", { exact: true })).toBeVisible();
  await intro.click(); await page.keyboard.press("Tab"); await expect(tooltip).toHaveCount(0);
  await feedback.click();
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await expect(tooltip).toHaveCount(0);
  await page.getByRole("button", { name: "Close visualisations menu" }).click();
  await expect(tooltip).toHaveCount(0);
  expect(await page.locator("[data-integration-graph]").boundingBox()).toEqual(geometry);
  await feedback.click(); await previous(page);
  await expect(tooltip).toHaveCount(0);
  await next(page); await expect(page.getByText("Rectangles: 128", { exact: true })).toBeVisible();
});

test("touch Tooltip use has no learner-record side effects and enlarged text remains contained", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(); await open(page); await next(page);
    const groups: string[] = [];
    page.on("console", (message) => { if (message.type() === "startGroupCollapsed" && message.text().includes("Integration")) groups.push(message.text()); });
    const intro = page.getByRole("button", { name: "estimated", exact: true });
    const feedback = page.getByRole("button", { name: "Estimated", exact: true });
    const tooltip = page.getByRole("tooltip");
    await intro.tap(); await expect(tooltip).toBeVisible();
    await intro.tap(); await expect(tooltip).toHaveCount(0);
    await feedback.tap(); await expect(tooltip).toBeVisible();
    await page.touchscreen.tap(20, 200); await expect(tooltip).toHaveCount(0);
    expect(groups).toHaveLength(0);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addStyleTag({ content: "html {font-size:200%;}" });
    await feedback.focus(); await page.keyboard.press("Enter"); await expect(tooltip).toBeVisible();
    const box = (await tooltip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(8); expect(box.x + box.width).toBeLessThanOrEqual(312);
    expect(box.y).toBeGreaterThanOrEqual(8); expect(box.y + box.height).toBeLessThanOrEqual(560);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.keyboard.press("Escape"); await expect(tooltip).toHaveCount(0);
  } finally { await context.close(); }
});

test("Previous/Next preserves every seven-stage selection and never checks a restored draft", async ({ page }) => {
  await open(page);
  await page.getByRole("slider", { name: "Right boundary", exact: true }).press("ArrowRight");
  await next(page);
  await page.getByRole("slider", { name: /Rectangle width/ }).press("End");
  await page.getByRole("button", { name: "y = x", exact: true }).click();
  await next(page); await page.getByRole("button", { name: "It doubled", exact: true }).click();
  await next(page); await page.getByRole("button", { name: "y = x²", exact: true }).click();
  await page.getByRole("slider", { name: /Rectangle width/ }).press("End");
  await next(page); await page.getByRole("slider", { name: /^Right boundary: x = b/ }).press("ArrowLeft");
  await next(page); await page.getByRole("slider", { name: /^Right boundary: b/ }).press("ArrowLeft");
  await next(page); await page.getByRole("combobox", { name: "Second curve", exact: true }).selectOption("axis");
  await page.getByRole("radio", { name: "From 0 to 2", exact: true }).check();
  await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("22");
  await previous(page);
  await expect(page.getByRole("combobox", { name: "Second curve", exact: true })).toHaveValue("lower");
  await expect(page.getByRole("slider", { name: /^Right boundary: b/ })).toHaveValue("2.9");
  await previous(page); await expect(page.getByRole("slider", { name: /^Right boundary: x = b/ })).toHaveValue("2");
  await previous(page); await expect(page.getByRole("slider", { name: /Rectangle width/ })).toHaveValue("5");
  await previous(page); await expect(page.locator("p").getByText("Correct! The area doubled.", { exact: true })).toBeVisible();
  await previous(page); await expect(page.getByText("Rectangles: 128", { exact: true })).toBeVisible();
  await previous(page); await expect(page.getByRole("slider", { name: "Right boundary", exact: true })).toHaveValue("1.1");
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  for (let index = 0; index < 6; index++) await next(page);
  await expect(page.getByRole("radio", { name: "From 0 to 2", exact: true })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "Second curve", exact: true })).toHaveValue("axis");
  await expect(page.getByRole("textbox", { name: "Your answer", exact: true })).toHaveValue("22");
  await expect(page.getByRole("button", { name: "Finish", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Check calculation", exact: true }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your area calculation", exact: true })).toBeVisible();
  await page.locator("details summary").click();
  const snapshot = JSON.parse((await page.locator("[data-spv-records]").textContent())!);
  expect(snapshot.records.current.predictions).toHaveLength(1);
  expect(snapshot.records.current.checks).toHaveLength(1);
  expect(snapshot.receivedCompletions).toHaveLength(1);
});
