import { expect, test } from "@playwright/test";

test("opens the exact thumbnail and traverses all eight items without wrapping", async ({ page }) => {
  await page.goto("/");
  const thumbnails = page.getByRole("button", { name: /^Open (image|video) \d of 8:/ });
  await expect(thumbnails).toHaveCount(5);
  await thumbnails.nth(3).click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText("4 of 8")).toBeVisible();
  await expect(viewer.locator("img[alt='Written work 4']")).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await expect(viewer.getByRole("button", { name: "Close media viewer" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
  for (let index = 5; index <= 8; index++) {
    await viewer.getByRole("button", { name: "Next media" }).click();
    await expect(viewer.getByText(`${index} of 8`)).toBeVisible();
  }
  await expect(viewer.getByRole("button", { name: "Next media" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  await expect(thumbnails.nth(3)).toBeFocused();
});

test("zoom controls, swipe, download, and single-item layout work on a phone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Open image 1 of 8:/ }).click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  await expect(viewer.getByRole("button", { name: "Previous media" })).toBeDisabled();
  await viewer.getByRole("button", { name: "Zoom in" }).click();
  await expect(viewer.getByLabel("Zoom level")).toHaveText("150%");
  const surface = viewer.getByLabel(/^Image\. Pinch/);
  const bounds = await surface.boundingBox();
  if (!bounds) throw new Error("Image surface is missing");
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(bounds.x + bounds.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.2, y, { steps: 6 });
  await page.mouse.up();
  await expect(viewer.getByText("1 of 8")).toBeVisible();
  await viewer.getByRole("button", { name: "Reset zoom" }).click();
  await expect(viewer.getByLabel("Zoom level")).toHaveText("100%");
  await page.mouse.move(bounds.x + bounds.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.2, y, { steps: 6 });
  await page.mouse.up();
  await expect(viewer.getByText("2 of 8")).toBeVisible();
  await viewer.getByRole("button", { name: "Previous media" }).click();
  const downloadPromise = page.waitForEvent("download");
  await viewer.getByRole("button", { name: "Download image" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("written-work.png");
  await expect(viewer.getByRole("link", { name: "Download ready" })).toBeVisible();
  await viewer.getByRole("button", { name: "Close media viewer" }).click();

  await page.goto("/?single");
  await page.getByRole("button", { name: /^Open image 1 of 1:/ }).click();
  await expect(page.getByRole("dialog", { name: "Card media viewer" }).getByText("1 of 1")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Media navigation" })).toHaveCount(0);
});

test("desktop toolbar remains reachable when an image fails", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/image-6.svg", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: /^Open image 5 of 8:/ }).click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  await viewer.getByRole("button", { name: "Next media" }).click();
  await viewer.getByRole("button", { name: "Next media" }).click();
  await expect(viewer.getByText("7 of 8")).toBeVisible();
  await expect(viewer.getByRole("alert")).toContainText("This image could not be loaded");
  await expect(viewer.getByRole("button", { name: "Retry image" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Close media viewer" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Next media" })).toBeVisible();
  await viewer.getByRole("button", { name: "Previous media" }).click();
  await expect(viewer.getByText("6 of 8")).toBeVisible();
  await viewer.getByRole("button", { name: "Close media viewer" }).click();
  await expect(viewer).toHaveCount(0);
});

test("video starts paused, unmounts on navigation, and opening from focused card works", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Open video 2 of 8:/ }).click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  await expect(viewer.getByText("2 of 8")).toBeVisible();
  await expect(viewer.locator("video")).toHaveCount(1);
  await expect.poll(() => viewer.locator("video").evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await viewer.getByRole("button", { name: "Next media" }).click();
  await expect(viewer.getByText("3 of 8")).toBeVisible();
  await expect(viewer.locator("video")).toHaveCount(1);
  await viewer.getByRole("button", { name: "Next media" }).click();
  await expect(viewer.locator("video")).toHaveCount(0);
  await viewer.getByRole("button", { name: "Close media viewer" }).click();
  await expect(viewer).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("group", { name: /Press Enter to focus this card/ }).press("Enter");
  await expect(page.getByRole("button", { name: "Close focused card" })).toBeVisible();
  await page.getByRole("button", { name: /^Open image 1 of 8:/ }).last().click();
  await expect(page.getByRole("dialog", { name: "Card media viewer" })).toBeVisible();
});
