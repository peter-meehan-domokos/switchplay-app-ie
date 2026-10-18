import { expect, test, type Locator, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const bundles = new Map<string, string>();
test.beforeAll(async () => {
  for (const mode of ["development", "production"]) {
    bundles.set(mode, (await build({ entryPoints: ["tests/fixtures/cardPlacementHarness.tsx"], bundle: true, write: false,
      platform: "browser", format: "iife", jsx: "automatic", define: {
        "process.env.NODE_ENV": JSON.stringify(mode), "process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA": '"0"', "process.env": "{}",
      } })).outputFiles[0].text);
  }
});

async function mount(page: Page, mode: string, width: number) {
  await page.setViewportSize({ width, height: 1100 });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== "https://fixture.invalid") return route.abort();
    return route.fulfill(url.pathname.endsWith(".svg") ? { contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#bd7948"/></svg>' }
      : { contentType: "text/html", body: '<div id="fixture"></div>' });
  });
  await page.goto(`https://fixture.invalid/${mode === "development" ? "?strict" : ""}`);
  await page.addStyleTag({ content: await readFile("src/app/globals.css", "utf8") });
  await page.addScriptTag({ content: bundles.get(mode)! });
  await expect(page.locator(".deck-card.is-active")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(750); // Settle initial scene sizing before sampling movement.
}

async function swipe(page: Page, card: Locator, dx: number, dy: number, back: boolean) {
  const header = card.locator(`.deck-card-surface--${back ? "back" : "front"} .card-title-anchor`);
  const rect = (await header.boundingBox())!;
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 }); await page.mouse.up();
}

type Sample = { time: number; steps: number; active: boolean; interactive: boolean; width: number; height: number; x: number; y: number;
  anchors: Record<string, number[]>; text: string; surfaceWidth: number; surfaceHeight: number };
// Sample composited rectangles on every browser frame, not just settled DOM styles.
async function observe(page: Page, index: number, back: boolean) {
  await page.evaluate(({ index, back }) => {
    const samples: Sample[] = [];
    (window as unknown as { placementSamples: Sample[] }).placementSamples = samples;
    document.addEventListener("pointerup", () => {
      const start = performance.now();
      const tick = () => {
        const card = document.querySelectorAll<HTMLElement>(".deck-card-slot")[index];
        const face = card.querySelector<HTMLElement>(`.deck-card-surface--${back ? "back" : "front"}`)!;
        const rect = face.getBoundingClientRect(), cardBounds = card.getBoundingClientRect(), anchors: Record<string, number[]> = {};
        for (const selector of [".card-title-anchor", ".active-card-title-block", ".active-step-list", ".card-creator-attribution",
          ".back-card-media-carousel", ".focused-card-back-signals", ".focused-card-back-reflection-fragment"]) {
          const anchor = face.querySelector(selector);
          if (!anchor) continue;
          const bounds = anchor.getBoundingClientRect();
          anchors[selector] = [(bounds.x - rect.x) / rect.width, (bounds.y - rect.y) / rect.height,
            bounds.width / rect.width, bounds.height / rect.height];
        }
        samples.push({ time: performance.now() - start, steps: card.querySelectorAll(".active-step-item").length,
          active: card.classList.contains("is-active"), interactive: card.hasAttribute("tabindex"),
          width: cardBounds.width, height: cardBounds.height, x: cardBounds.x, y: cardBounds.y, anchors, text: face.textContent ?? "",
          surfaceWidth: face.clientWidth, surfaceHeight: face.clientHeight });
        if (performance.now() - start < 1100) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { capture: true, once: true });
  }, { index, back });
}
async function samples(page: Page): Promise<Sample[]> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { placementSamples?: Sample[] }).placementSamples?.at(-1)?.time ?? 0)).toBeGreaterThan(1100);
  return page.evaluate(() => (window as unknown as { placementSamples: Sample[] }).placementSamples);
}
function expectContinuity(frames: Sample[]) {
  expect(frames.length).toBeGreaterThan(15);
  const reference = frames[0];
  for (const frame of frames) {
    expect(frame.text).toBe(reference.text);
    expect(frame.surfaceWidth).toBe(reference.surfaceWidth);
    expect(frame.surfaceHeight).toBe(reference.surfaceHeight);
    expect(frame.width / frame.height).toBeCloseTo(1 / 1.45, 2);
    for (const [selector, coordinates] of Object.entries(reference.anchors)) {
      expect(frame.anchors[selector], selector).toBeDefined();
      coordinates.forEach((coordinate, index) => expect(Math.abs(frame.anchors[selector][index] - coordinate), `${selector} coordinate ${index}`).toBeLessThan(.008));
    }
  }
}

for (const mode of ["development", "production"]) for (const width of [320, 390, 1280]) for (const back of [false, true]) {
  test(`${mode} ${width}px ${back ? "back" : "front"}: content and proportions survive placement and retrieval`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await mount(page, mode, width);
    if (back) {
      await swipe(page, page.locator(".deck-card.is-active"), 160, 0, false);
      await expect(page.locator(".deck-card.is-active")).toHaveAttribute("data-deck-flipped", "true");
      await page.waitForTimeout(800);
    }
    const first = page.locator(".deck-card-slot").nth(0);
    const active = (await first.boundingBox())!;
    await observe(page, 0, back);
    await swipe(page, first, 0, 180, back);
    const placedFrames = await samples(page);
    expectContinuity(placedFrames);
    // Existing first past-Card rectangle and hit boundary, including depth scale.
    const placed = placedFrames.at(-1)!;
    expect(placed.width / active.width).toBeCloseTo(148 * .965 / 252, 2);
    const scene = (await page.locator(".card-stack").boundingBox())!;
    const sceneScale = active.width / 252;
    expect(placed.x - scene.x).toBeCloseTo(148 * (1 - .965) / 2 * sceneScale, 0);
    expect(placed.y - scene.y).toBeCloseTo((474 + 148 * 1.45 * (1 - .965) / 2) * sceneScale, 0);
    await expect(page.locator(".deck-card.is-active .active-step-item")).toHaveCount(3);

    await observe(page, 0, back);
    await swipe(page, first, 0, -180, back);
    expectContinuity(await samples(page));
    await expect(first).toHaveClass(/is-active/);
    await expect(first).toHaveAttribute("data-deck-flipped", String(back));
    await page.screenshot({ path: info.outputPath("retrieved-card.png") });
    expect(errors).toEqual([]);
  });
}

test("incoming content exists on the first transition frame, survives reverse navigation and stays locked", async ({ page }) => {
  await mount(page, "production", 390);
  for (const [from, to, dy] of [[0, 1, 180], [1, 2, 180], [2, 1, -180], [1, 0, -180]]) {
    await observe(page, to, false);
    await swipe(page, page.locator(".deck-card-slot").nth(from), 0, dy, false);
    const frames = await samples(page);
    expect(frames.every(frame => frame.steps === 3)).toBe(true);
    expect(new Set(frames.map(frame => frame.text)).size).toBe(1);
    const during = frames.filter(frame => frame.time < 300);
    expect(during.length).toBeGreaterThan(2);
    expect(during.every(frame => !frame.interactive)).toBe(true);
    await expect(page.locator(".deck-card-slot").nth(to)).toHaveClass(/is-active/);
  }
});

test("repeated flips and varied Card backs preserve media selection and focused navigation", async ({ page }, info) => {
  test.setTimeout(60_000);
  await mount(page, "production", 390);
  for (const index of [0, 1, 2]) {
    const card = page.locator(".deck-card-slot").nth(index);
    await swipe(page, card, 160, 0, false); await page.waitForTimeout(800);
    await expect(card).toHaveAttribute("data-deck-flipped", "true");
    await observe(page, index, true); await swipe(page, card, 0, 180, true);
    expectContinuity(await samples(page));
    await observe(page, index, true); await swipe(page, card, 0, -180, true);
    expectContinuity(await samples(page));
    await swipe(page, card, -160, 0, true); await page.waitForTimeout(800);
    await expect(card).toHaveAttribute("data-deck-flipped", "false");
    if (index < 2) { await swipe(page, card, 0, 180, false); await page.waitForTimeout(1100); }
  }
  await page.locator(".deck-card.is-active .active-card-identity").click();
  const header = page.locator(".focused-card-surface--front .card-title-anchor");
  await expect(header).toBeVisible(); await page.waitForTimeout(800);
  const rect = (await header.boundingBox())!;
  await page.mouse.move(rect.x + 30, rect.y + 10); await page.mouse.down();
  await page.mouse.move(rect.x + 30, rect.y + 180, { steps: 10 }); await page.mouse.up();
  await expect(page.locator(".active-card-front--focused .active-step-item")).toHaveCount(3);
  await page.getByRole("button", { name: "Close focused card", exact: true }).click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(800);
  await swipe(page, page.locator(".deck-card.is-active"), 160, 0, false); await page.waitForTimeout(800);
  await page.locator(".deck-card.is-active .back-card-media-carousel-item--button").first().click();
  await expect(page.locator("body")).toHaveAttribute("data-media-opened", "true");
  await page.screenshot({ path: info.outputPath("back-with-media.png") });
});

test("focused signal dragging and media selection retain their own gesture boundaries", async ({ page }) => {
  await mount(page, "production", 390);
  await page.locator(".deck-card.is-active").press("Enter");
  const header = page.locator(".focused-card-surface--front .card-title-anchor");
  await expect(header).toBeVisible(); await page.waitForTimeout(800);
  const rect = (await header.boundingBox())!;
  await page.mouse.move(rect.x + 20, rect.y + 10); await page.mouse.down();
  await page.mouse.move(rect.x + 180, rect.y + 10, { steps: 10 }); await page.mouse.up();
  const back = page.locator(".focused-card-surface--back");
  await page.waitForTimeout(800);
  const signal = back.locator(".focused-card-signal-track").first();
  const track = (await signal.boundingBox())!;
  await page.mouse.move(track.x + track.width / 2, track.y + 20); await page.mouse.down();
  await page.mouse.move(track.x + track.width * .9, track.y + 20, { steps: 10 }); await page.mouse.up();
  await expect(page.locator("body")).toHaveAttribute("data-signal-reading", /./);
  expect(Number(await page.locator("body").getAttribute("data-signal-reading"))).toBeGreaterThan(6);
  await expect(back.locator("h2")).toHaveText("Card 1");
  await back.locator(".back-card-media-carousel-item--button").first().click();
  await expect(page.locator("body")).toHaveAttribute("data-media-opened", "true");
  await expect(back.locator("h2")).toHaveText("Card 1");
});
