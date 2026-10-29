import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const stack = (page: Page) => page.locator("[data-info-card-stack]");
const current = (page: Page) => page.locator('[data-info-card-current="true"]');
const title = (page: Page) => current(page).locator("[data-info-card-title]");
const player = (page: Page) => page.locator(".switchplay-video-host-layer video");
const dialog = (page: Page) => page.getByRole("dialog", { name: "Info card consultation", exact: true });
const settled = (page: Page) => expect(stack(page)).toHaveAttribute("data-info-stack-phase", "open");
const titles = ["Negative signs", "Brackets", "Like terms", "Operation order", "Check an answer"];

async function enter(page: Page, options: { count?: number; activity?: boolean; media?: string } = {}) {
  await page.goto("/info-cards/integration");
  await page.getByRole("combobox", { name: "Cards", exact: true }).selectOption(String(options.count ?? 5));
  if (options.activity) await page.getByRole("combobox", { name: "Step content", exact: true }).selectOption("activity");
  if (options.media) await page.getByRole("combobox", { name: "Info media", exact: true }).selectOption(options.media);
  await page.locator(".deck-card.is-active").click();
  await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.locator(".step-view-layer")).toHaveCSS("transform", "none");
  if (!options.activity) await expect.poll(() => player(page).evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
}

async function open(page: Page) {
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  await settled(page);
}

async function swipe(page: Page, direction: "up" | "down", wait = true) {
  const r = (await stack(page).boundingBox())!;
  const x = r.x + r.width * 0.6, y = r.y + r.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + (direction === "down" ? 100 : -100), { steps: 6 });
  await page.mouse.up();
  if (wait) await settled(page);
}

async function close(page: Page, method: "X" | "pouch" | "background" = "X") {
  if (method === "X") await page.getByRole("button", { name: "Close information card stack", exact: true }).click();
  else if (method === "pouch") await page.getByRole("button", { name: /^Close information cards \(/ }).click();
  else await page.getByRole("button", { name: "Close information cards and return to step", exact: true }).click({ position: { x: 200, y: 180 } });
  await expect(dialog(page)).toHaveCount(0);
}

async function capture(page: Page, name: string, info: TestInfo) {
  const directory = process.env.INFO_CARDS_MOTION_CAPTURE_DIR;
  if (directory) mkdirSync(directory, { recursive: true });
  const path = directory ? resolve(directory, `${name}.png`) : info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: "image/png" });
}

test("fixed-size bundle emerges from the actual pouch, settles, and returns without layout changes", async ({ page }, info) => {
  await enter(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await player(page).evaluate(async (v: HTMLVideoElement) => { v.currentTime = 3; await v.play(); });
  const before = await page.locator(".step-view-layer").boundingBox();
  await capture(page, "390-closed", info);
  await page.evaluate(() => {
    const frames: object[] = [];
    Object.assign(window, { infoMotionFrames: frames });
    let seen = false;
    function sample() {
      const pack = document.querySelector<HTMLElement>("[data-info-card-stack]");
      if (pack) {
        seen = true;
        const m = new DOMMatrix(getComputedStyle(pack).transform);
        const parent = pack.parentElement!, p = parent.getBoundingClientRect();
        const pouch = document.querySelector("dialog [data-info-card-pouch]")!.getBoundingClientRect();
        frames.push({ phase: pack.dataset.infoStackPhase, width: pack.offsetWidth, height: pack.offsetHeight,
          sx: Math.hypot(m.a, m.b), sy: Math.hypot(m.c, m.d), x: m.e, y: m.f, angle: Math.atan2(m.b, m.a) * 180 / Math.PI,
          parentScale: p.width / parent.clientWidth, pouchLeft: pouch.left - p.left, pouchBottom: p.bottom - pouch.bottom });
      }
      if (!seen || pack) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "opening");
  await expect.poll(() => stack(page).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).e)).toBeGreaterThan(-190);
  await capture(page, "390-emerging", info);
  await settled(page);
  await expect(title(page)).toHaveText(titles[0]);
  await expect(page.locator("[data-info-card-backing]")).toHaveCount(2);
  await capture(page, "390-settled", info);
  const after = await page.locator(".step-view-layer").boundingBox();
  for (const key of ["width", "height", "x", "y"] as const) expect(Math.abs(after![key] - before![key])).toBeLessThan(0.5);
  await close(page);
  const frames = await page.evaluate(() => (window as unknown as { infoMotionFrames: { phase: string; width: number; height: number; sx: number; sy: number; x: number; y: number; angle: number; parentScale: number; pouchLeft: number; pouchBottom: number }[] }).infoMotionFrames);
  expect(frames.filter(f => f.phase === "opening").length).toBeGreaterThan(3);
  expect(frames.filter(f => f.phase === "closing").length).toBeGreaterThan(3);
  expect(Math.min(...frames.map(f => f.x))).toBeLessThan(-200);
  expect(Math.max(...frames.map(f => f.angle))).toBeGreaterThan(5);
  // Once translation reaches the final 4px/3px seating region, most of the
  // rotation must already be complete. The old late 9-degree pivot fails this.
  const contact = frames.filter(f => f.phase === "opening" && f.x >= -6 && f.x <= -2 && f.y >= 1 && f.y <= 4);
  expect(contact.length).toBeGreaterThan(0);
  expect(Math.max(...contact.map(f => f.angle))).toBeLessThan(5);
  expect(Math.max(...contact.map(f => f.angle))).toBeGreaterThan(1);
  for (const frame of frames) {
    expect(frame.width).toBe(frames[0].width);
    expect(frame.height).toBe(frames[0].height);
    expect(frame.sx).toBeCloseTo(1, 4);
    expect(frame.sy).toBeCloseTo(1, 4);
    expect(frame.parentScale).toBeCloseTo(frames[0].parentScale, 3);
    expect(Math.abs(frame.pouchLeft)).toBeLessThan(0.1);
    expect(Math.abs(frame.pouchBottom)).toBeLessThan(0.1);
  }
  await info.attach("motion-frame-measurements", { body: JSON.stringify(frames, null, 2), contentType: "application/json" });
  expect(await player(page).evaluate((v: HTMLVideoElement) => ({ paused: v.paused, time: v.currentTime }))).toMatchObject({ paused: true });
  expect(errors).toEqual([]);
});

test("vertical swipes cycle creator order in both directions and wrap", async ({ page }) => {
  await enter(page);
  await open(page);
  for (const expected of [...titles.slice(1), titles[0]]) {
    await swipe(page, "down");
    await expect(title(page)).toHaveText(expected);
    await expect(page.locator("[data-info-card-face]")).toHaveCount(1);
  }
  for (const expected of [...titles.slice(1).reverse(), titles[0]]) {
    await swipe(page, "up");
    await expect(title(page)).toHaveText(expected);
  }
  await expect(stack(page)).not.toContainText(/\d+\s*\/\s*\d+/);
  await expect(page.locator(".step-view-actions > span")).toHaveText("1/4");
  await expect(page.locator(".focused-card-object")).not.toHaveClass(/is-flipped/);
});

test("browsing moves separate fixed-size physical cards and retains the incoming card node", async ({ page }, info) => {
  await enter(page);
  await open(page);
  await stack(page).evaluate(pack => {
    const frames: object[] = [];
    Object.assign(window, { infoBrowseFrames: frames });
    let seen = false;
    function sample() {
      const browsing = (pack as HTMLElement).dataset.infoStackPhase === "browsing";
      if (browsing) seen = true;
      for (const card of pack.querySelectorAll<HTMLElement>("[data-info-card-layer]")) {
        const m = new DOMMatrix(getComputedStyle(card).transform);
        frames.push({ width: card.offsetWidth, height: card.offsetHeight, sx: Math.hypot(m.a, m.b), sy: Math.hypot(m.c, m.d) });
      }
      if (!seen || browsing) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.keyboard.press("ArrowDown");
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "browsing");
  await expect(page.locator("[data-info-card-layer]")).toHaveCount(2);
  await page.evaluate(() => Object.assign(window, { incomingInfoCard: document.querySelector('[data-info-card-current="false"]') }));
  await expect.poll(() => current(page).evaluate(el => Math.abs(new DOMMatrix(getComputedStyle(el).transform).f))).toBeGreaterThan(15);
  await settled(page);
  await expect(title(page)).toHaveText("Brackets");
  expect(await current(page).evaluate(el => el === (window as unknown as { incomingInfoCard: Element }).incomingInfoCard)).toBe(true);
  const frames = await page.evaluate(() => (window as unknown as { infoBrowseFrames: { width: number; height: number; sx: number; sy: number }[] }).infoBrowseFrames);
  expect(frames.length).toBeGreaterThan(5);
  for (const frame of frames) {
    expect(frame.width).toBe(frames[0].width); expect(frame.height).toBe(frames[0].height);
    expect(frame.sx).toBeCloseTo(1, 4); expect(frame.sy).toBeCloseTo(1, 4);
  }
  await info.attach("browse-frame-measurements", { body: JSON.stringify(frames), contentType: "application/json" });
  await page.keyboard.press("ArrowUp");
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "browsing");
  await expect(page.locator('[data-info-card-current="false"] [data-info-card-title]')).toHaveText("Negative signs");
  await settled(page);
  await expect(title(page)).toHaveText("Negative signs");
});

for (const method of ["X", "pouch", "background"] as const) test(`${method} returns the pack and each new opening starts at the first card`, async ({ page }) => {
  await enter(page);
  await open(page);
  await swipe(page, "down");
  await expect(title(page)).toHaveText("Brackets");
  await close(page, method);
  await expect(page.getByRole("button", { name: /^Open information cards/ })).toBeFocused();
  await open(page);
  await expect(title(page)).toHaveText("Negative signs");
});

test("cancelled, short, horizontal and reversed pointer gestures preserve correct order", async ({ page }) => {
  await enter(page);
  await open(page);
  const r = (await stack(page).boundingBox())!, x = r.x + r.width * 0.6, y = r.y + r.height / 2;
  for (const cancel of ["pointercancel", "lostpointercapture"]) {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 80, { steps: 5 });
    await stack(page).dispatchEvent(cancel, { pointerId: 1, pointerType: "mouse", isPrimary: true });
    await page.mouse.up(); await settled(page);
    await expect(title(page)).toHaveText("Negative signs");
  }
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 12); await page.mouse.up();
  await settled(page); await expect(title(page)).toHaveText("Negative signs");
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 100, y + 4); await page.mouse.up();
  await settled(page); await expect(title(page)).toHaveText("Negative signs");
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 70, { steps: 4 });
  await page.mouse.move(x, y - 90, { steps: 8 }); await page.mouse.up(); await settled(page);
  await expect(title(page)).toHaveText("Check an answer");
});

test("rapid repeated requests are locked during each physical turn, then reverse cleanly", async ({ page }) => {
  await enter(page);
  await open(page);
  await stack(page).evaluate(el => {
    for (let i = 0; i < 10; i++) el.dispatchEvent(new KeyboardEvent("keydown", { key: i ? "ArrowUp" : "ArrowDown", bubbles: true }));
  });
  await settled(page);
  await expect(title(page)).toHaveText("Brackets");
  await page.keyboard.press("ArrowUp"); await settled(page);
  await expect(title(page)).toHaveText("Negative signs");
  await expect(page.locator("[data-info-card-face]")).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "Info card media", exact: true })).toHaveCount(0);
});

for (const count of [1, 2, 12]) test(`${count} attached cards have bounded backing layers and stable circular order`, async ({ page }) => {
  await enter(page, { count }); await open(page);
  await expect(page.locator("[data-info-card-backing]")).toHaveCount(Math.min(2, count - 1));
  const rounds = count === 12 ? 12 : 4;
  for (let n = 1; n <= rounds; n++) {
    await swipe(page, "down");
    const position = n % count;
    await expect(title(page)).toHaveText(position < 5 ? titles[position] : `Reference ${position + 1}`);
  }
  await swipe(page, "up");
  const position = (rounds - 1 + count) % count;
  await expect(title(page)).toHaveText(position < 5 ? titles[position] : `Reference ${position + 1}`);
  await expect(page.locator("[data-info-card-face]")).toHaveCount(1);
});

test("zero attachments leave the ordinary Step View navigation and player usable", async ({ page }) => {
  await enter(page, { count: 0 });
  await expect(page.locator("[data-info-card-pouch]")).toHaveCount(0);
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
  await expect(page.locator(".step-view-actions > span")).toHaveText("2/4");
});

test("closing interrupts opening and browsing; pouch can reverse an unfinished return", async ({ page }) => {
  await enter(page);
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "opening");
  await page.keyboard.press("Escape");
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "closing");
  await page.getByRole("button", { name: /^Close information cards \(/ }).click();
  await settled(page);
  await expect(title(page)).toHaveText("Negative signs");
  await page.keyboard.press("ArrowUp");
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "browsing");
  await page.getByRole("button", { name: "Close information card stack", exact: true }).click();
  await expect(page.locator(".focused-card-layer")).toHaveAttribute("inert", "");
  await page.locator(".step-view-actions > button:last-of-type").dispatchEvent("click");
  await expect(page.locator(".step-view-actions > span")).toHaveText("1/4");
  await expect(dialog(page)).toHaveCount(0);
  await open(page); await expect(title(page)).toHaveText("Negative signs");
  await swipe(page, "down");
  await page.getByRole("button", { name: /^Close information cards \(/ }).click();
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "closing");
  await page.getByRole("button", { name: /^Close information cards \(/ }).click();
  await settled(page); await expect(title(page)).toHaveText("Brackets");
  await close(page); await open(page); await expect(title(page)).toHaveText("Negative signs");
});

for (const phase of ["opening", "browsing"] as const) test(`unmount during ${phase} cancels the motion and both modal layers`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await enter(page);
  if (phase === "browsing") { await open(page); await page.keyboard.press("ArrowUp"); }
  else await page.getByRole("button", { name: /^Open information cards/ }).click();
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", phase);
  await page.evaluate(() => (window as unknown as { infoFixture: { unmount(): void } }).infoFixture.unmount());
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe("hidden");
  expect(errors).toEqual([]);
});

for (const media of ["image", "video"]) test(`nested ${media} returns to the selected non-first card and blocks browsing underneath`, async ({ page }) => {
  await enter(page, { media }); await open(page);
  await swipe(page, "down"); await expect(title(page)).toHaveText("Brackets");
  await current(page).evaluate(el => Object.assign(window, { selectedInfoCard: el }));
  await page.getByRole("button", { name: media === "image" ? "View image" : "Watch video", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Info card media", exact: true });
  await expect(viewer).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await stack(page).dispatchEvent("keydown", { key: "ArrowDown" });
  await expect(title(page)).toHaveText("Brackets");
  await page.getByRole("button", { name: "Close info card media", exact: true }).click();
  await expect(title(page)).toHaveText("Brackets");
  expect(await current(page).evaluate(el => el === (window as unknown as { selectedInfoCard: Element }).selectedInfoCard)).toBe(true);
  await expect(page.getByRole("button", { name: media === "image" ? "View image" : "Watch video", exact: true })).toBeFocused();
  await swipe(page, "up"); await expect(title(page)).toHaveText("Negative signs");
});

test("activity state and scroll survive repeated animated consultations and underlying gestures stay isolated", async ({ page }) => {
  await enter(page, { activity: true });
  await page.getByLabel("Your answer", { exact: true }).fill("Still here");
  await page.getByRole("button", { name: "Attempts 0", exact: true }).click();
  const activity = page.locator("[data-test-activity]");
  const mount = await activity.getAttribute("data-mount");
  await activity.evaluate(el => { el.scrollTop = 80; });
  for (let n = 0; n < 3; n++) {
    await open(page); await swipe(page, "down"); await swipe(page, "up"); await close(page);
    await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue("Still here");
    await expect(page.getByRole("button", { name: "Attempts 1", exact: true })).toBeAttached();
    expect(await activity.getAttribute("data-mount")).toBe(mount);
    expect(await activity.evaluate(el => el.scrollTop)).toBe(80);
  }
  await expect(page.locator(".focused-card-object")).not.toHaveClass(/is-flipped/);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
  await expect(page.locator(".step-view-actions > span")).toHaveText("2/4");
});

test("reduced motion keeps circular navigation, closing and focus without a long diagonal journey", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page); await open(page);
  expect(await stack(page).evaluate(el => {
    const m = new DOMMatrix(getComputedStyle(el).transform); return [m.a, m.b, m.c, m.d, m.e, m.f];
  })).toEqual([1, 0, 0, 1, 0, 0]);
  await page.keyboard.press("ArrowUp"); await settled(page);
  await expect(title(page)).toHaveText("Check an answer");
  await page.keyboard.press("ArrowDown"); await settled(page);
  await expect(title(page)).toHaveText("Negative signs");
  await close(page);
  await expect(page.getByRole("button", { name: /^Open information cards/ })).toBeFocused();
});

test("viewport changes during a turn preserve in-flight dimensions and selection, then realign", async ({ page }) => {
  await enter(page); await open(page);
  const scale = await stack(page).evaluate(el => el.parentElement!.getBoundingClientRect().width / el.parentElement!.clientWidth);
  await page.keyboard.press("ArrowDown");
  await expect(stack(page)).toHaveAttribute("data-info-stack-phase", "browsing");
  await page.setViewportSize({ width: 430, height: 932 });
  expect(await stack(page).evaluate(el => el.parentElement!.getBoundingClientRect().width / el.parentElement!.clientWidth)).toBeCloseTo(scale, 3);
  await expect.poll(() => page.evaluate(() => {
    const pouch = document.querySelector("dialog [data-info-card-pouch]")!.getBoundingClientRect();
    const step = document.querySelector(".step-view-layer")!.getBoundingClientRect();
    return Math.max(Math.abs(pouch.left - step.left), Math.abs(pouch.bottom - step.bottom));
  })).toBeLessThan(0.5);
  await settled(page); await expect(title(page)).toHaveText("Brackets");
  for (const [width, height] of [[430, 932], [844, 390], [360, 780]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => stack(page).evaluate(el => {
      const parent = el.parentElement!.getBoundingClientRect(), step = document.querySelector(".step-view-layer")!.getBoundingClientRect();
      return Math.max(Math.abs(parent.left - step.left), Math.abs(parent.bottom - step.bottom));
    })).toBeLessThan(0.5);
    await expect(title(page)).toHaveText("Brackets");
  }
});

test("real Chromium touch input cycles the pack without scrolling the page or triggering media", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage(); await enter(page); await open(page);
    const r = (await stack(page).boundingBox())!, x = r.x + r.width * 0.6, y = r.y + r.height * 0.45;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let n = 1; n <= 6; n++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + n * 15 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await settled(page); await expect(title(page)).toHaveText("Brackets");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole("dialog", { name: "Info card media", exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});
