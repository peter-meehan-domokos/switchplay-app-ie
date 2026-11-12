import { expect, test, type BrowserType, type Page } from "@playwright/test";

// STACK-STABILITY CHECK during delayed Visual Learning Records service-module release or failure.
//
// LIMITATION (read first): in the current code only FocusedCardView consumes the Visual Learning
// Records provider; the Card stack does not subscribe to it. A provider update therefore does not
// re-render the stack, and this test passes with or without the original layout fix
// (layoutDependency). It does NOT independently establish that the original vibration fix is
// effective, and removing that fix is not expected to fail it. The sampling of the stack on entry and
// resume that does exercise the layout fix is tests/phase2/group-initial-stack-layout.browser.ts.
//
// What it does establish: main wraps the Deck scene in VisualLearningRecordsProvider, which creates
// its account service from a lazily loaded module and changes state when that module arrives or
// fails. This test holds the real service module back until the Deck has finished presenting and its
// scale and frame are settled, then lets the real provider update (service available, or service
// unavailable) and samples every animation frame on a scaled mobile scene (viewport shorter than the
// natural scene). The Cards must not move AT ALL (exact equality with the settled frame, no
// tolerance), and a normal vertical swipe must still change the active Card afterwards. It runs in
// Chromium and WebKit at two scaled viewports.
//
// History (a one-off temporary mutation, not committed and not repeatable from this file): when the
// stack was temporarily made to subscribe to the provider and the layoutDependency was also removed,
// these variants failed on the exact `tops` comparison. That shows the assertion would detect
// movement if a provider update ever reached the stack without the fix; it is a guard for that
// future change, not evidence about the code as it stands.
const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null") as { experienceId: string; deckId: string; cardIds: string[] } | null;
test.skip(!group, "Requires disposable --group-experiences fixture");
// The held module is identified by its readable function name, which an optimised build minifies.
test.skip(process.env.PHASE2_OPTIMIZED === "1", "Requires the development bundle to identify the lazily loaded service module");
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
      height: frame.style.height ? parseFloat(frame.style.height) : null,
      tops: cards.map(card => card.getBoundingClientRect().top),
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// The first two are scaled (scene taller than the viewport, as on iPhone Safari with toolbars).
const viewports = [{ width: 390, height: 664 }, { width: 375, height: 560 }];
const active = (page: Page) => page.locator(".deck-card.is-active");
const SERVICE_MODULE = "function createAccountVisualPersistence";

async function open(browserType: BrowserType, viewport: { width: number; height: number }) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport, isMobile: true, hasTouch: true });
  await context.addInitScript(recordSceneFrames);
  const page = await context.newPage();
  expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).ok()).toBeTruthy();
  return { browser, context, page };
}

/** Holds the service module until released; "fail" makes the real dynamic import reject instead. */
async function holdServiceModule(page: Page, outcome: "available" | "unavailable") {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const held = { count: 0, released: false };
  await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, async route => {
    const response = await route.fetch(), body = await response.text();
    if (!body.includes(SERVICE_MODULE)) { await route.fulfill({ response, body }); return; }
    held.count++;
    await gate; held.released = true;
    if (outcome === "unavailable") await route.abort("failed"); else await route.fulfill({ response, body });
  });
  return { held, release };
}

for (const engine of ["chromium", "webkit"] as const) for (const outcome of ["available", "unavailable"] as const) for (const viewport of viewports) {
  test(`${engine}: stack stability when the Visual Learning Records service module is released late (service ${outcome}): the Card stack does not move at ${viewport.width}x${viewport.height}`, async ({ playwright }) => {
    const { browser, context, page } = await open(playwright[engine], viewport);
    try {
      const { held, release } = await holdServiceModule(page, outcome);
      await page.goto(`/decks?openExperience=${group!.experienceId}`);
      await expect(active(page)).toBeVisible();
      await page.waitForTimeout(2500); // Presentation, morph and the 180/420ms re-measures have finished.
      // Proof that the real provider is still waiting: the update has not happened yet.
      await expect.poll(() => held.count, { message: "the service module is requested and held" }).toBeGreaterThan(0);
      expect(held.released).toBe(false);

      const settled = (await page.evaluate(() => window.__sceneFrames)).at(-1)!;
      expect(settled.tops.length, "the stack has Cards").toBeGreaterThan(1);
      expect(Number.isFinite(settled.scale) && settled.scale < 1, `the scene is scaled below 1 (scale ${settled.scale})`).toBe(true);
      await page.evaluate(() => { window.__sceneFrames.length = 0; });

      release(); // The real provider now receives its update.
      await expect.poll(() => held.released).toBe(true);
      await page.waitForTimeout(1800);

      const frames = await page.evaluate(() => window.__sceneFrames);
      expect(frames.length, "frames were sampled after the update").toBeGreaterThan(20);
      for (const frame of frames) {
        // Exact equality, no tolerance: any displacement, however small, is the original bug.
        expect(frame.scale).toBe(settled.scale);
        expect(frame.height).toBe(settled.height);
        expect(frame.tops).toEqual(settled.tops);
      }

      // Normal Card transitions still function after the update.
      const before = await active(page).innerText();
      const box = (await active(page).boundingBox())!;
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const swipe = async (dy: number) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + dy, { steps: 12 }); await page.mouse.up(); };
      await swipe(-170); await page.waitForTimeout(900);
      if (await active(page).innerText() === before) { await swipe(340); await page.waitForTimeout(900); }
      expect(await active(page).innerText(), "a vertical swipe still changes the active Card").not.toBe(before);
    } finally { await context.close(); await browser.close(); }
  });
}
