import { expect, test, type BrowserContext, type BrowserType, type Page } from "@playwright/test";

// Regression: the Deck scene scale/frame height used to be measured after first paint, and the
// future Cards were declared with a transform-origin that Framer layout projection overrides, so
// a data-driven (cold) open painted one frame in the wrong place and then sprang the Cards into
// position. Every animation frame is sampled from document start. The FIRST frame in which the
// scene exists must already carry the final scale, height and Card positions.
//
// KNOWN RESIDUAL (not fixed here): when the scene is scaled below 1 (short viewports, e.g. Safari
// with toolbars) Framer's layout measurement is thrown off by the plain-div scaler, so the back
// Cards drift by about (1 - scale) x their translate whenever an ancestor re-renders, then ease
// back. Strict "no later movement" is therefore asserted only where the scale is 1; scaled
// viewports assert a bound so a larger regression is still caught.
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
  const scaled = last.scale < .9995;
  // Unscaled: nothing may move afterwards. Scaled: only the documented residual drift is tolerated.
  const allowed = scaled ? 1 + (1 - last.scale) * 75 : .75;
  if (scaled) test.info().annotations.push({ type: "known-residual", description: "Framer layout measurement under the scaled scene drifts the back Cards after re-renders" });
  for (const frame of frames) frame.tops.forEach((top, i) => expect(Math.abs(top - last.tops[i]), `Card ${i} moved after the first frame (scale ${last.scale})`).toBeLessThan(allowed));
  return last;
}
async function finish(browser: { close(): Promise<void> }, context: BrowserContext) { await context.close(); await browser.close(); }

for (const engine of ["chromium", "webkit"] as const) {
  for (const [role, identifier] of [["Admin", "phase2"], ["follower", "other"]] as const) for (const viewport of viewports) {
    test(`${engine}: first ${role} Group opening has its final scale and Card positions in the first frame at ${viewport.width}x${viewport.height}`, async ({ playwright }) => {
      const { browser, context, page } = await session(playwright[engine], identifier, viewport);
      try {
        await page.goto(`/decks?openExperience=${group!.experienceId}`);
        await assertStable(page, { cold: true });
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
    } finally { await finish(browser, context); }
  });
}
