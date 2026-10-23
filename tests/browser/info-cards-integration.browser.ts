import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const player = (page: Page) => page.locator(".switchplay-video-host-layer video");
const consultation = (page: Page) => page.getByRole("dialog", { name: "Info card consultation", exact: true });
const open = async (page: Page) => {
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
  await page.getByRole("button", { name: /^Open information cards/ }).click();
};
const close = (page: Page) => page.getByRole("button", { name: "Close information card stack", exact: true }).click();

async function enter(page: Page, options: { activity?: boolean; media?: string; item?: number; parentDialog?: boolean } = {}) {
  await page.goto(`/info-cards/integration${options.parentDialog ? "?parent-dialog" : ""}`);
  if (options.activity) await page.getByRole("combobox", { name: "Step content", exact: true }).selectOption("activity");
  if (options.media) await page.getByRole("combobox", { name: "Info media", exact: true }).selectOption(options.media);
  await page.locator(".deck-card.is-active").click();
  await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.locator(".step-view-layer")).toHaveCSS("transform", "none");
  for (let index = 0; index < (options.item ?? 0); index++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".step-view-layer")).toHaveCount(1);
  }
}

async function readyVideo(page: Page) {
  await expect.poll(() => player(page).evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
  await expect(player(page)).toBeVisible();
}

async function remember(page: Page) {
  await page.evaluate(() => {
    Object.assign(window, { rememberedStep: document.querySelector(".step-view-layer"), rememberedVideo: document.querySelector(".switchplay-video-host-layer video") });
  });
}

async function screenshot(page: Page, name: string, info: TestInfo) {
  const directory = process.env.INFO_CARDS_CAPTURE_DIR;
  if (directory) mkdirSync(directory, { recursive: true });
  const path = directory ? resolve(directory, `${name}.png`) : info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}

for (const item of [0, 1, 2, 3]) test(`real ${item === 0 ? "Intro" : `Step ${item}`} pauses without reset/remount/resume`, async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await enter(page, { item });
  await readyVideo(page);
  await remember(page);
  await player(page).evaluate(async (video: HTMLVideoElement) => { video.currentTime = 3; await video.play(); });
  await expect.poll(() => player(page).evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(3.1);
  const before = await player(page).evaluate((video: HTMLVideoElement) => video.currentTime);
  if (item === 0) await screenshot(page, "390-real-video-closed", info);
  await open(page);
  await expect(consultation(page)).toBeVisible();
  await expect.poll(() => player(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  const paused = await player(page).evaluate((video: HTMLVideoElement) => video.currentTime);
  expect(paused).toBeGreaterThanOrEqual(before);
  expect(paused - before).toBeLessThan(1);
  expect(await page.evaluate(() => {
    const saved = window as unknown as { rememberedStep: Element; rememberedVideo: Element };
    return saved.rememberedStep === document.querySelector(".step-view-layer") && saved.rememberedVideo === document.querySelector(".switchplay-video-host-layer video");
  })).toBe(true);
  await expect(page.locator(".focused-card-layer")).toHaveAttribute("inert", "");
  // Native top-layer hit testing must beat the independently hosted video.
  expect(await page.locator("[data-info-card-face]").evaluate(face => {
    const r = face.getBoundingClientRect();
    return Boolean(document.elementFromPoint(r.x + r.width / 2, r.y + 35)?.closest("[data-info-card-face]"));
  })).toBe(true);
  await expect(consultation(page)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  if (item === 0) await screenshot(page, "390-real-video-consultation", info);
  await close(page);
  await expect(consultation(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Open information cards/ })).toBeFocused();
  expect(await player(page).evaluate((video: HTMLVideoElement) => ({ time: video.currentTime, paused: video.paused }))).toEqual({ time: paused, paused: true });
  await player(page).evaluate((video: HTMLVideoElement) => video.play());
  await expect.poll(() => player(page).evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(paused + 0.1);
  expect(errors).toEqual([]);
});

test("activity mount, input, counter and scroll survive consultation and nested image", async ({ page }, info) => {
  await enter(page, { activity: true });
  const activity = page.locator("[data-test-activity]");
  await page.getByLabel("Your answer", { exact: true }).fill("Keep this answer");
  await page.getByRole("button", { name: "Attempts 0", exact: true }).click();
  await page.getByRole("button", { name: "Attempts 1", exact: true }).click();
  await activity.evaluate(element => { element.scrollTop = 80; Object.assign(window, { rememberedActivity: element }); });
  const mount = await activity.getAttribute("data-mount");
  await open(page);
  await page.locator("[data-info-card-body]").click();
  await expect(page.getByRole("dialog", { name: "Info card media", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View image", exact: true }).click();
  await expect(page.getByAltText("Reference diagram", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Zoom level", { exact: true })).toHaveText("150%");
  await screenshot(page, "390-nested-image", info);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "View image", exact: true })).toBeFocused();
  await expect(consultation(page)).toBeVisible();
  await screenshot(page, "390-activity-consultation", info);
  // Close over the activity: the same click cannot activate its controls.
  const r = await activity.boundingBox();
  await page.mouse.click(r!.x + r!.width / 2, r!.y + 15);
  await expect(consultation(page)).toHaveCount(0);
  expect(await activity.evaluate(element => element === (window as unknown as { rememberedActivity: Element }).rememberedActivity)).toBe(true);
  expect(await activity.getAttribute("data-mount")).toBe(mount);
  expect(await activity.evaluate(element => element.scrollTop)).toBe(80);
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue("Keep this answer");
  await expect(page.getByRole("button", { name: "Attempts 2", exact: true })).toBeAttached();
});

test("pointer, keyboard and programmatic step handlers stay isolated; tooltip closes first", async ({ page }) => {
  await enter(page);
  await readyVideo(page);
  await open(page);
  const face = page.locator("[data-info-card-face]");
  const r = (await face.boundingBox())!;
  for (const [dx, dy] of [[100, 0], [0, 100], [0, -100]]) {
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2 + dx, r.y + r.height / 2 + dy, { steps: 8 });
    await page.mouse.up();
  }
  await expect(consultation(page)).toBeVisible();
  await expect(page.locator(".focused-card-object")).not.toHaveClass(/is-flipped/);
  await expect(page.locator(".step-view-actions > span")).toHaveText("1/4");
  await page.locator(".step-view-actions > button:last-of-type").dispatchEvent("click");
  await page.locator(".step-view-close").dispatchEvent("click");
  await page.locator(".focused-card-scrim").dispatchEvent("click");
  await expect(page.locator(".step-view-actions > span")).toHaveText("1/4");
  await expect(page.locator(".focused-card-layer")).toHaveCount(1);
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press(index % 3 === 0 ? "Shift+Tab" : "Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("dialog")?.getAttribute("aria-label"))).toBe("Info card consultation");
  }
  await player(page).evaluate(video => video.focus());
  expect(await page.evaluate(() => document.activeElement?.closest("dialog")?.getAttribute("aria-label"))).toBe("Info card consultation");
  const series = page.getByRole("button", { name: /^Series What You Need/ });
  await series.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(consultation(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(consultation(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Open information cards/ })).toBeFocused();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
  await expect(page.locator(".step-view-actions > span")).toHaveText("2/4");
});

test("nested video closes to the same frozen info card; step stays mounted and paused", async ({ page }, info) => {
  await enter(page, { media: "video" });
  await readyVideo(page);
  await remember(page);
  await player(page).evaluate((video: HTMLVideoElement) => { video.currentTime = 4; });
  await open(page);
  const body = await page.locator("[data-info-card-body]").innerText();
  await page.getByRole("button", { name: "Watch video", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Info card media", exact: true });
  const nested = viewer.locator("video");
  await expect.poll(() => nested.evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
  await nested.evaluate(async (video: HTMLVideoElement) => { Object.assign(window, { rememberedNested: video }); await video.play(); });
  await expect.poll(() => nested.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0.1);
  await page.evaluate(() => (window as unknown as { infoFixture: { update(): void } }).infoFixture.update());
  await screenshot(page, "390-nested-video", info);
  await page.getByRole("button", { name: "Close info card media", exact: true }).click();
  await expect(page.getByRole("button", { name: "Watch video", exact: true })).toBeFocused();
  expect(await page.evaluate(() => {
    const win = window as unknown as { rememberedNested: HTMLVideoElement; rememberedVideo: HTMLVideoElement };
    return { disposed: !win.rememberedNested.isConnected && win.rememberedNested.paused,
      sameStep: win.rememberedVideo === document.querySelector(".switchplay-video-host-layer video"), paused: win.rememberedVideo.paused };
  })).toEqual({ disposed: true, sameStep: true, paused: true });
  expect(await page.locator("[data-info-card-body]").innerText()).toBe(body);
  await close(page);
  await open(page);
  await expect(page.locator("[data-info-card-body]")).toContainText("Updated 2.");
});

for (const releaseAfterClose of [false, true]) test(`pending loading cannot autoplay when released ${releaseAfterClose ? "after close" : "during consultation"}`, async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/library/media/stream-status?**", async route => {
    if (new URL(route.request().url()).searchParams.get("assetId") === "info-fixture-step-1") await held;
    await route.fulfill({ json: { status: "ready" } }).catch(() => {});
  });
  try {
    await enter(page);
    await readyVideo(page);
    await player(page).evaluate((video: HTMLVideoElement) => video.play());
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".step-view-layer")).toHaveCount(1);
    await expect(page.locator(".step-view-actions > span")).toHaveText("2/4");
    await open(page);
    if (releaseAfterClose) await close(page);
    release();
    await readyVideo(page);
    expect(await player(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    if (!releaseAfterClose) await close(page);
    await player(page).evaluate((video: HTMLVideoElement) => video.play());
    await expect.poll(() => player(page).evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0.1);
  } finally { release(); }
});

for (const releaseAfterClose of [false, true]) test(`pending play promise cannot restart ${releaseAfterClose ? "after close" : "behind consultation"}`, async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    const win = window as unknown as { holdStepPlay: boolean; releaseStepPlay: (() => void) | null };
    win.holdStepPlay = false; win.releaseStepPlay = null;
    HTMLMediaElement.prototype.play = function () {
      if (win.holdStepPlay && this.closest(".switchplay-video-host-layer")) {
        win.holdStepPlay = false;
        return new Promise<void>((resolve, reject) => { win.releaseStepPlay = () => { void play.call(this).then(resolve, reject); }; });
      }
      return play.call(this);
    };
  });
  await enter(page);
  await readyVideo(page);
  await player(page).evaluate((video: HTMLVideoElement) => video.play());
  await page.evaluate(() => { (window as unknown as { holdStepPlay: boolean }).holdStepPlay = true; });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { releaseStepPlay: unknown }).releaseStepPlay))).toBe(true);
  await open(page);
  if (releaseAfterClose) await close(page);
  await page.evaluate(() => (window as unknown as { releaseStepPlay(): void }).releaseStepPlay());
  await readyVideo(page);
  await expect.poll(() => player(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  if (!releaseAfterClose) await close(page);
  expect(await player(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
});

for (const action of ["unmount", "changeVersion", "changeActor"] as const) test(`${action} tears down both modal layers and restores page scroll`, async ({ page }) => {
  await enter(page, { media: "video" });
  await readyVideo(page);
  const overflow = await page.evaluate(() => [document.documentElement.style.overflow, document.body.style.overflow]);
  await open(page);
  await page.getByRole("button", { name: "Watch video", exact: true }).click();
  await page.evaluate(action => (window as unknown as { infoFixture: Record<string, () => void> }).infoFixture[action](), action);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(await page.evaluate(() => [document.documentElement.style.overflow, document.body.style.overflow])).toEqual(overflow);
});

test("consultation and media sit above an existing Library/Creator dialog without dismissing it", async ({ page }) => {
  await enter(page, { parentDialog: true });
  await readyVideo(page);
  await open(page);
  await page.getByRole("button", { name: "View image", exact: true }).click();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("dialog")?.getAttribute("aria-label"))).toBe("Info card media");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "View image", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(consultation(page)).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Parent preview", exact: true })).toBeVisible();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Open information cards/ })).toBeFocused();
});

test("no-media consultation follows real Step View bounds across responsive resizing", async ({ page }, info) => {
  await enter(page, { media: "none" });
  await readyVideo(page);
  await remember(page);
  await open(page);
  await expect(page.getByRole("button", { name: /^(View image|Watch video)$/ })).toHaveCount(0);
  const measurements = [];
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [1280, 900]]) {
    await page.setViewportSize({ width, height });
    const geometry = () => page.evaluate(() => {
      const step = document.querySelector<HTMLElement>(".step-view-layer")!;
      const s = step.getBoundingClientRect(), scale = s.width / parseFloat(getComputedStyle(step).width);
      const dialog = document.querySelector("dialog[aria-label='Info card consultation']")!;
      const p = dialog.querySelector("[data-info-card-pouch]")!.getBoundingClientRect();
      const c = dialog.querySelector("[data-info-card-face]")!.getBoundingClientRect();
      return { step: s.toJSON(), pouch: p.toJSON(), card: c.toJSON(), error: Math.max(
        Math.abs(p.left - s.left), Math.abs(p.bottom - s.bottom),
        Math.abs(c.left - s.left - 6 * scale), Math.abs(s.bottom - c.bottom - 15 * scale)) };
    });
    await expect.poll(async () => (await geometry()).error).toBeLessThan(0.5);
    measurements.push({ width, height, ...await geometry() });
  }
  await info.attach("portal-geometry", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
  await page.getByRole("button", { name: /^Close information cards \(/ }).click();
  await expect(consultation(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelector(".switchplay-video-host-layer video") ===
    (window as unknown as { rememberedVideo: Element }).rememberedVideo)).toBe(true);
});

test("touch closing over the real paused video does not play it or close Step View", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await enter(page);
    await readyVideo(page);
    await page.getByRole("button", { name: /^Open information cards/ }).tap();
    const r = (await player(page).boundingBox())!;
    await page.touchscreen.tap(r.x + r.width / 2, r.y + 50);
    await expect(consultation(page)).toHaveCount(0);
    await expect(page.locator(".step-view-layer")).toHaveCount(1);
    expect(await player(page).evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  } finally { await context.close(); }
});
