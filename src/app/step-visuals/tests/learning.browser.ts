import { expect, test, type Page } from "@playwright/test";

const slider = (page: Page) => page.getByRole("slider", { name: "Movable root" });
const graph = (page: Page) => page.getByRole("img", { name: "Quadratic graph", exact: true });
const surface = (page: Page) => page.locator("[data-spv-learning-stage]");
const stage = (page: Page, value: string) => expect(surface(page)).toHaveAttribute("data-spv-learning-stage", value);
const position = async (page: Page, root: number) => graph(page).evaluate((element, value) => {
  const svg = element as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const plot = svg.querySelector("clipPath rect")!;
  return { x: rect.x + (Number(plot.getAttribute("x")) + Number(plot.getAttribute("width")) * (value + 6) / 12) * rect.width / svg.viewBox.baseVal.width,
    y: rect.y + (Number(plot.getAttribute("y")) + Number(plot.getAttribute("height")) / 2) * rect.height / svg.viewBox.baseVal.height };
}, root);
const begin = async (page: Page) => {
  await slider(page).scrollIntoViewIfNeeded();
  const point = await position(page, Number(await slider(page).getAttribute("aria-valuenow")));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(surface(page)).toHaveAttribute("data-spv-editing", "true");
};
const move = async (page: Page, root: number) => { const point = await position(page, root); await page.mouse.move(point.x, point.y); };
const step = async (page: Page, key: "ArrowLeft" | "ArrowRight") => { await slider(page).focus(); await page.keyboard.press(key); };
const makePrediction = async (page: Page, choice: "minus" | "plus") => {
  await step(page, "ArrowRight");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: choice === "minus" ? "(x − 3)" : "(x + 3)", exact: true }).click();
  await stage(page, "reveal-position");
};
const settleByKeyboard = async (page: Page, root: number) => {
  await slider(page).focus();
  while (Number(await slider(page).getAttribute("aria-valuenow")) !== root) await page.keyboard.press(Number(await slider(page).getAttribute("aria-valuenow")) > root ? "ArrowLeft" : "ArrowRight");
};
const frame = (page: Page) => graph(page).evaluate((element) => {
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height, x: rect.x, y: rect.y + window.scrollY, box: element.getAttribute("viewBox"),
    axes: element.children[4].outerHTML, fixed: [...element.querySelector('[data-spv-root="fixed-root"]')!.querySelectorAll("text,rect")].map((node) => node.outerHTML) };
});

test.beforeEach(async ({ page }) => {
  await page.goto("/step-visuals");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByRole("combobox", { name: "Layout preview" })).toHaveValue("guided");
});

test("quiet footer Next replaces redundant controls without moving the graph when enabled", async ({ page, browserName }) => {
  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeVisible();
  await expect(page.getByText("Drag the green root and see how the graph and factor change.", { exact: true })).toBeVisible();
  await expect(page.getByRole("banner").getByText("Lab", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Move root (left|right)/ })).toHaveCount(0);
  await expect(page.getByText("Root position", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-spv-adjustments]")).toHaveCount(0);
  await expect(next).toBeDisabled();
  const before = await frame(page);
  const button = await next.boundingBox();
  const region = await page.getByRole("region", { name: "Roots and factors" }).boundingBox();
  expect(button!.height).toBeGreaterThanOrEqual(44);
  expect(button!.width).toBeGreaterThanOrEqual(44);
  expect(button!.width).toBeLessThan(region!.width / 2);
  expect(button!.x + button!.width).toBeCloseTo(region!.x + region!.width, 1);
  expect(button!.y).toBeGreaterThan(before.y + before.height);
  await step(page, "ArrowRight");
  await expect(next).toBeEnabled();
  expect(await frame(page)).toEqual(before);
  // macOS WebKit follows Safari's native preference: Option-Tab includes buttons.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await stage(page, "prediction");
  await expect(page.getByRole("heading", { name: "Predict", exact: true })).toBeFocused();
  expect(await frame(page)).toEqual(before);
});

test("Next fits the reported 393×852 phone viewport at 100% scale", async ({ browser, browserName, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: browserName === "chromium" });
  const page = await context.newPage();
  try {
    await page.goto("/step-visuals");
    await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
    const next = page.getByRole("button", { name: "Next", exact: true });
    const bounds = await next.boundingBox();
    const viewport = await page.evaluate(() => ({ height: window.visualViewport!.height, scale: window.visualViewport!.scale, scroll: window.scrollY }));
    expect(viewport.scale).toBe(1);
    expect(viewport.scroll).toBe(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 8);
    await step(page, "ArrowRight");
    await expect(next).toBeEnabled();
    expect(await next.boundingBox()).toEqual(bounds);
  } finally { await context.close(); }
});

test("guided is default; readiness requires a changed commit and remains an explicit choice", async ({ page }) => {
  await expect(page.getByRole("combobox").locator("option")).toHaveCount(6);
  const ready = page.getByRole("button", { name: "Next" });
  await expect(ready).toBeDisabled();
  await begin(page);
  await page.mouse.up();
  await expect(ready).toBeDisabled();
  await begin(page);
  await move(page, 4.2);
  await expect(ready).toBeDisabled();
  await slider(page).dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await page.mouse.up();
  await expect(ready).toBeDisabled();
  await begin(page);
  await move(page, 4);
  await move(page, 3);
  await page.mouse.up();
  await expect(ready).toBeDisabled();
  await begin(page);
  await move(page, 4.2);
  await page.mouse.up();
  await expect(ready).toBeEnabled();
  await stage(page, "orientation");
  await expect(page.getByRole("status")).toHaveText("Next is now available.");
  await begin(page);
  await expect(ready).toBeDisabled();
  await slider(page).dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await page.mouse.up();
  await expect(ready).toBeEnabled();
});

test("server markup and calibration contain no premature solution; preview activity cannot grant eligibility", async ({ page, request }) => {
  const response = await request.get("/step-visuals");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).not.toContain("−3 + 3 = 0");
  expect(html).not.toContain("Matching factor");
  expect(html).not.toContain("(x + 3)");
  const dropdown = page.getByRole("combobox", { name: "Layout preview" });
  await dropdown.selectOption("orientation");
  await step(page, "ArrowRight");
  await dropdown.selectOption("prediction");
  await expect(page.getByRole("button", { name: "(x + 3)", exact: true })).toBeDisabled();
  await dropdown.selectOption("guided");
  await stage(page, "orientation");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "3");
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
});

test("keyboard eligibility preserves a noninitial root through prediction and unlocks negative bounds", async ({ page }) => {
  await slider(page).focus();
  await page.keyboard.press("Home");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "0");
  await expect(slider(page)).toBeFocused();
  await page.getByRole("button", { name: "Next" }).click();
  await stage(page, "prediction");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "0");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("heading", { name: "Predict" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Predict" })).toHaveAccessibleDescription("If the movable root becomes x = −3, which factor will it produce?");
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times a hidden factor");
  await page.getByRole("button", { name: "(x + 3)", exact: true }).click();
  await stage(page, "reveal-position");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "0");
  await expect(slider(page)).toHaveAttribute("aria-valuemin", "-5");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByRole("heading", { name: "Test" })).toBeFocused();
  await expect(page.locator("[data-spv-prompt]")).toContainText("Your prediction");
  await expect(page.getByText("Matching factor", { exact: true })).toHaveCount(0);
});

for (const choice of ["minus", "plus"] as const) {
  test(`${choice} prediction: settled −3 gives the correct branch and Continue opens only retrieval entry`, async ({ page }) => {
    await makePrediction(page, choice);
    await settleByKeyboard(page, -3);
    await stage(page, "reveal-explanation");
    await expect(slider(page)).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times (x + 3)");
    await expect(page.getByRole("heading", { name: "Explain" })).toBeFocused();
    await expect(page.locator("[data-spv-prompt]")).toContainText("−3 + 3 = 0");
    await expect(page.getByText("−3 − 3 = −6", { exact: true })).toHaveCount(choice === "minus" ? 1 : 0);
    await expect(page.locator("[data-spv-prompt]")).toContainText("At a root, its corresponding linear factor must equal zero.");
    await expect(page.getByText(/Your prediction matches\./)).toHaveCount(choice === "plus" ? 1 : 0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await stage(page, "retrieval-entry");
    await expect(slider(page)).toHaveAttribute("aria-valuenow", "-3");
    await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
    await expect(page.getByRole("heading", { name: "Try" })).toBeFocused();
    await expect(page.locator("[data-spv-prompt]")).toContainText("(x + 4)");
    await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times a hidden factor");
    for (const label of ["Check", "Show explanation", "Keep exploring"]) await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    await step(page, "ArrowLeft");
    await expect(slider(page)).toHaveAttribute("aria-valuenow", "-4");
    await stage(page, "retrieval-entry");
    await expect(page.getByRole("heading", { name: "Activity complete" })).toHaveCount(0);
  });
}

test("passing −3, rounded −3 and other negative commits stay masked until final release at −3", async ({ page }) => {
  await makePrediction(page, "minus");
  await begin(page);
  const before = await graph(page).locator("[data-spv-curve]").getAttribute("d");
  await move(page, -3);
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-3");
  await stage(page, "reveal-position");
  await move(page, -2.8);
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-3");
  expect(Number(await surface(page).getAttribute("data-spv-graphical-root"))).not.toBe(-3);
  expect(await graph(page).locator("[data-spv-curve]").getAttribute("d")).not.toBe(before);
  await stage(page, "reveal-position");
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times a hidden factor");
  expect(await page.locator("body").textContent()).not.toContain("(x + 3)");
  await expect(graph(page)).not.toHaveAccessibleDescription(/\(x \+ 3\)|Matching factor|−3 \+ 3 = 0/);
  const hidden = await page.locator("[inert]").allTextContents();
  expect(hidden.join(" ")).not.toMatch(/Matching factor|\(x [−+] 3\)|−3 [−+] 3/);
  await move(page, -2.1);
  await page.mouse.up();
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-2");
  await stage(page, "reveal-position");
  await begin(page);
  // Commit the actual pointer-up coordinates, not the last preview.
  const final = await position(page, -3);
  await slider(page).dispatchEvent("pointerup", { pointerId: 1, clientX: final.x, clientY: final.y, button: 0, isPrimary: true });
  await page.mouse.up();
  await stage(page, "reveal-explanation");
});

test("previews preserve the guided session, cancel active edits and cannot change its progress", async ({ page }) => {
  await makePrediction(page, "minus");
  await begin(page);
  await move(page, -2.8);
  const dropdown = page.getByRole("combobox", { name: "Layout preview" });
  await dropdown.selectOption("incorrect-reveal");
  await page.mouse.up();
  await expect(surface(page)).toHaveCount(0); // No hidden guided graph/answer DOM.
  await dropdown.selectOption("orientation");
  await step(page, "ArrowLeft");
  await dropdown.selectOption("guided");
  await stage(page, "reveal-position");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "4");
  await expect(surface(page)).toHaveAttribute("data-spv-editing", "false");
  await expect(page.locator("[data-spv-prompt]")).toContainText("(x − 3)");
  await settleByKeyboard(page, -3);
  await dropdown.selectOption("assistance");
  await dropdown.selectOption("guided");
  await stage(page, "reveal-explanation");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await step(page, "ArrowLeft");
  await dropdown.selectOption("prediction");
  await dropdown.selectOption("guided");
  await stage(page, "retrieval-entry");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-4");
  await page.getByRole("button", { name: "Restart guided activity" }).click();
  await stage(page, "orientation");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "3");
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
});

test("menu interruption discards a candidate but preserves the mathematical and learning session", async ({ page }) => {
  await makePrediction(page, "plus");
  await begin(page);
  await move(page, -3);
  await page.getByRole("button", { name: "Open visualisations menu" }).dispatchEvent("click");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await stage(page, "reveal-position");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "4");
  await expect(surface(page)).toHaveAttribute("data-spv-editing", "false");
  await expect(page.getByRole("button", { name: "Open visualisations menu" })).toBeFocused();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }]) for (const choice of ["minus", "plus"] as const) {
  test(`all guided stages (${choice}) retain graph geometry, axes and fixed label at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await expect.poll(async () => graph(page).evaluate((element) => Math.abs((element as SVGSVGElement).viewBox.baseVal.width - element.getBoundingClientRect().width))).toBeLessThan(0.1);
    const baseline = await frame(page);
    await step(page, "ArrowRight");
    expect(await frame(page)).toEqual(baseline);
    await page.getByRole("button", { name: "Next" }).click();
    expect(await frame(page)).toEqual(baseline);
    await page.getByRole("button", { name: choice === "minus" ? "(x − 3)" : "(x + 3)", exact: true }).click();
    expect(await frame(page)).toEqual(baseline);
    await begin(page);
    await move(page, 1);
    expect(await frame(page)).toEqual(baseline);
    await move(page, -3);
    await page.mouse.up();
    await stage(page, "reveal-explanation");
    expect(await frame(page)).toEqual(baseline);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("guided-reveal.png"), fullPage: true });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    expect(await frame(page)).toEqual(baseline);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const choice of ["minus", "plus"] as const) test(`200% text keeps guided stages (${choice}) geometrically stable and actions reachable`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await expect.poll(async () => graph(page).evaluate((element) => Math.abs((element as SVGSVGElement).viewBox.baseVal.height - element.getBoundingClientRect().height))).toBeLessThan(0.1);
  const baseline = await frame(page);
  await makePrediction(page, choice);
  expect(await frame(page)).toEqual(baseline);
  await settleByKeyboard(page, -3);
  expect(await frame(page)).toEqual(baseline);
  const button = page.getByRole("button", { name: "Continue", exact: true });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeInViewport();
  expect(await page.locator("[data-spv-prompt]").evaluate((element) => [...element.querySelectorAll<HTMLElement>("p,dt,dd,button")].every((node) => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  await button.click();
  expect(await frame(page)).toEqual(baseline);
});

test("Chromium touch committed placement enables Next without automatically progressing", async ({ page, browserName, context }) => {
  test.skip(browserName !== "chromium", "Native WebKit touch dragging requires physical-device verification.");
  const cdp = await context.newCDPSession(page);
  const start = await position(page, 3);
  const end = await position(page, 4.2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 0 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...end, id: 0 }] });
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
  await stage(page, "orientation");
});
