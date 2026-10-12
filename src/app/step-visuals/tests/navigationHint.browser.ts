import { expect, test, type Page } from "@playwright/test";

const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true });
const hint = (page: Page) => page.getByRole("tooltip");
const message = "Drag the green root to a new position first.";
const graph = (page: Page) => page.getByRole("img", { name: "Quadratic graph", exact: true });
const frame = (page: Page) => graph(page).evaluate((element) => {
  const box = element.getBoundingClientRect();
  return { x: box.x, y: box.y + window.scrollY, width: box.width, height: box.height, axes: element.children[4].outerHTML, viewBox: element.getAttribute("viewBox") };
});
const blocked = async (page: Page) => {
  await expect(next(page)).toHaveAttribute("aria-disabled", "true");
  expect(await next(page).evaluate((element) => (element as HTMLButtonElement).disabled)).toBe(false);
  await expect(page.locator("[data-spv-learning-stage]")).toHaveAttribute("data-spv-learning-stage", "orientation");
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "3");
};
const shown = async (page: Page) => {
  await blocked(page);
  await expect(hint(page)).toHaveText(message);
  await expect(next(page)).toHaveAccessibleDescription(message);
  await expect(page.locator("[data-spv-navigation]").getByRole("status")).toHaveText(message);
};

test.beforeEach(async ({ page }) => {
  await page.goto("/step-visuals");
  await expect(page.getByRole("slider")).toHaveAttribute("aria-disabled", "false");
});

for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }]) for (const enlarged of [false, true]) {
  test(`unavailable Next explains mouse attempts without shifting the graph at ${viewport.width}×${viewport.height}${enlarged ? " and 200% text" : ""}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    if (enlarged) await page.addStyleTag({ content: "html { font-size: 200%; }" });
    await expect.poll(async () => graph(page).evaluate((element) => Math.abs((element as SVGSVGElement).viewBox.baseVal.height - element.getBoundingClientRect().height))).toBeLessThan(0.1);
    await expect(hint(page)).toHaveCount(0);
    await blocked(page);
    const baseline = await frame(page);
    await next(page).scrollIntoViewIfNeeded();
    const button = await next(page).boundingBox();
    await page.mouse.click(button!.x + button!.width / 2, button!.y + button!.height / 2);
    await shown(page);
    expect(await frame(page)).toEqual(baseline);
    const bounds = await hint(page).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: testInfo.outputPath("next-prerequisite.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(hint(page)).toHaveCount(0);
    await blocked(page);
  });
}

test("Enter and Space explain the unavailable Next; moving the root dismisses the hint and enables progression", async ({ page }) => {
  const baseline = await frame(page);
  await next(page).focus();
  await page.keyboard.press("Enter");
  await shown(page);
  await expect(next(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(hint(page)).toHaveCount(0);
  await page.keyboard.press("Space");
  await shown(page);
  await page.getByRole("slider").focus();
  await expect(hint(page)).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(next(page)).toBeEnabled();
  expect(await frame(page)).toEqual(baseline);
  await next(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-spv-learning-stage]")).toHaveAttribute("data-spv-learning-stage", "prediction");
  await expect(hint(page)).toHaveCount(0);
});

test("touch attempts explain Next without granting eligibility, and an outside tap dismisses the message", async ({ browser, browserName, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: browserName === "chromium" });
  const page = await context.newPage();
  try {
    await page.goto("/step-visuals");
    await expect(page.getByRole("slider")).toHaveAttribute("aria-disabled", "false");
    await next(page).scrollIntoViewIfNeeded();
    const box = await next(page).boundingBox();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await shown(page);
    await page.getByRole("heading", { name: "Explore", exact: true }).tap();
    await expect(hint(page)).toHaveCount(0);
    await blocked(page);
    await expect(page.getByRole("combobox").locator("option")).toHaveCount(6);
  } finally { await context.close(); }
});

test("all guided progression labels are Next and Finished offers only Start again", async ({ page }) => {
  const noOldActions = async () => expect(page.getByRole("button", { name: /^(Continue|Try again|Keep exploring|Done)$/ })).toHaveCount(0);
  await noOldActions();
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await next(page).click();
  await noOldActions();
  await page.getByRole("button", { name: "(x + 3)", exact: true }).click();
  await page.getByRole("slider").focus();
  for (let index = 0; index < 7; index++) await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "Explain", exact: true })).toBeFocused();
  await expect(next(page)).toBeEnabled();
  await noOldActions();
  await next(page).click();
  const task = page.getByRole("math");
  await expect(task).toHaveAccessibleName("Factor: (x + 4). Root = ?");
  await expect(task.getByText("Factor:", { exact: true })).toBeVisible();
  await expect(task.getByText("(x + 4)", { exact: true })).toBeVisible();
  await expect(task.getByText("Root = ?", { exact: true })).toBeVisible();
  await expect(page.getByText("f(x) =", { exact: true })).toHaveCount(0);
  await noOldActions();
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const prompt = page.locator("[data-spv-prompt]");
  await expect(page.getByRole("heading", { name: "Finished", exact: true })).toBeFocused();
  await expect(prompt).toContainText("You found the correct root!");
  await expect(prompt).toContainText("The factor is (x + 4), so the root is x = −4.");
  await expect(prompt.getByText("−4 + 4 = 0", { exact: true })).toBeVisible();
  await expect(prompt).toContainText("The factor equals zero at the root.");
  await expect(prompt.getByText("(x + 4) = 0", { exact: true })).toHaveCount(0);
  await noOldActions();
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeFocused();
  await blocked(page);
  await expect(hint(page)).toHaveCount(0);
});
