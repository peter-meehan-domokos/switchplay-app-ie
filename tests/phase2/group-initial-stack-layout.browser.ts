import { expect, test, type BrowserContext, type BrowserType, type Page } from "@playwright/test";

// Regression: the Deck scene scale/frame height used to be measured after first paint, and the
// future Cards were declared with a transform-origin that Framer layout projection overrides, so
// a data-driven (cold) open painted one frame in the wrong place and then sprang the Cards into
// position. Every animation frame is sampled from document start. The FIRST frame in which the
// scene exists must already carry the final scale, height and Card positions.
//
// Regression: when the scene is scaled below 1 (short viewports, e.g. iPhone Safari with toolbars)
// Framer's pre-render snapshot is thrown off by the plain-div scaler. Without a layout dependency
// every unrelated render (a resource reply after entry, or the re-render on returning to the app)
// animated the back Cards down by up to 7px and back. Nothing may move after the first frame, at
// any scale, on entry or on resume.
const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null") as { experienceId: string; deckId: string; cardIds: string[] } | null;
test.skip(!group, "Requires disposable --group-experiences fixture");
test.use({ trace: "off" });

type Frame = { scale: number; height: number | null; tops: number[] };
declare global { interface Window { __sceneFrames: Frame[] } }

function recordSceneFrames() {
  const frames: Frame[] = [];
  window.__sceneFrames = frames;
  const tick = () => {
    const scaler = document.querySelector<HTMLElement>(".deck-scene-scaler"), frame = document.querySelector<HTMLElement>(".deck-scene-frame");
    const cards = [...document.querySelectorAll(".deck-card")];
    if (scaler && frame && cards.length) frames.push({
      scale: Number(/scale\(([^)]+)\)/.exec(scaler.style.transform)?.[1] ?? "NaN"),
      // Style values (not bounding boxes) so a tile-to-Deck morph cannot distort the reading.
      height: frame.style.height ? parseFloat(frame.style.height) : null,
      tops: cards.map(card => card.getBoundingClientRect().top),
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const viewports = [{ width: 390, height: 664 }, { width: 375, height: 560 }, { width: 390, height: 844 }];
const active = (page: Page) => page.locator(".deck-card.is-active");

async function session(browserType: BrowserType, identifier: string, viewport: { width: number; height: number }) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport, isMobile: true, hasTouch: true });
  await context.addInitScript(recordSceneFrames);
  const page = await context.newPage();
  expect((await page.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).ok()).toBeTruthy();
  if (process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
  return { browser, context, page };
}
// cold: a data-driven open with no tile morph, so everything must be exact from the first frame.
// morph: the Deck opens out of its tile (warm Group reopening, Personal Decks). The existing
// re-measure logic then legitimately tracks the moving frame, so only the first frame is checked.
async function assertStable(page: Page, { cold }: { cold: boolean }) {
  await expect(active(page)).toBeVisible();
  await page.waitForTimeout(2500); // Covers the 180/420ms re-measures and any morph.
  const frames = await page.evaluate(() => window.__sceneFrames);
  expect(frames.length).toBeGreaterThan(10);
  const first = frames[0], last = frames.at(-1)!;
  // The original code painted this first frame with no measurement at all (no height, default scale).
  expect(Number.isFinite(first.scale), "scale is set on the first frame").toBe(true);
  expect(first.height, "frame height is set on the first frame").not.toBeNull();
  const scaleTolerance = cold ? .001 : .03, heightTolerance = cold ? .5 : 6;
  expect(Math.abs(first.scale - last.scale), `first scale ${first.scale} vs final ${last.scale}`).toBeLessThan(scaleTolerance);
  expect(Math.abs(first.height! - last.height!), `first height ${first.height} vs final ${last.height}`).toBeLessThan(heightTolerance);
  if (!cold) return last;
  // No scale or height correction in any later frame.
  for (const frame of frames) {
    expect(Math.abs(frame.scale - last.scale)).toBeLessThan(.001);
    expect(Math.abs(frame.height! - last.height!)).toBeLessThan(.5);
  }
  // The stack is in its final place in the first painted frame.
  first.tops.forEach((top, i) => expect(Math.abs(top - last.tops[i]), `Card ${i} is displaced in the first frame`).toBeLessThan(.75));
  assertNoMovement(frames, last, "after the first frame");
  return last;
}
function assertNoMovement(frames: Frame[], last: Frame, when: string) {
  for (const frame of frames) frame.tops.forEach((top, i) => expect(Math.abs(top - last.tops[i]), `Card ${i} moved ${when} (scale ${last.scale})`).toBeLessThan(.75));
}
// Returning to the app: the browser fires visibilitychange, pageshow and focus, and the Group
// resource re-renders the Deck at once and again when its refresh replies arrive.
async function assertStableOnResume(page: Page) {
  await page.evaluate(() => {
    const set = (state: "hidden" | "visible") => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      Object.defineProperty(document, "hidden", { configurable: true, get: () => state === "hidden" });
    };
    set("hidden"); window.dispatchEvent(new Event("blur")); document.dispatchEvent(new Event("visibilitychange"));
    window.__sceneFrames.length = 0;
    set("visible"); document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })); window.dispatchEvent(new Event("focus"));
  });
  await page.waitForTimeout(2000);
  const frames = await page.evaluate(() => window.__sceneFrames);
  expect(frames.length).toBeGreaterThan(10);
  assertNoMovement(frames, frames.at(-1)!, "after returning to the app");
}
async function finish(browser: { close(): Promise<void> }, context: BrowserContext) { await context.close(); await browser.close(); }

for (const engine of ["chromium", "webkit"] as const) {
  for (const [role, identifier] of [["Admin", "phase2"], ["follower", "other"]] as const) for (const viewport of viewports) {
    test(`${engine}: first ${role} Group opening has its final scale and Card positions in the first frame at ${viewport.width}x${viewport.height}`, async ({ playwright }) => {
      const { browser, context, page } = await session(playwright[engine], identifier, viewport);
      try {
        await page.goto(`/decks?openExperience=${group!.experienceId}`);
        await assertStable(page, { cold: true });
        await assertStableOnResume(page);
      } finally { await finish(browser, context); }
    });
  }
  test(`${engine}: warm Group reopening is measured in its first frame`, async ({ playwright }) => {
    const { browser, context, page } = await session(playwright[engine], "phase2", viewports[0]);
    try {
      await page.goto(`/decks?openExperience=${group!.experienceId}`);
      await assertStable(page, { cold: true });
      await page.getByRole("button", { name: "Back to My Decks", exact: true }).click();
      const open = page.locator(`[data-collection-item-id="${group!.experienceId}"] .deck-tile-open-action`);
      await open.waitFor();
      await page.evaluate(() => { window.__sceneFrames.length = 0; });
      await open.click();
      await assertStable(page, { cold: false });
    } finally { await finish(browser, context); }
  });
  test(`${engine}: initial Personal Deck opening is measured in its first frame`, async ({ playwright }) => {
    // The fixture follower already holds personal Deck data for this Deck (as in the interaction-boundaries test).
    const { browser, context, page } = await session(playwright[engine], "other", viewports[0]);
    try {
      await page.goto(`/decks?openDeck=${group!.deckId}`);
      await assertStable(page, { cold: false });
      await assertStableOnResume(page);
    } finally { await finish(browser, context); }
  });
}
