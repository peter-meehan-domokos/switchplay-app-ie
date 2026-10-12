import { expect, test, type Page } from "@playwright/test";

const slider = (page: Page) => page.getByRole("slider", { name: "Movable root" });
const graph = (page: Page) => page.getByRole("img", { name: "Quadratic graph", exact: true });
const prompt = (page: Page) => page.locator("[data-spv-prompt]");
const surface = (page: Page) => page.locator("[data-spv-learning-stage]");
const check = (page: Page) => page.getByRole("button", { name: "Check", exact: true });
const help = (page: Page) => page.getByRole("button", { name: "Show explanation", exact: true });
const stage = (page: Page, value: string) => expect(surface(page)).toHaveAttribute("data-spv-learning-stage", value);
const rootTo = async (page: Page, root: number) => {
  await slider(page).focus();
  for (let steps = 0; steps <= 10; steps++) {
    const current = Number(await slider(page).getAttribute("aria-valuenow"));
    if (current === root) return;
    await page.keyboard.press(current > root ? "ArrowLeft" : "ArrowRight");
  }
  throw new Error("Keyboard root did not reach requested position");
};
const enterTry = async (page: Page) => {
  await rootTo(page, 4);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "(x − 3)", exact: true }).click();
  await rootTo(page, -3);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await stage(page, "retrieval");
};
const frame = (page: Page) => graph(page).evaluate((element) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y + window.scrollY, width: rect.width, height: rect.height, box: element.getAttribute("viewBox"), axes: element.children[4].outerHTML,
    fixedLabel: [...element.querySelector('[data-spv-root="fixed-root"]')!.querySelectorAll("text,rect")].map((node) => node.outerHTML) };
});
const point = (page: Page, root: number) => graph(page).evaluate((element, value) => {
  const svg = element as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const plot = svg.querySelector("clipPath rect")!;
  return { x: rect.x + (Number(plot.getAttribute("x")) + Number(plot.getAttribute("width")) * (value + 6) / 12) * rect.width / svg.viewBox.baseVal.width,
    y: rect.y + (Number(plot.getAttribute("y")) + Number(plot.getAttribute("height")) / 2) * rect.height / svg.viewBox.baseVal.height };
}, root);
const begin = async (page: Page) => {
  await slider(page).scrollIntoViewIfNeeded();
  const start = await point(page, Number(await slider(page).getAttribute("aria-valuenow")));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect(surface(page)).toHaveAttribute("data-spv-editing", "true");
};
const move = async (page: Page, root: number) => { const position = await point(page, root); await page.mouse.move(position.x, position.y); };
const cancel = async (page: Page) => { await slider(page).dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true }); await page.mouse.up(); };
const masked = async (page: Page) => {
  await expect(page.getByRole("math")).toHaveAccessibleName("Factor: (x + 4). Root = ?");
  await expect(page.getByText("Factor:", { exact: true })).toBeVisible();
  await expect(page.getByText("Root = ?", { exact: true })).toBeVisible();
  await expect(page.getByText("f(x) =", { exact: true })).toHaveCount(0);
  await expect(graph(page)).toHaveAccessibleDescription(/hidden factor/);
};
const noWorkedAnswer = async (page: Page) => {
  await expect(prompt(page).getByText("x = −4", { exact: true })).toHaveCount(0);
  await expect(page.getByText("(x + 4) = 0", { exact: true })).toHaveCount(0);
  await expect(page.getByText("−4 + 4 = 0", { exact: true })).toHaveCount(0);
  expect((await page.locator("[inert]").allTextContents()).join(" ")).not.toMatch(/\(x \+ 4\)|x = −4|−4 \+ 4 = 0/);
};

test.beforeEach(async ({ page }) => {
  await page.goto("/step-visuals");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
});

test("Try offers Check immediately at inherited −3 without leaking the worked answer", async ({ page, request }) => {
  const html = await (await request.get("/step-visuals")).text();
  expect(html).not.toContain("(x + 4) = 0");
  expect(html).not.toContain("x = −4");
  await enterTry(page);
  await expect(page.getByRole("heading", { name: "Try", exact: true })).toBeFocused();
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-3");
  await expect(slider(page)).toHaveAttribute("aria-valuemin", "-5");
  await expect(slider(page)).toHaveAttribute("aria-valuemax", "5");
  await expect(prompt(page)).toContainText("Drag the green root to the correct position for (x + 4).");
  await expect(check(page)).toBeEnabled();
  await expect(page.locator("[data-spv-navigation] button")).toHaveText("Check");
  await expect(help(page)).toHaveCount(0);
  await masked(page);
  await noWorkedAnswer(page);
  await expect(graph(page)).not.toHaveAccessibleDescription(/\(x \+ 4\)|x = −4/);
  await expect(page.getByRole("button", { name: /Move root (left|right)|Ready to predict/ })).toHaveCount(0);
  await expect(page.getByText("Root position", { exact: true })).toHaveCount(0);
});

test("wrong Checks announce feedback, allow retries and offer help without opening it", async ({ page }) => {
  await enterTry(page);
  const baseline = await frame(page);
  await check(page).focus();
  await page.keyboard.press("Enter");
  await expect(check(page)).toBeFocused();
  await expect(prompt(page)).toContainText("Not quite. Move the green root and try again.");
  await expect(page.getByRole("status")).toHaveText("Not quite. Move the green root and try again. Show explanation is available.");
  await expect(help(page)).toBeEnabled();
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
  await masked(page);
  await noWorkedAnswer(page);
  const firstAnnouncement = await page.getByRole("status").locator("span").elementHandle();
  await page.keyboard.press("Enter");
  expect(await firstAnnouncement!.evaluate((element) => element.isConnected)).toBe(false);
  expect(await frame(page)).toEqual(baseline);
  await stage(page, "retrieval");
});

test("feedback survives transient, cancelled and unchanged drags and clears only after changed placement", async ({ page }) => {
  await enterTry(page);
  await check(page).click();
  await begin(page);
  await move(page, -4.1);
  await expect(prompt(page)).toContainText("Not quite. Move the green root and try again.");
  await expect(check(page)).toBeDisabled();
  await expect(help(page)).toBeDisabled();
  await cancel(page);
  await expect(prompt(page)).toContainText("Not quite. Move the green root and try again.");
  await begin(page);
  await move(page, -4);
  await move(page, -3);
  await page.mouse.up();
  await expect(prompt(page)).toContainText("Not quite. Move the green root and try again.");
  await rootTo(page, -2);
  await expect(prompt(page).getByText("Not quite. Move the green root and try again.", { exact: true })).toHaveCount(0);
  await expect(help(page)).toBeEnabled();
  await expect(check(page)).toBeEnabled();
  await stage(page, "retrieval");
  await noWorkedAnswer(page);
});

test("continuous fractional dragging and release at −4 do not assess; only explicit keyboard Check completes", async ({ page }) => {
  await enterTry(page);
  const baseline = await frame(page);
  await begin(page);
  let previous = await graph(page).locator("[data-spv-curve]").getAttribute("d");
  for (const root of [-3.25, -3.7, -4, -4.2]) {
    await move(page, root);
    const actual = Number(await surface(page).getAttribute("data-spv-graphical-root"));
    if (root !== -4) expect(Number.isInteger(actual)).toBe(false);
    const path = await graph(page).locator("[data-spv-curve]").getAttribute("d");
    expect(path).not.toBe(previous);
    previous = path;
    await expect(check(page)).toBeDisabled();
    await stage(page, "retrieval");
    await masked(page);
    await noWorkedAnswer(page);
    expect(await frame(page)).toEqual(baseline);
  }
  await page.mouse.up();
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-4");
  await expect(surface(page)).toHaveAttribute("data-spv-settled-root", "-4");
  await stage(page, "retrieval");
  await expect(check(page)).toBeEnabled();
  await noWorkedAnswer(page);
  await check(page).focus();
  await page.keyboard.press("Enter");
  await stage(page, "completed");
  await expect(page.getByRole("heading", { name: "Finished", exact: true })).toBeFocused();
  await expect(page.getByText("−4 + 4 = 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times (x + 4)");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "true");
  await slider(page).dispatchEvent("keydown", { key: "End" });
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-4");
  expect(await frame(page)).toEqual(baseline);
  await expect(page.getByRole("button", { name: "Start again", exact: true })).toBeEnabled();
  await expect(check(page)).toHaveCount(0);
});

test("assistance preserves the root and permits direct manipulation without Try again", async ({ page }) => {
  await enterTry(page);
  await rootTo(page, 1);
  await check(page).click();
  await help(page).click();
  await expect(page.getByRole("heading", { name: "Explain", exact: true })).toBeFocused();
  await expect(page.getByText("(x + 4) = 0", { exact: true })).toBeVisible();
  await expect(prompt(page).getByText("x = −4", { exact: true })).toBeVisible();
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "1");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
  await masked(page);
  await expect(check(page)).toBeEnabled();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
  await begin(page);
  await move(page, -3.7);
  await expect(check(page)).toBeDisabled();
  await expect(prompt(page).getByText("x = −4", { exact: true })).toBeVisible();
  await cancel(page);
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "1");
  await rootTo(page, 0);
  await check(page).click();
  await expect(page.getByRole("heading", { name: "Try", exact: true })).toBeFocused();
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "0");
  await noWorkedAnswer(page);
  await check(page).click();
  await help(page).click();
  await rootTo(page, -4);
  await stage(page, "retrieval");
  await expect(prompt(page).getByText("x = −4", { exact: true })).toBeVisible();
  await check(page).click();
  await stage(page, "completed");
  await expect(prompt(page)).toContainText("You found the correct root!");
  await expect(prompt(page)).toContainText("The factor is (x + 4), so the root is x = −4.");
  expect(await prompt(page).textContent()).not.toMatch(/score|points|assisted|independent/i);
});

test("menu and previews preserve retrieval feedback, assistance and Finished; Start again resets the session", async ({ page }) => {
  await enterTry(page);
  await check(page).click();
  await begin(page);
  await move(page, -4.2);
  await page.getByRole("button", { name: "Open visualisations menu" }).dispatchEvent("click");
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-3");
  await expect(prompt(page)).toContainText("Not quite. Move the green root and try again.");
  await expect(check(page)).toBeEnabled();
  const dropdown = page.getByRole("combobox", { name: "Layout preview" });
  await begin(page);
  await move(page, -4);
  await dropdown.selectOption("assistance");
  await page.mouse.up();
  await expect(surface(page)).toHaveCount(0);
  await dropdown.selectOption("guided");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-3");
  await expect(prompt(page)).toContainText("Not quite. Move the green root and try again.");
  await noWorkedAnswer(page);
  await help(page).click();
  await dropdown.selectOption("orientation");
  await rootTo(page, 5);
  await dropdown.selectOption("guided");
  await expect(check(page)).toBeEnabled();
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-3");
  await expect(slider(page)).toHaveAttribute("aria-disabled", "false");
  await rootTo(page, -4);
  await check(page).click();
  await dropdown.selectOption("retrieval");
  await dropdown.selectOption("guided");
  await stage(page, "completed");
  await dropdown.selectOption("prediction");
  await dropdown.selectOption("guided");
  await stage(page, "completed");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-4");
  await expect(page.getByRole("math")).toHaveAccessibleName("f of x equals (x − 1) times (x + 4)");
  await expect(check(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await stage(page, "orientation");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "3");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await expect(help(page)).toHaveCount(0);
  await expect(slider(page)).toHaveAttribute("aria-valuemin", "0");
  await expect(slider(page)).toHaveAttribute("aria-valuemax", "5");
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeFocused();
  await enterTry(page);
  await expect(help(page)).toHaveCount(0);
  await noWorkedAnswer(page);
});

test("preview E does not request Guided assistance or satisfy a Check", async ({ page }) => {
  await enterTry(page);
  const dropdown = page.getByRole("combobox", { name: "Layout preview" });
  await dropdown.selectOption("assistance");
  await expect(check(page)).toBeDisabled();
  await dropdown.selectOption("guided");
  await noWorkedAnswer(page);
  await expect(help(page)).toHaveCount(0);
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-3");
  await rootTo(page, -4);
  await stage(page, "retrieval");
  await check(page).click();
  await stage(page, "completed");
});

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 393, height: 852 }]) for (const enlarged of [false, true]) {
  test(`all retrieval panels retain graph geometry and reachable content at ${viewport.width}×${viewport.height}${enlarged ? " with 200% text" : ""}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    if (enlarged) await page.addStyleTag({ content: "html { font-size: 200%; }" });
    await expect.poll(async () => graph(page).evaluate((element) => Math.abs((element as SVGSVGElement).viewBox.baseVal.height - element.getBoundingClientRect().height))).toBeLessThan(0.1);
    const baseline = await frame(page);
    const inspect = async (name: string) => {
      expect(await frame(page)).toEqual(baseline);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await prompt(page).evaluate((element) => [...element.querySelectorAll<HTMLElement>("p,dt,dd,button")].every((node) => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
      const action = page.locator("[data-spv-navigation] button");
      if (await action.count()) {
        await action.scrollIntoViewIfNeeded();
        await expect(action).toBeInViewport();
        const bounds = await action.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
    };
    await enterTry(page);
    await inspect("try");
    await check(page).click();
    await inspect("incorrect");
    await help(page).click();
    await inspect("assistance");
    await rootTo(page, -4);
    await inspect("positioned-not-submitted");
    await check(page).click();
    await inspect("complete");
    await page.getByRole("button", { name: "Start again", exact: true }).click();
    await rootTo(page, 1);
    await inspect("start-again");
    await begin(page);
    await move(page, 3.25);
    expect(Number.isInteger(Number(await surface(page).getAttribute("data-spv-graphical-root")))).toBe(false);
    expect(await frame(page)).toEqual(baseline);
    await page.mouse.up();
  });
}

test("Chromium touch positioning at −4 still requires an explicit Check", async ({ page, browserName, context }) => {
  test.skip(browserName !== "chromium", "Native WebKit touch dragging requires physical-device verification.");
  await enterTry(page);
  await slider(page).scrollIntoViewIfNeeded();
  const cdp = await context.newCDPSession(page);
  const start = await point(page, -3);
  const end = await point(page, -4.1);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 0 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...end, id: 0 }] });
  await expect(check(page)).toBeDisabled();
  await stage(page, "retrieval");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "-4");
  await stage(page, "retrieval");
  await expect(check(page)).toBeEnabled();
  await check(page).click();
  await stage(page, "completed");
});
