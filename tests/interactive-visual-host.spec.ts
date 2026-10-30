import { expect, test } from "@playwright/test";

const origin = process.env.SPV_TEST_BASE_URL ?? "http://127.0.0.1:3171";
test.use({ viewport: { width: 320, height: 568 } });

test("development mock proves host dimensions, stable controls and origin focus at 320 CSS pixels", async ({ page }) => {
  await page.goto(`${origin}/dev/interactive-visual-host`);
  const trigger = page.getByRole("button", { name: "Open responsive mock" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Development responsive mock" });
  await expect(dialog).toBeVisible();
  const next = dialog.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeEnabled();
  await expect.poll(async () => (await next.boundingBox())!.x + (await next.boundingBox())!.width).toBeLessThanOrEqual(308.1);
  const content = await dialog.locator("[data-visual-host-content]").boundingBox();
  const mock = await dialog.locator("[data-responsive-mock]").boundingBox();
  const button = await next.boundingBox();
  expect(content!.width).toBeCloseTo(296, 1); expect(mock!.width).toBeCloseTo(content!.width, 1); expect(mock!.height).toBeCloseTo(content!.height, 1);
  expect(button!.x + button!.width).toBeLessThanOrEqual(308.1); expect(button!.x).toBeGreaterThan(200);
  expect(button!.y).toBeGreaterThanOrEqual(content!.y + content!.height);
  expect(await dialog.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
  await next.click(); await expect(dialog.locator("[data-responsive-mock]")).toContainText("Stage 2");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.locator("[data-responsive-mock]")).toContainText("366");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

test("card attachment opens the real visual and returns with state retained", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1100 });
  await page.goto(`${origin}/dev/interactive-visual-host`);
  await page.getByRole("button", { name: "Open test card" }).click();
  await page.getByRole("button", { name: "ExploreExplore roots and factors.", exact: true }).click();
  const preview = page.getByRole("button", { name: "Open Roots and Factors" });
  await expect(preview).toBeVisible(); await preview.click();
  const dialog = page.getByRole("dialog", { name: "Roots and Factors", exact: true });
  const slider = dialog.getByRole("slider");
  await expect(slider).toHaveAttribute("aria-valuenow", "3");
  await slider.focus(); await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "4");
  await expect(dialog.getByRole("button", { name: "Next", exact: true })).toHaveCount(1);
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "(x + 3)", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close interactive visual" }).click();
  await expect(preview).toBeFocused(); await preview.click();
  await expect(dialog.getByRole("button", { name: "(x + 3)", exact: true })).toBeVisible();
  await expect(dialog.locator("[data-visual-host-footer]").getByRole("status")).toHaveText("Development session only");
});
