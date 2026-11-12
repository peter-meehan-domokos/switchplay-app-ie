import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const open = async (page: Page) => {
  await page.goto("/step-visuals");
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  await page.getByRole("button", { name: "Integration", exact: true }).click();
  await page.locator("li").getByRole("button", { name: "Integration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1. Area under a graph", exact: true })).toBeVisible();
};
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true }).click();
const dimensions = (page: Page) => page.evaluate(() => ({
  width: innerWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight,
  scrollWidth: document.documentElement.scrollWidth, scrollY,
}));

for (const viewport of [{ width: 393, height: 852 }, { width: 390, height: 844 }]) {
  test(`refined introductory compositions, navigation and tooltip screenshots at ${viewport.width} × ${viewport.height}`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await open(page);
    const measurements: Record<string, unknown> = {};
    const capture = async (name: string) => {
      await page.evaluate(() => scrollTo(0, 0));
      const measured = await dimensions(page);
      measurements[name] = measured;
      expect(measured.scrollHeight, `${name}: vertical overflow`).toBeLessThanOrEqual(viewport.height);
      expect(measured.scrollWidth).toBeLessThanOrEqual(viewport.width);
      for (const control of await page.locator("[data-integration-intro] button, [data-integration-intro] input, [data-integration-intro] p, [data-integration-graph]").all()) {
        const rect = (await control.boundingBox())!;
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height, `${name}: content below screen`).toBeLessThanOrEqual(viewport.height);
      }
      await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
      await writeFile(info.outputPath("viewport-measurements.json"), JSON.stringify(measurements, null, 2));
    };
    const graph = page.locator("[data-integration-graph]");
    const plane = page.locator("[data-integration-plane]");
    const boundary = page.getByRole("slider", { name: "Right boundary", exact: true });
    await expect(boundary).toHaveValue("1");
    await expect(page.getByText("A = 2b = 2 × 1 = 2 square units", { exact: true })).toBeVisible();
    expect((await boundary.boundingBox())!.y).toBeGreaterThanOrEqual((await graph.boundingBox())!.y + (await graph.boundingBox())!.height);
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
    const firstFrame = await graph.boundingBox();
    const firstPlane = await plane.innerHTML();
    await capture("01-stage-1-initial-b-1");
    await boundary.press("ArrowRight");
    await boundary.press("ArrowRight");
    await expect(boundary).toHaveValue("1.2");
    await expect(page.getByText("A = 2b = 2 × 1.2 = 2.4 square units", { exact: true })).toBeVisible();
    expect(await graph.boundingBox()).toEqual(firstFrame);
    expect(await plane.innerHTML()).toBe(firstPlane);
    await capture("02-stage-1-boundary-moved");
    await next(page);
    await expect(page.getByRole("heading", { name: "2. Refine the rectangles", exact: true })).toBeVisible();
    const constant = page.getByRole("button", { name: "y = 2", exact: true });
    const rising = page.getByRole("button", { name: "y = x", exact: true });
    await expect(constant).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Rectangles: 4", { exact: true })).toBeVisible();
    await expect(page.getByText("Estimated area = 6 square units", { exact: true })).toBeVisible();
    await expect(page.getByText("Actual area = 6 square units", { exact: true })).toBeVisible();
    const selector = (await page.getByRole("group", { name: "Graph selector" }).boundingBox())!;
    expect(selector.y + selector.height).toBeLessThanOrEqual((await graph.boundingBox())!.y);
    await expect(page.getByRole("slider")).toHaveCount(1);
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
    const refinement = page.getByRole("slider", { name: /Rectangle width/ });
    const secondFrame = await graph.boundingBox();
    const secondPlane = await plane.innerHTML();
    await capture("03-stage-2-constant-four-rectangles");
    await rising.click();
    await expect(page.getByText("Estimated area ≈ 5.63 square units", { exact: true })).toBeVisible();
    await expect(page.getByText("Actual area = 4.5 square units", { exact: true })).toBeVisible();
    await capture("04-stage-2-rising-four-rectangles");
    await refinement.press("End");
    await expect(page.getByText("Rectangles: 128", { exact: true })).toBeVisible();
    await expect(page.getByText("Estimated area ≈ 4.54 square units", { exact: true })).toBeVisible();
    await capture("05-stage-2-narrower-rectangles");
    await constant.click();
    await expect(page.getByText("Estimated area = 6 square units", { exact: true })).toBeVisible();
    await expect(page.getByText("Actual area = 6 square units", { exact: true })).toBeVisible();
    await capture("06-stage-2-return-to-constant");
    await rising.click();
    await expect(page.getByText("Estimated area ≈ 4.54 square units", { exact: true })).toBeVisible();
    await capture("07-stage-2-return-to-rising");
    expect(await graph.boundingBox()).toEqual(secondFrame);
    expect(await plane.innerHTML()).toBe(secondPlane);
    for (const [name, screenshot] of [["estimated", "08-tooltip-instruction"], ["Estimated", "09-tooltip-feedback"]] as const) {
      const trigger = page.getByRole("button", { name, exact: true });
      await trigger.click();
      const tooltip = page.getByRole("tooltip");
      await expect(tooltip).toContainText("The estimated area is found by adding together the areas of all the rectangles.");
      await expect(trigger).toHaveAccessibleDescription(/Estimated area.*adding together/);
      const rect = (await tooltip.boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(8); expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width - 8);
      expect(rect.y).toBeGreaterThanOrEqual(8); expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - 8);
      expect(await graph.boundingBox()).toEqual(secondFrame);
      await capture(screenshot);
      await trigger.click(); await expect(tooltip).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(boundary).toHaveValue("1.2");
    await next(page);
    await expect(rising).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Rectangles: 128", { exact: true })).toBeVisible();
    await refinement.press("Home");
    await refinement.press("ArrowRight");
    await expect(page.getByText("Rectangles: 2", { exact: true })).toBeVisible();
    await refinement.press("ArrowLeft");
    await expect(page.getByText("Rectangles: 1", { exact: true })).toBeVisible();
    await info.attach("viewport-measurements", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
    console.log("INTRO_VIEWPORT_MEASUREMENTS", JSON.stringify(measurements));

  });
}

test("native boundary range supports touch without dragging and continuous transactional movement", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage(); await open(page);
    const input = page.getByRole("slider", { name: "Right boundary", exact: true });
    const graphHandle = page.getByRole("slider", { name: "Right boundary on graph", exact: true });
    const box = (await input.boundingBox())!;
    await input.tap({ position: { x: box.width * .8, y: box.height / 2 } });
    expect(Number(await input.inputValue())).toBeGreaterThan(1);
    const prior = Number(await input.inputValue());
    const cdp = await context.newCDPSession(page);
    const start = box.x + 8 + (box.width - 16) * prior / 4;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start, y: box.y + box.height / 2, id: 0 }] });
    const before = await page.locator("[data-integration-region]").getAttribute("d");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start - 28, y: box.y + box.height / 2, id: 0 }] });
    expect(Number(await input.inputValue())).toBeLessThan(prior);
    expect(await page.locator("[data-integration-region]").getAttribute("d")).not.toBe(before);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(graphHandle).toHaveAttribute("aria-valuenow", await input.inputValue());
    await next(page);
    const refinement = page.getByRole("slider", { name: /Rectangle width/ });
    const range = (await refinement.boundingBox())!;
    const thumb = range.x + 8 + (range.width - 16) * 2 / 7;
    const logs: string[] = [];
    page.on("console", (message) => { if (message.type() === "startGroupCollapsed" && message.text().includes("Integration")) logs.push(message.text()); });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: thumb, y: range.y + range.height / 2, id: 0 }] });
    for (let delta = 10; delta <= 70; delta += 10) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: thumb + delta, y: range.y + range.height / 2, id: 0 }] });
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    expect(logs).toHaveLength(0);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    await expect.poll(() => logs.length).toBe(process.env.SPV_CONSOLE_PRODUCTION === "1" ? 0 : 1);
    const settledCount = await refinement.getAttribute("aria-valuetext");
    const settledPosition = Number(await refinement.inputValue());
    const currentThumb = range.x + 8 + (range.width - 16) * settledPosition / 7;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: currentThumb, y: range.y + range.height / 2, id: 0 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: currentThumb - 20, y: range.y + range.height / 2, id: 0 }] });
    await refinement.press("Escape");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: currentThumb - 40, y: range.y + range.height / 2, id: 0 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(refinement).toHaveAttribute("aria-valuetext", settledCount!);
    expect(logs.length).toBe(process.env.SPV_CONSOLE_PRODUCTION === "1" ? 0 : 1);
  } finally { await context.close(); }
});

test("introductory controls reflow at 200% text; continuous values do not change normal graph geometry", async ({ page }) => {
  await open(page);
  const graph = page.locator("[data-integration-graph]");
  const frame = await graph.boundingBox();
  const range = page.getByRole("slider", { name: "Right boundary", exact: true });
  for (const value of [0, .01, 1, 2.375, 3.999, 4]) {
    await range.evaluate((element, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    expect(await graph.boundingBox()).toEqual(frame);
    expect((await dimensions(page)).scrollHeight).toBeLessThanOrEqual(844);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await expect.poll(async () => (await dimensions(page)).scrollWidth).toBeLessThanOrEqual(320);
  expect((await graph.boundingBox())!.height).toBeGreaterThanOrEqual(200);
  await range.press("Home"); await range.press("ArrowRight");
  await expect(range).toHaveValue("0.1");
  await next(page);
  const refinement = page.getByRole("slider", { name: /Rectangle width/ });
  await refinement.press("Home"); await refinement.press("ArrowRight");
  await expect(page.getByText("Rectangles: 2", { exact: true })).toBeVisible();
  expect((await dimensions(page)).scrollWidth).toBeLessThanOrEqual(320);
  for (const control of await page.locator("[data-integration-intro] button:not([data-spv-tooltip-trigger]), [data-integration-intro] input").all()) {
    const rect = (await control.boundingBox())!;
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(320);
  }
});

test("normal 700px phone browser height fits both intro stages without shrinking text or targets", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 700 });
  await open(page);
  const fits = async () => {
    await expect.poll(async () => (await dimensions(page)).scrollHeight).toBeLessThanOrEqual(700);
    expect((await page.locator("[data-integration-graph]").boundingBox())!.height).toBeGreaterThanOrEqual(200);
  };
  await fits();
  await next(page); await fits();
  await page.getByRole("button", { name: "y = 2", exact: true }).click(); await fits();
  await page.getByRole("button", { name: "y = x", exact: true }).click(); await fits();
});
