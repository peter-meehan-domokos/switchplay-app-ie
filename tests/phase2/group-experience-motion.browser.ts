import { expect, test, type Page } from "@playwright/test";
const fixture = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null") as { experienceId: string; cardIds: string[] } | null;
test.skip(!fixture, "Requires disposable --group-experiences fixture");
// Screenshot/DOM tracing distorts input-to-paint measurements. Other browser
// files retain traces; these motion cases keep every functional/budget assertion.
test.use({ trace: "off" });
async function open(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  const current = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
  await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/navigation`, { data: { accessEpoch: current.accessEpoch,
    expectedStructureRevision: current.structureRevision, selection: { perspective: "group" }, activeCardId: fixture!.cardIds[0] } });
  await page.goto(`/decks?openExperience=${fixture!.experienceId}`);
  await expect(page.locator(".group-picker-current")).toBeEnabled();
  await page.locator(".deck-card.is-active").focus(); await page.locator(".deck-card.is-active").press("Enter");
  await expect(page.locator(".focused-card-layer")).toBeVisible();
}
async function swipe(page: Page, selector: string, x: number, y: number) {
  const rect = await page.locator(selector).boundingBox(); if (!rect) throw Error("Missing gesture target");
  const px = rect.x + rect.width / 2, py = rect.y + rect.height / 2;
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + x, py + y, { steps: 12 }); await page.mouse.up();
}
test("focused grid preserves scroll, Card/face and physical stack through comparison and vertical traversal", async ({ page }) => {
  await open(page);
  await swipe(page, ".focused-card-surface--front .card-title-anchor", 180, 0);
  const flippedAt = Date.now();
  await expect(page.locator(".group-experience")).toHaveAttribute("data-face", "back");
  await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
  const panel = page.getByRole("region", { name: "Follower comparison" }); await expect(panel).toBeVisible();
  await expect(panel.locator(".group-identity-card")).toHaveCount(16);
  const firstName = await panel.locator(".group-identity-card").first().innerText(); expect(firstName).toContain("Galway U18");
  const height = (await panel.boundingBox())!.height; expect(height / 844).toBeGreaterThanOrEqual(.35); expect(height / 844).toBeLessThanOrEqual(.40);
  await expect.poll(async () => {
    const card = await page.locator(".focused-card-object").boundingBox(), grid = await panel.boundingBox();
    return card && grid ? card.y + card.height - grid.y : 100;
  }).toBeLessThan(10);
  await panel.locator("button.group-identity-card").filter({ hasText: "Alice" }).click();
  await expect(panel.locator("header")).toContainText("Galway U18 · Alice");
  await expect(page.locator(".group-experience")).toHaveAttribute("data-face", "back");
  await expect(page.getByRole("button", { name: /Adjust .* reading/ })).toHaveCount(0);
  await panel.locator(".group-comparison-scroll").evaluate(element => { element.scrollTop = 90; });
  const scroll = await panel.locator(".group-comparison-scroll").evaluate(element => element.scrollTop);
  // data-face changes at flip START. Preserve the existing 680ms flip gesture
  // lock before testing a second, vertical gesture; optimized rendering must
  // not accidentally turn this into a request to traverse during the lock.
  const remainingFlipLock = 700 - (Date.now() - flippedAt);
  if (remainingFlipLock > 0) await page.waitForTimeout(remainingFlipLock);
  await swipe(page, ".focused-card-surface--back .card-title-anchor", 0, 170);
  await expect(page.locator(".group-experience")).toHaveAttribute("data-current-card", fixture!.cardIds[1]);
  await expect(panel).toBeVisible(); expect(await panel.locator(".group-comparison-scroll").evaluate(element => element.scrollTop)).toBe(scroll);
  await expect(page.locator(".group-experience")).toHaveAttribute("data-face", "back");
  await page.getByRole("button", { name: "Close focused card", exact: true }).click({ position: { x: 10, y: 12 } });
  await expect(panel).toHaveCount(0); await expect(page.locator(".group-picker-current")).toHaveText(/Alice/);
  await page.locator(".deck-card.is-active").focus(); await page.locator(".deck-card.is-active").press("Enter");
  await expect(page.locator(".focused-card-layer")).toBeVisible(); await expect(panel).toHaveCount(0);
});
test("50 loaded comparisons keep the same scene and Card object with no identity-tile players", async ({ page }) => {
  await open(page); await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
  const measurement = await page.evaluateHandle(() => {
    if (!PerformanceObserver.supportedEntryTypes.includes("event")) throw Error("Browser Event Timing is required for the paint budget");
    const state = { scene: document.querySelector(".deck-detail"), stack: document.querySelector(".card-stack"), card: document.querySelector(".focused-card-object"),
      trace: document.querySelector(".focused-card-surface--back .focused-card-signal-trace"), trustedClicks: 0, since: performance.now(), durations: new Map<number, number>(),
      costs: new Map<number, { processing: number; delay: number; presentation: number }>() };
    const count = (event: MouseEvent) => { if (event.isTrusted && event.target instanceof Element && event.target.closest(".group-identity-card")) state.trustedClicks++; };
    const record = (entries: PerformanceEntry[]) => {
      for (const value of entries) {
        const event = value as PerformanceEventTiming & { interactionId: number };
        if (event.startTime >= state.since && ["pointerdown", "pointerup", "click"].includes(event.name) && event.interactionId > 0
          && event.duration >= (state.durations.get(event.interactionId) ?? 0)) {
          state.durations.set(event.interactionId, event.duration);
          state.costs.set(event.interactionId, { processing: event.processingEnd-event.processingStart, delay: event.processingStart-event.startTime,
            presentation: Math.max(0, event.duration-event.processingEnd+event.startTime) });
        }
      }
    };
    const observer = new PerformanceObserver(list => record(list.getEntries()));
    // Native durations include presentation, rounded to 8ms, minimum threshold
    // 16ms (https://www.w3.org/TR/event-timing/). Two rAF callbacks instead
    // include an extra frame and are not a direct input-to-paint measurement.
    observer.observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit & { durationThreshold: number });
    document.addEventListener("click", count, true);
    // One excluded calibration click proves the observer is reporting events.
    // Never silently pass an unsupported/broken instrument with zero samples.
    document.addEventListener("click", () => { const until = performance.now() + 32; while (performance.now() < until) { /* calibration only */ } }, { once: true, capture: true });
    return { state, observer, count, record };
  });
  const buttons = page.locator(".group-identity-card");
  await buttons.nth(1).click();
  await expect.poll(() => measurement.evaluate(value => value.state.durations.size)).toBeGreaterThan(0);
  // This is the loaded-comparison budget, not the initial focus/grid animation.
  // Five excluded warm-up inputs (including calibration) prepare both views;
  // wait for physical geometry to settle, never for a measured latency to pass.
  for (let i = 0; i < 4; i++) {
    await buttons.nth(i % 2).click();
    await page.evaluate(async () => {
      const card = document.querySelector(".focused-card-object")!;
      let previous = card.getBoundingClientRect(), stable = 0;
      const deadline = performance.now() + 3000;
      while (performance.now() < deadline) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const next = card.getBoundingClientRect();
        stable = Math.max(Math.abs(next.x-previous.x), Math.abs(next.y-previous.y), Math.abs(next.width-previous.width), Math.abs(next.height-previous.height)) < .1 ? stable + 1 : 0;
        if (stable >= 4) return;
        previous = next;
      }
      throw Error("Initial Card geometry did not settle before the loaded benchmark");
    });
  }
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await measurement.evaluate(value => { value.state.durations.clear(); value.state.costs.clear(); value.state.trustedClicks = 0; value.state.since = performance.now(); });
  for (let i = 0; i < 50; i++) await buttons.nth(i % 2).click();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const result = await measurement.evaluate(({ state, observer, count, record }) => {
    record(observer.takeRecords());
    observer.disconnect(); document.removeEventListener("click", count, true);
    return { sameSignalTrace: document.querySelector(".focused-card-surface--back .focused-card-signal-trace") === state.trace,
      sameScene: document.querySelector(".deck-detail") === state.scene, sameStack: document.querySelector(".card-stack") === state.stack,
      sameCard: document.querySelector(".focused-card-object") === state.card, trustedClicks: state.trustedClicks, measured: [...state.durations.values()], costs: [...state.costs.values()],
      players: document.querySelectorAll(".group-identity-card video").length, face: document.querySelector(".group-experience")?.getAttribute("data-face") };
  });
  await measurement.dispose();
  expect(result.sameScene).toBe(true); expect(result.sameStack).toBe(true); expect(result.sameCard).toBe(true); expect(result.players).toBe(0);
  expect(result.sameSignalTrace).toBe(true); expect(result.trustedClicks).toBe(50); expect(result.measured.length).toBeLessThanOrEqual(50);
  // Unreported interactions are below the 16ms threshold; use that conservative
  // upper bound instead of inventing exact timings or excluding the fast inputs.
  const sorted = [...result.measured, ...Array(50 - result.measured.length).fill(16)].sort((a,b) => a-b);
  const cost95 = (key: "processing" | "delay" | "presentation") => result.costs.map(value => value[key]).sort((a,b) => a-b)[Math.ceil(result.costs.length * .95) - 1] ?? 0;
  expect(result.face).toBe("front");
  console.log(JSON.stringify({ loadedSwitches: 50, warmupInputs: 5, method: "native Event Timing, max event per interaction", reportedInteractions: result.measured.length,
    belowThreshold: 50 - result.measured.length, nextPaintP95Ms: sorted[Math.ceil(sorted.length * .95) - 1],
    processingP95Ms: cost95("processing"), inputDelayP95Ms: cost95("delay"), presentationP95Ms: cost95("presentation") }));
  expect(sorted[Math.ceil(sorted.length * .95) - 1]).toBeLessThanOrEqual(100);
});
