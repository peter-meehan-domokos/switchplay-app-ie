import { expect, test, type BrowserContext } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { readFile } from "node:fs/promises";
const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null");
test.skip(!group || !process.env.PHASE7_MEDIA_REVIEW, "Requires disposable complete-loading Group fixtures");
async function login(context: BrowserContext, identifier: string) {
  expect((await context.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).ok()).toBeTruthy();
  if (process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
}
for (const engine of ["chromium", "webkit"] as const) {
  test(`${engine}: active Group refresh request measurement and player to Admin update`, async ({ playwright }) => {
    const browser = await playwright[engine].launch();
    const context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const player = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL });
    try {
      await login(context, "phase2"); await login(player, "Aoife Kelly");
      const metadata = await (await player.request.get(`/api/group-experiences/${group.experienceId}`)).json();
      const learning = `/api/group-experiences/${group.experienceId}/cards/${group.cardIds[0]}/personal-learning`;
      const save = async (reading: number) => expect((await player.request.patch(learning, { data: { version: 1, accessEpoch: metadata.accessEpoch, change: { kind: "signal", stepId: "group-0-a", reading } } })).ok()).toBeTruthy();
      await save(1);
      const page = await context.newPage();
      await page.goto(`/decks?openExperience=${group.experienceId}&openCard=${group.cardIds[0]}&progressScene=1&progressPerspective=group&progressFocused=1&progressFace=back`);
      await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
      await page.waitForTimeout(2000);
      const counts: Record<string, number> = {};
      const count = (request: import("@playwright/test").Request) => {
        if (request.method() !== "GET") return;
        const url = new URL(request.url()); if (!url.pathname.startsWith("/api/")) return;
        const key = url.pathname.replace(group.experienceId, ":group").replace(/\/cards\/[^/]+\//, "/cards/:card/");
        counts[key] = (counts[key] ?? 0) + 1;
      };
      page.on("request", count);
      const card = await page.locator(".focused-card-object").elementHandle();
      const before = await page.locator(".focused-card-surface--back .back-card-media-carousel-item").count();
      await page.waitForTimeout(12000);
      page.off("request", count);
      const start = Date.now(); await save(10);
      const expected = await (await player.request.get(`/api/group-experiences/${group.experienceId}/aggregates?cardOffset=0`)).json();
      const confidence = expected.cards[0].followers.confidence;
      // Confidence is on the Card semantic anchor (both faces use that anchor).
      await expect(page.locator('.focused-card-object [aria-label="Follower confidence ' + confidence + ' out of 10"]').first()).toBeAttached({ timeout: 7000 });
      const updateMs = Date.now() - start;
      expect(await card!.evaluate(node => node.isConnected)).toBe(true);
      await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(before);
      console.log("CP4_REFRESH_MEASUREMENT", JSON.stringify({ engine, windowMs: 12000, counts, total: Object.values(counts).reduce((a, b) => a + b, 0), playerSaveToAdminObservedMs: updateMs, localFixture: true }));
    } finally { await player.close(); await context.close(); await browser.close(); }
  });
  test(`${engine}: offline resume coalesces checks and preserves the complete Card through held revalidation and return`, async ({ playwright }) => {
    const browser = await playwright[engine].launch(), context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); let release = () => {}, openRelease = () => {};
    try {
      await login(context, "phase2");
      await page.goto(`/decks?openExperience=${group.experienceId}&openCard=${group.cardIds[0]}&progressScene=1&progressPerspective=group&progressFocused=1&progressFace=back`);
      await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
      const card = await page.locator(".focused-card-object").elementHandle(), items = page.locator(".focused-card-surface--back .back-card-media-carousel-item");
      await expect(items).toHaveCount(5);
      const note = await page.locator(".focused-card-surface--back .reflection-area").textContent();
      await context.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      await page.waitForTimeout(5500); await expect(page.locator(".group-verification")).toBeVisible();
      expect(await card!.evaluate(node => node.isConnected)).toBe(true); await expect(items).toHaveCount(5);
      let refreshes = 0, checks = 0;
      const held = new Promise<void>(resolve => { release = resolve; });
      await page.route("**/refresh?*", async route => { refreshes++; const response = await route.fetch(); await held; await route.fulfill({ response }); });
      page.on("request", request => { if (new URL(request.url()).pathname === "/api/auth/me") checks++; });
      await context.setOffline(false);
      await page.evaluate(() => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("pageshow")); document.dispatchEvent(new Event("visibilitychange")); });
      await expect.poll(() => refreshes).toBe(1);
      expect(checks).toBe(1); expect(await card!.evaluate(node => node.isConnected)).toBe(true);
      await expect(items).toHaveCount(5); await expect(page.locator(".focused-card-surface--back .reflection-area")).toHaveText(note!);
      release(); await expect(page.locator(".group-verification")).toHaveCount(0);
      expect(await card!.evaluate(node => node.isConnected)).toBe(true);
      await page.getByRole("button", { name: "Close focused card", exact: true }).click({ position: { x: 10, y: 12 } }); await page.waitForTimeout(700);
      await page.getByRole("button", { name: "Back to My Decks", exact: true }).click();
      const tile = page.locator(`[data-collection-item-id="${group.experienceId}"]`); await expect(tile).toBeVisible();
      let opens = 0, composed = 0; const opening = new Promise<void>(resolve => { openRelease = resolve; });
      await page.route(`**/api/group-experiences/${group.experienceId}/open`, async route => { opens++; await opening; await route.continue(); });
      page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/preparation")) composed++; });
      await tile.locator(".deck-tile-open-action").click(); await expect(page.locator(".deck-card.is-active")).toBeVisible();
      await expect.poll(() => opens).toBe(1); expect(composed).toBe(0);
      await expect(page.locator(".deck-card.is-active .back-card-media-carousel-item")).toHaveCount(5);
      openRelease();
    } finally { release(); openRelease(); await context.unrouteAll({ behavior: "ignoreErrors" }); await context.close(); await browser.close(); }
  });

  for (const personal of [true, false]) test(`${engine}: ${personal ? "Personal" : "Group"} introduction prepares read-only while playback runs and entry joins the held read`, async ({ playwright }) => {
    assertDisposableDatabase(process.env.MONGODB_URI!, process.env.MONGODB_DB);
    const client = await new MongoClient(process.env.MONGODB_URI!).connect(), db = client.db(process.env.MONGODB_DB);
    const browser = await playwright[engine].launch(), context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); let release = () => {};
    try {
      await login(context, personal ? "Aoife Kelly" : "phase2");
      const actor = (await (await context.request.get("/api/auth/me")).json()).user.id;
      const video = { id: "cp4-introduction", assetId: "cp4-introduction", mediaType: "video", provider: "cloudflare-stream", src: "https://videodelivery.net/cp4-introduction/manifest/video.m3u8", description: "Introduction fixture", width: 640, height: 360 };
      await db.collection("deckTemplateVersions").updateOne({ deckTemplateId: group.deckId, version: 1 }, { $set: { "content.introduction": { image: null, video } } });
      await page.addInitScript(() => {
        const canPlay = HTMLMediaElement.prototype.canPlayType;
        HTMLMediaElement.prototype.canPlayType = function (type) { return /mpegurl/i.test(type) ? "probably" : canPlay.call(this, type); };
        const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src")!;
        Object.defineProperty(HTMLMediaElement.prototype, "src", { ...src, set(value: string) { src.set!.call(this, value.replace("/manifest/video.m3u8", "/fixture.webm")); } });
      });
      const bytes = await readFile("tests/fixtures/handoff-red.webm");
      await page.route("https://videodelivery.net/**", route => route.fulfill({ contentType: "video/webm", body: bytes, headers: { "Accept-Ranges": "bytes" } }));
      await page.route("**/api/library/media/stream-status?*", route => route.fulfill({ json: { status: "ready" } }));
      await page.goto("/decks"); const tile = page.locator(`[data-collection-item-id="${personal ? group.deckId : group.experienceId}"]`); await expect(tile).toBeVisible();
      const snapshot = async () => JSON.stringify({ user: await db.collection("users").findOne({ _id: new ObjectId(actor) }), member: await db.collection("groupExperienceMembers").findOne({ experienceId: group.experienceId, userId: actor }) });
      const before = await snapshot(), held = new Promise<void>(resolve => { release = resolve; });
      let preparations = 0, writes = 0;
      const url = personal ? `/api/decks-data/${group.deckId}/preparation` : `/api/group-experiences/${group.experienceId}/preparation`;
      await page.route(`**${url}*`, async route => {
        if (new URL(route.request().url()).pathname !== url || route.request().method() !== "GET") { await route.continue(); return; }
        preparations++; const response = await route.fetch(); await held; await route.fulfill({ response });
      });
      page.on("request", request => { if (request.method() === "POST" && [url, `/api/group-experiences/${group.experienceId}/open`].includes(new URL(request.url()).pathname)) writes++; });
      await tile.getByRole("button", { name: /^Play introduction for / }).click();
      await expect.poll(() => preparations).toBe(1);
      await expect.poll(() => page.locator(".deck-grid-intro-host video").evaluate((node: HTMLVideoElement) => !node.paused && node.currentTime > 0)).toBe(true);
      expect(writes).toBe(0); expect(await snapshot()).toBe(before);
      await tile.locator(".deck-tile-open-action").click();
      expect(writes).toBe(0); release();
      await expect(page.locator(".deck-card.is-active")).toBeVisible();
      await expect.poll(() => writes).toBe(1); expect(preparations).toBe(1);
      await expect(page.locator(".card-stack .deck-card")).toHaveCount(6);
      await expect.poll(snapshot).not.toBe(before);
    } finally { release(); await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); await client.close(); }
  });

  for (const personal of [false, true]) test(`${engine}: ${personal ? "Personal" : "Group"} resume retains complete content on identity-service failure and recovers`, async ({ playwright }) => {
    const browser = await playwright[engine].launch(), context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      await login(context, personal ? "Aoife Kelly" : "phase2");
      // Other scenarios deliberately persist Card navigation. Select the
      // media-rich Card explicitly instead of assuming the saved selection.
      await page.goto(`/decks?${personal ? "openDeck" : "openExperience"}=${personal ? group.deckId : group.experienceId}&openCard=${group.cardIds[0]}${personal ? "" : "&progressScene=1&progressPerspective=group"}`);
      await expect(page.locator(".deck-card.is-active")).toBeVisible();
      if (personal) {
        // The front-facing Personal stack intentionally does not subscribe its
        // hidden back to the media viewer. Exercise the actually visible back.
        await page.locator(".deck-card.is-active").press("Enter"); await page.waitForTimeout(700);
        const box = (await page.locator(".focused-card-surface--front .card-title-anchor").boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
        await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
      }
      const card = page.locator(personal ? ".focused-card-object" : ".deck-card.is-active"), original = await card.elementHandle();
      await expect(card.locator(".back-card-media-carousel-item")).toHaveCount(5);
      let checks = 0, preparationReads = 0, membershipReads = 0;
      page.on("request", request => {
        if (request.method() !== "GET") return;
        const path = new URL(request.url()).pathname;
        if (path === `/api/decks-data/${group.deckId}/preparation`) preparationReads++;
        if (path === "/api/decks-data") membershipReads++;
      });
      await page.route("**/api/auth/me", route => { checks++; return route.fulfill({ status: 503, json: { error: "Temporary session service outage" } }); });
      await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("pageshow")); });
      if (personal) await expect(page.locator(".app-shell--deck")).toHaveAttribute("data-working-ready", "false");
      else await expect(page.locator(".group-verification")).toBeVisible();
      // Personal publication Update controls retain independent protected
      // version-review reads and their actor checks. Only the shell resume
      // preparation/membership batch is coalesced by this checkpoint.
      if (personal) { expect(preparationReads).toBe(1); expect(membershipReads).toBe(1); }
      else expect(checks).toBe(1);
      expect(await original!.evaluate(node => node.isConnected)).toBe(true);
      await expect(card.locator(".back-card-media-carousel-item")).toHaveCount(5);
      await page.unroute("**/api/auth/me"); await page.evaluate(() => window.dispatchEvent(new Event("online")));
      if (personal) await expect(page.locator(".app-shell--deck")).toHaveAttribute("data-working-ready", "true");
      else await expect(page.locator(".group-verification")).toHaveCount(0);
      expect(await original!.evaluate(node => node.isConnected)).toBe(true);
    } finally { await context.close(); await browser.close(); }
  });

  for (const expiry of [false, true]) test(`${engine}: resume clears protected Group data on ${expiry ? "session expiry" : "account change"}`, async ({ playwright }) => {
    const browser = await playwright[engine].launch(), context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      await login(context, "phase2"); await page.goto(`/decks?openExperience=${group.experienceId}`);
      await expect(page.locator(".group-experience .deck-card.is-active")).toBeVisible();
      if (expiry) await context.clearCookies(); else await login(context, "Aoife Kelly");
      await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("pageshow")); });
      await expect(page.locator(".group-experience")).toHaveCount(0);
      await expect(page.locator(".focused-card-object, .card-stack")).toHaveCount(0);
    } finally { await context.close(); await browser.close(); }
  });
}
