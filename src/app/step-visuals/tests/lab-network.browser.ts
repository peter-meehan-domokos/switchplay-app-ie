import { expect, test } from "@playwright/test";

/** Run against the actual LAN origin as well as localhost: HTTP 200 alone does not prove hydration. */
test("phone-origin hydration enables touch menu, root dragging and both activity selections", async ({ browser, baseURL, browserName }) => {
  test.skip(browserName !== "chromium", "Native touch injection uses Chromium CDP; physical Safari requires device verification.");
  const context = await browser.newContext({
    baseURL, viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    const connectionErrors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("websocket", (socket) => socket.on("socketerror", (error) => connectionErrors.push(error)));
    const response = await page.goto("/step-visuals");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Roots and factors", exact: true })).toBeVisible();
    const burger = page.getByRole("button", { name: "Open visualisations menu", exact: true });
    expect(await burger.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("button") === button;
    })).toBe(true);
    await burger.tap();
    await expect(burger).toHaveAttribute("aria-expanded", "true");
    const dialog = page.getByRole("dialog", { name: "Choose a visualisation", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close visualisations menu", exact: true }).tap();
    await expect(dialog).not.toBeVisible();
    const root = page.getByRole("slider", { name: "Movable root", exact: true });
    await expect(root).toHaveAttribute("aria-valuenow", "3");
    const box = (await root.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 24, y: box.y + 24, id: 0 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 44, y: box.y + 24, id: 0 }] });
    await expect.poll(async () => Number(await root.getAttribute("aria-valuenow"))).toBeGreaterThan(3);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(root).toHaveAttribute("aria-valuenow", "4");
    await burger.tap();
    await dialog.getByRole("button", { name: "Integration", exact: true }).tap();
    await dialog.locator("li").getByRole("button", { name: "Integration", exact: true }).tap();
    await expect(page.getByRole("heading", { name: "1. Area under a graph", exact: true, level: 1 })).toBeVisible();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("slider", { name: "Right boundary", exact: true }).press("ArrowRight");
    await expect(page.getByRole("slider", { name: "Right boundary", exact: true })).toHaveValue("1.1");
    await burger.tap();
    await dialog.getByRole("button", { name: "Interactive visualisation", exact: true }).tap();
    await expect(page.getByRole("heading", { name: "Roots and factors", exact: true })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Movable root", exact: true })).toHaveAttribute("aria-valuenow", "3");
    await expect(dialog).not.toBeVisible();
    expect(errors).toEqual([]);
    expect(connectionErrors).toEqual([]);
  } finally { await context.close(); }
});
