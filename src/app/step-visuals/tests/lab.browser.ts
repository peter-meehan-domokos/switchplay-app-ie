import { expect, test, type Page } from "@playwright/test";

const openMenu = async (page: Page) => {
  await page.getByRole("button", { name: "Open visualisations menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a visualisation" });
  await expect(dialog).toBeVisible();
  return dialog;
};

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/step-visuals");
  await expect(page.getByRole("heading", { name: "Roots and factors", exact: true })).toBeVisible();
  await page.getByText("Lab session test", { exact: true }).click();
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test("starts on the first experience and exposes exactly two levels of implemented navigation", async ({ page }) => {
  await expect(page.locator("header").getByText("Preview", { exact: true })).toHaveCount(0);
  const dialog = await openMenu(page);
  const card = dialog.getByRole("button", { name: "Card 1 — Roots and Factors" });
  await expect(card).toHaveAttribute("aria-expanded", "true");
  await expect(dialog.getByRole("button", { name: "Interactive visualisation" })).toHaveAttribute("aria-current", "page");
  await expect(dialog.getByRole("button", { name: "Sparkline preview" })).toBeVisible();
  await expect(dialog.getByRole("button")).toHaveCount(4);
  await expect(dialog.getByText("Card 2")).toHaveCount(0);
  await expect(dialog.getByRole("menu")).toHaveCount(0);
});

test("preserves the mounted preview session through dismissal and reselection of the current experience", async ({ page }) => {
  const note = page.getByRole("textbox", { name: "Session note" });
  await note.fill("Keep my place");
  await openMenu(page);
  await page.keyboard.press("Escape");
  await expect(note).toHaveValue("Keep my place");
  await expect(page.getByRole("button", { name: "Open visualisations menu" })).toBeFocused();
  const dialog = await openMenu(page);
  await dialog.getByRole("button", { name: "Interactive visualisation" }).click();
  await expect(note).toHaveValue("Keep my place");
});

test("switching experiences shows three variants and returning creates a fresh preview session", async ({ page }) => {
  await page.getByRole("textbox", { name: "Session note" }).fill("Previous attempt");
  let dialog = await openMenu(page);
  await dialog.getByRole("button", { name: "Sparkline preview" }).click();
  await expect(page.getByRole("heading", { name: "Sparkline preview", exact: true })).toBeFocused();
  for (const name of ["Complete", "Graphics-only", "Notation-only"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  dialog = await openMenu(page);
  await dialog.getByRole("button", { name: "Interactive visualisation" }).click();
  await expect(page.getByRole("heading", { name: "Roots and factors", exact: true })).toBeFocused();
  await page.getByText("Lab session test", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Session note" })).toHaveValue("");
});

test("exit ends the mounted preview session and allows a fresh selection", async ({ page }) => {
  await page.getByRole("textbox", { name: "Session note" }).fill("Leaving now");
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Choose an experience" })).toBeVisible();
  const dialog = await openMenu(page);
  await dialog.getByRole("button", { name: "Interactive visualisation" }).click();
  await page.getByText("Lab session test", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Session note" })).toHaveValue("");
});

test("supports keyboard disclosures, removes collapsed children and retains disclosure state", async ({ page }) => {
  const dialog = await openMenu(page);
  await expect(dialog.getByRole("button", { name: "Close visualisations menu" })).toBeFocused();
  await page.keyboard.press("Tab");
  const card = dialog.getByRole("button", { name: "Card 1 — Roots and Factors" });
  await expect(card).toBeFocused();
  await page.keyboard.press("Space");
  await expect(card).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByRole("button", { name: "Interactive visualisation" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await openMenu(page);
  await expect(card).toHaveAttribute("aria-expanded", "false");
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Sparkline preview" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Sparkline preview", exact: true })).toBeFocused();
});

test("modal navigation keeps focus inside and suspends the underlying preview", async ({ page }) => {
  const dialog = await openMenu(page);
  await expect(page.getByRole("textbox", { name: "Session note", includeHidden: true })).toBeDisabled();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press("Tab");
    const focusInside = await dialog.evaluate((element) => element.contains(document.activeElement));
    expect(focusInside).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await dialog.getByRole("button", { name: "Close visualisations menu" }).click();
  await expect(page.getByRole("textbox", { name: "Session note" })).toBeEnabled();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`responsive frame and menu at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(await overflow()).toBe(false);
    await expect(page.getByRole("img", { name: "Quadratic graph", exact: true })).toBeVisible();
    const dialog = await openMenu(page);
    const panelBox = await dialog.boundingBox();
    expect(panelBox?.x).toBe(0);
    for (const button of await dialog.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    expect(await overflow()).toBe(false);
    await dialog.getByRole("button", { name: "Sparkline preview" }).click();
    expect(await overflow()).toBe(false);
  });
}

test("public website navigation links to the standalone lab", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Public navigation" });
  const link = navigation.getByRole("link", { name: "Step Visuals", exact: true });
  await expect(link).toHaveAttribute("href", "/step-visuals");
  await expect(navigation.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("href", "/contact");
  await expect(navigation.getByRole("link", { name: "Join", exact: true })).toHaveAttribute("href", "/#early-access");
  await expect(navigation.getByRole("link", { name: "Log in", exact: true })).toHaveAttribute("href", "/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await link.click();
  await expect(page).toHaveURL(/\/step-visuals$/);
  await expect(page.getByRole("heading", { name: "Roots and factors", exact: true })).toBeVisible();
});

test("enlarged text stays usable on a short phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("textbox", { name: "Session note" }).fill("Larger text");
  const dialog = await openMenu(page);
  await dialog.getByRole("button", { name: "Sparkline preview" }).click();
  await expect(page.getByRole("heading", { name: "Sparkline preview", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Sparkline preview", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("enlarged-text.png"), fullPage: true });
});

test("touch navigation and phone reference views", async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 }, baseURL });
  const page = await context.newPage();
  try {
    await page.goto("/step-visuals");
    await page.getByText("Lab session test", { exact: true }).click();
    await page.getByRole("textbox", { name: "Session note" }).fill("Touch preview");
    await page.screenshot({ path: testInfo.outputPath("phone-frame.png"), fullPage: true });
    await page.getByRole("button", { name: "Open visualisations menu" }).tap();
    const dialog = page.getByRole("dialog", { name: "Choose a visualisation" });
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("phone-menu.png"), fullPage: true });
    await dialog.getByRole("button", { name: "Close visualisations menu" }).tap();
    await expect(page.getByRole("textbox", { name: "Session note" })).toHaveValue("Touch preview");
    await page.getByRole("button", { name: "Open visualisations menu" }).tap();
    await dialog.getByRole("button", { name: "Sparkline preview" }).tap();
    await expect(page.getByRole("heading", { name: "Sparkline preview", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("phone-sparklines.png"), fullPage: true });
  } finally {
    await context.close();
  }
});
