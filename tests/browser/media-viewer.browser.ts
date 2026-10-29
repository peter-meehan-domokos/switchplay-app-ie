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


test("inherited media with a repeated ID selects and downloads its own source", async ({ page }) => {
  await page.goto("/?inherited");
  await page.getByRole("button", { name: /^Open image 3 of 3:/ }).click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  await expect(viewer.getByText("3 of 3")).toBeVisible();
  const request = page.waitForRequest(request => request.url().includes("/api/media/card") && request.method() === "POST");
  await viewer.getByRole("button", { name: "Download image" }).click();
  expect((await request).postDataJSON()).toMatchObject({ cardTemplateId: "card-1", sourceCardTemplateId: "original", mediaItemId: "image-0" });
  await viewer.getByRole("button", { name: "Previous media" }).click();
  await viewer.getByRole("button", { name: "Previous media" }).click();
  await expect(viewer.getByText("1 of 3")).toBeVisible();
});

for (const strict of [false, true]) test(`gallery decoding, retry and paused navigation survive ${strict ? "Strict Mode replay" : "ordinary mounting"}`, async ({ page }) => {
  await page.addInitScript(() => { const original = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function(type) { return /mpegurl/i.test(type) ? "probably" : original.call(this, type); };
    // Exercise real decoding through the native-source branch using local WebM,
    // rather than asking Chromium to interpret a WebM payload as an HLS playlist.
    const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src")!;
    Object.defineProperty(HTMLMediaElement.prototype, "src", { ...src, set(value: string) { src.set!.call(this, value.replace("/manifest/video.m3u8", "/fixture.webm")); } }); });
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile("tests/fixtures/handoff-red.webm");
  let failNextVideo = false;
  await page.route("**/fixture.webm", route => {
    if (failNextVideo) { failNextVideo = false; return route.abort(); }
    const range = route.request().headers()["range"]?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) { const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : bytes.length - 1, bytes.length - 1);
      return route.fulfill({ status: 206, contentType: "video/webm", headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${bytes.length}` }, body: bytes.subarray(start, end + 1) }); }
    return route.fulfill({ contentType: "video/webm", headers: { "Accept-Ranges": "bytes" }, body: bytes });
  });
  await page.goto(strict ? "/?strict" : "/");
  await page.getByRole("button", { name: /^Open video 2 of 8:/ }).click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  const video = viewer.locator("video");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(2);
  await expect(video).toBeVisible();
  expect(await video.evaluate((node: HTMLVideoElement) => node.paused && node.currentTime === 0)).toBe(true);
  await video.evaluate((node: HTMLVideoElement) => { (window as unknown as { galleryVideo: HTMLVideoElement }).galleryVideo = node; return node.play(); });
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
  await viewer.getByRole("button", { name: "Next media" }).click();
  await expect.poll(() => page.evaluate(() => { const node = (window as unknown as { galleryVideo: HTMLVideoElement }).galleryVideo; return node.paused && !node.getAttribute("src"); })).toBe(true);
  await expect(viewer.locator("video")).toHaveCount(1);
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(2);
  await expect(video).toBeVisible();
  expect(await video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  // Returning to the same asset after its old instance was reset must reload it.
  await viewer.getByRole("button", { name: "Previous media" }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(2);
  await expect(video).toBeVisible();
  expect(await video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  // An explicit Retry must recover a failed source without silently autoplaying.
  failNextVideo = true;
  await viewer.getByRole("button", { name: "Next media" }).click();
  await expect(viewer.getByRole("button", { name: "Retry video", exact: true })).toBeVisible();
  await viewer.getByRole("button", { name: "Retry video", exact: true }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(2);
  await expect(video).toBeVisible();
  expect(await video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await viewer.getByRole("button", { name: "Close media viewer" }).click();
  await expect(viewer).toHaveCount(0);
});

for (const width of [320, 390, 1280]) test(`gallery controls, focus and contained images remain usable at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/");
  const source = page.getByRole("button", { name: /^Open image 4 of 8:/ });
  await source.click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("img[alt='Written work 4']")).toBeVisible();
  await expect.poll(() => viewer.evaluate(node => node.getAnimations().every(animation => animation.playState === "finished"))).toBe(true);
  expect(await viewer.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  for (const name of ["Close media viewer", "Download image", "Previous media", "Next media", "Zoom in"]) {
    const control = viewer.getByRole("button", { name, exact: true });
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds && bounds.x >= -0.5 && bounds.x + bounds.width <= width + 1 && bounds.height >= 44, `${name}: ${JSON.stringify(bounds)}`).toBeTruthy();
  }
  await page.screenshot({ path: info.outputPath(`gallery-${width}.png`) });
  await viewer.getByRole("button", { name: "Close media viewer" }).click();
  await expect(viewer).toHaveCount(0);
  await expect(source).toBeFocused();
});
