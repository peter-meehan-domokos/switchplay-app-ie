import { expect, test } from "@playwright/test";
const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null");
const media = JSON.parse(process.env.PHASE7_MEDIA_REVIEW ?? "null");
test.skip(!group || !media, "Requires --group-media --complete-loading disposable fixtures");
for (const browserName of ["chromium", "webkit"] as const) for (const kind of ["Personal", "Me", "Group"] as const) {
 test(`${browserName}: ${kind} prepares both faces of every Card before presentation`, async ({ playwright }) => {
  const browser = await playwright[browserName].launch();
  const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); let release = () => {};
  try {
   expect((await page.request.post("/api/auth/login", { data: { identifier: kind === "Group" ? "phase2" : "Aoife Kelly", password: "local-test-only" } })).ok()).toBeTruthy();
   // WebKit does not send Secure localhost cookies over plain HTTP. The
   // disposable loopback harness uses the same signed session with a transport-
   // only cookie copy; deployed HTTPS and application auth remain unchanged.
   if (browserName === "webkit" && process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
   // Warm server compilation/connection separately. No actual-open writes here.
   const prepUrl = kind === "Personal" ? `/api/decks-data/${group.deckId}/preparation` : `/api/group-experiences/${group.experienceId}/preparation?perspective=${kind === "Me" ? "self" : "group"}`;
   expect((await page.request.get(prepUrl)).ok()).toBeTruthy();
   let payload: { deck?: { cards: { id: string }[] }; bootstrap?: { deck: { cards: { id: string }[] } }; contributions: { media: Record<string, { items: unknown[]; total: number }>; reflections: Record<string, unknown> } } | undefined;
   let received = false, finished = false, requestMs = 0, bytes = 0, parseMs = 0;
   const held = new Promise<void>(resolve => { release = resolve; });
   await page.route("**/preparation*", async route => {
    const start = Date.now(), response = await route.fetch(); requestMs = Date.now() - start;
    expect(response.ok()).toBeTruthy(); const body = await response.text(); bytes = Buffer.byteLength(body);
    const parse = performance.now(); payload = JSON.parse(body); parseMs = performance.now() - parse; received = true;
    await held; await route.fulfill({ response, body }); finished = true;
   });
   const query = new URLSearchParams({ openCard: group.cardIds[0], [kind === "Personal" ? "openDeck" : "openExperience"]: kind === "Personal" ? group.deckId : group.experienceId,
     ...(kind === "Personal" ? {} : { progressScene: "1", progressPerspective: kind === "Me" ? "self" : "group" }) });
   const start = Date.now(); await page.goto(`/decks?${query}`); await expect.poll(() => received).toBe(true);
   await expect(page.locator(".deck-card.is-active")).toHaveCount(0);
   expect((payload!.deck ?? payload!.bootstrap!.deck).cards).toHaveLength(6);
   for (const id of group.cardIds) { expect(payload!.contributions.media[id].items).toHaveLength(5); expect(payload!.contributions.media[id].total).toBeGreaterThanOrEqual(5); expect(payload!.contributions.reflections[id]).toBeTruthy(); }
   // Independent mounted metadata reads cannot rescue incomplete preparation.
   let waterfall = 0;
   await page.route(/\/api\/(reflections\?|media\/history\?|group-experiences\/[^/]+\/cards\/[^/]+\/media\?)/, route => { waterfall++; return route.abort("failed"); });
   const present = Date.now(); release(); await expect(page.locator(".deck-card.is-active")).toBeVisible();
   const visibleMs = Date.now() - present;
   await page.locator(".deck-card.is-active").press("Enter"); await page.waitForTimeout(700);
   const title = (await page.locator(".focused-card-surface--front .card-title-anchor").boundingBox())!;
   await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2); await page.mouse.down(); await page.mouse.move(title.x + title.width / 2 + 180, title.y + title.height / 2, { steps: 12 }); await page.mouse.up();
   await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(5);
   expect(finished).toBe(true); expect(waterfall).toBe(0);
   for (let i = 1; i < 6; i++) {
    await page.waitForTimeout(700); // Preserve the existing traversal/flip locks.
    const anchor = (await page.locator(".focused-card-surface--back .card-title-anchor").boundingBox())!;
    await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2); await page.mouse.down();
    await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2 + 170, { steps: 12 }); await page.mouse.up();
    await expect(page.locator(".focused-card-surface--back .card-title-anchor")).toHaveCount(1);
    await expect(page.locator(".focused-card-surface--back .card-title-anchor")).toContainText(`Card ${i + 1}`);
    await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(5);
    await expect(page.locator(".focused-card-surface--back .reflection-area")).toContainText(`${kind === "Group" ? "Collective" : kind === "Personal" ? "Personal" : "Player"} reflection for Card ${i + 1}`);
   }

   console.log("CP2_BROWSER", JSON.stringify({ browserName, kind, requestMs, bytes, nodeParseMs: +parseMs.toFixed(2), releaseToStackMs: visibleMs, directNavigationIncludingArtificialHoldMs: Date.now() - start }));
  } finally { release(); await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); }
 });
}

for (const browserName of ["chromium", "webkit"] as const) test(`${browserName}: matched warm complete-opening measurements`, async ({ playwright }) => {
 const browser = await playwright[browserName].launch();
 const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
 const page = await context.newPage();
 await page.addInitScript(() => {
  const originalFetch = window.fetch;
  const timings: number[] = []; (window as unknown as { cp2Parses: number[] }).cp2Parses = timings;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
    if (url.includes("/preparation")) {
      const json = response.json.bind(response);
      response.json = async () => { const start = performance.now(); const value = await json(); timings.push(performance.now() - start); return value; };
    }
    return response;
  };
 });
 try {
  for (const kind of ["Personal", "Me", "Group"] as const) {
   expect((await page.request.post("/api/auth/login", { data: { identifier: kind === "Group" ? "phase2" : "Aoife Kelly", password: "local-test-only" } })).ok()).toBeTruthy();
   if (browserName === "webkit" && process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
   const params = new URLSearchParams({ [kind === "Personal" ? "openDeck" : "openExperience"]: kind === "Personal" ? group.deckId : group.experienceId,
    ...(kind === "Personal" ? {} : { progressScene: "1", progressPerspective: kind === "Me" ? "self" : "group" }) });
   const samples = [];
   for (let i = -1; i < 3; i++) {
    const start = Date.now(); await page.goto(`/decks?${params}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".deck-card.is-active")).toBeVisible();
    if (kind === "Personal") await expect(page.locator(".app-shell--deck")).toHaveAttribute("data-working-ready", "true");
    else await expect(page.locator(".group-picker-current")).toBeEnabled();
    const completeMs = Date.now() - start;
    const timing = await page.evaluate(() => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const prep = resources.find(row => row.name.includes("/preparation"));
      return { preparationMs: prep ? +(prep.responseEnd - prep.startTime).toFixed(2) : null, responseToObservationMs: prep ? +(performance.now() - prep.responseEnd).toFixed(2) : null,
        requests: resources.filter(row => new URL(row.name).pathname.startsWith("/api/")).map(row => ({ path: new URL(row.name).pathname, duration: +row.duration.toFixed(2), bytes: row.encodedBodySize })), jsonBodyReadAndParseMs: (window as unknown as { cp2Parses: number[] }).cp2Parses };
    });
    if (i >= 0) samples.push({ completeMs, ...timing });
   }
   console.log("CP2_COMPLETE_OPENING", JSON.stringify({ browserName, kind, environment: "local optimized disposable; warm direct navigation", samples }));
  }
 } finally { await browser.close(); }
});
