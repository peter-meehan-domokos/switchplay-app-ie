import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import type { PreparedGroup } from "../../src/lib/groupExperiences/preparation";
const group = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null");
test.skip(!group || !process.env.PHASE7_MEDIA_REVIEW, "Requires runner-owned complete-loading media fixtures");
async function login(context: BrowserContext, identifier = "phase2") {
  expect((await context.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).ok()).toBeTruthy();
  if (process.env.PHASE2_OPTIMIZED === "1") await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
}
async function swipe(page: Page, x: number, y: number) {
  const back = await page.locator(".focused-card-object").evaluate(node => node.classList.contains("is-flipped"));
  const box = (await page.locator(`.focused-card-surface--${back ? "back" : "front"} .card-title-anchor`).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + x, box.y + box.height / 2 + y, { steps: 12 }); await page.mouse.up();
}
async function armAction(page: Page, selector: string, target: string, perspective?: string) {
  await page.evaluate(({ selector, target, perspective }) => {
    const timing = { clickAt: 0, readyAt: 0, clickEpoch: 0 };
    (window as unknown as { cp5Action: typeof timing }).cp5Action = timing;
    const clicked = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(selector)) return;
      document.removeEventListener("click", clicked, true);
      timing.clickAt = performance.now(); timing.clickEpoch = Date.now();
      const observe = () => {
        const node = document.querySelector(target), box = node?.getBoundingClientRect();
        if (node && box?.width && box.height && getComputedStyle(node).visibility !== "hidden"
          && Number(getComputedStyle(node).opacity) > 0 && (!perspective || node.getAttribute("data-perspective-key") === perspective)) timing.readyAt = performance.now();
        else requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    };
    document.addEventListener("click", clicked, true);
  }, { selector, target, perspective });
}
async function actionTiming(page: Page) {
  await page.waitForFunction(() => (window as unknown as { cp5Action: { readyAt: number } }).cp5Action.readyAt > 0);
  return page.evaluate(() => {
    const value = (window as unknown as { cp5Action: { readyAt: number; clickAt: number; clickEpoch: number } }).cp5Action;
    return { trustedClickToDomReadyMs: value.readyAt - value.clickAt, clickEpoch: value.clickEpoch };
  });
}
function complete(value: PreparedGroup) {
  expect(value.bootstrap.deck.cards).toHaveLength(6);
  for (const id of group.cardIds) {
    expect(value.contributions.media[id].items).toHaveLength(5);
    expect(value.contributions.media[id].total).toBeGreaterThanOrEqual(5);
    expect(value.contributions.reflections[id]).toBeTruthy();
    expect(value.bootstrap.group.find(card => card.cardTemplateId === id)?.items).toHaveLength(3);
    expect(value.aggregates.find(card => card.cardTemplateId === id)).toBeTruthy();
  }
}
for (const engine of ["chromium", "webkit"] as const) {
  test(`${engine}: repeated complete Group opening, retained return and prepared perspective measurement`, async ({ playwright }) => {
    const browser = await playwright[engine].launch(), context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), direct = [], reopened = [], switched = [], switchedDom = [];
    const followerReadSamples: { durationMs: number; bytes: number }[] = [];
    page.on("response", response => {
      if (!new URL(response.url()).pathname.endsWith("/preparation/followers")) return;
      void (async () => {
        await response.finished(); const bytes = (await response.body()).length;
        followerReadSamples.push({ durationMs: response.request().timing().responseEnd, bytes });
      })().catch(() => { /* A full navigation can cancel an earlier background read. */ });
    });
    const requests: { method: string; path: string }[] = [];
    page.on("request", request => { const path = new URL(request.url()).pathname; if (path.startsWith("/api/")) requests.push({ method: request.method(), path }); });
    try {
      await login(context);
      for (let i = -1; i < 3; i++) {
        requests.length = 0;
        const response = page.waitForResponse(r => new URL(r.url()).pathname === `/api/group-experiences/${group.experienceId}/preparation` && r.request().method() === "POST");
        const start = Date.now();
        await page.goto(`/decks?openExperience=${group.experienceId}&openCard=${group.cardIds[0]}&progressScene=1&progressPerspective=group`, { waitUntil: "domcontentloaded" });
        const result = await response, value = await result.json() as PreparedGroup; complete(value);
        await expect(page.locator(".deck-card.is-active")).toBeVisible(); const stackMs = Date.now() - start;
        await expect(page.locator(".group-picker-current")).toBeEnabled(); const allCardMetadataAndSceneMs = Date.now() - start;
        // The same historical DOM predicate, NOT a substitute for all-Card
        // completeness or decoded/painted images. Sampling overhead is retained.
        await page.waitForFunction(id => {
          const root = document.querySelector(".group-experience"), back = document.querySelector(".deck-card.is-active .deck-card-surface--back");
          return root?.getAttribute("data-current-card") === id && (back?.querySelectorAll(".back-card-media-carousel-item").length ?? 0) > 0 && !!back?.querySelector(".reflection-area p");
        }, group.cardIds[0], { polling: 50 });
        const currentCardPredicateMs = Date.now() - start;
        const row = { stackMs, allCardMetadataAndSceneMs, currentCardPredicateMs, bytes: (await result.body()).length, openingRequests: [...requests] };
        if (i >= 0) direct.push(row); else console.log("CP5_FIRST_OBSERVATION", JSON.stringify({ engine, ...row, coldFunctionProven: false }));
      }
      const start = Date.now();
      await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
      const entries = page.getByLabel("All followers", { exact: true }).locator("button[data-perspective-key]");
      await expect(entries).toHaveCount(group.followers.length + 1);
      const followerSurfaceReadyMs = Date.now() - start;
      const physical = await page.locator(".deck-card.is-active").elementHandle();
      let selectionPreparations = 0;
      await page.route("**/preparation*", route => { selectionPreparations++; return route.abort("failed"); });
      for (let i = 0; i < 10; i++) {
        if (i) { await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click(); }
        const id = group.followers[i % group.followers.length];
        await armAction(page, `.group-perspective-list [data-perspective-key="${id}"]`, ".group-experience", id);
        const at = Date.now();
        await page.locator(`.group-perspective-list [data-perspective-key="${id}"]`).click();
        await expect(page.locator(".group-experience")).toHaveAttribute("data-perspective-key", id);
        switched.push(Date.now() - at); switchedDom.push((await actionTiming(page)).trustedClickToDomReadyMs);
        expect(await physical!.evaluate(node => node.isConnected)).toBe(true);
      }
      expect(selectionPreparations).toBe(0);
      await page.unroute("**/preparation*");
      await page.locator(".group-picker-current").click(); await page.locator('.group-perspective-list [data-perspective-key="group"]').click();
      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: "Back to My Decks", exact: true }).click();
        const tile = page.locator(`[data-collection-item-id="${group.experienceId}"] .deck-tile-open-action`); await expect(tile).toBeVisible();
        requests.length = 0;
        const ack = page.waitForResponse(r => new URL(r.url()).pathname === `/api/group-experiences/${group.experienceId}/open`);
        await armAction(page, ".deck-tile-open-action", ".group-experience .deck-card.is-active");
        const at = Date.now(); await tile.click(); await expect(page.locator(".deck-card.is-active")).toBeVisible();
        const retainedSceneReadyMs = Date.now() - at; await ack;
        const actualOpenAckMs = Date.now() - at, observed = await actionTiming(page);
        reopened.push({ retainedSceneReadyMs, actualOpenAckMs, trustedClickToDomReadyMs: observed.trustedClickToDomReadyMs,
          automationBeforeClickMs: observed.clickEpoch - at, requests: [...requests] });
        expect(requests.filter(r => r.method === "POST" && r.path.endsWith("/preparation"))).toHaveLength(0);
      }
      console.log("CP5_LOCAL_JOURNEY", JSON.stringify({ engine, browserVersion: browser.version(), environment: "optimized local disposable; no network shaping; call durations and trusted click DOM markers separate", direct, reopened, switched, switchedDom, followerReadSamples, followerSurfaceReadyMs, selectionPreparations }));
    } finally { await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); }
  });

  for (const rich of [false, true]) test(`${engine}: twelve ${rich ? "media-rich" : "sparse"} Personal Cards navigate both ways without mounted metadata`, async ({ playwright }) => {
    assertDisposableDatabase(process.env.MONGODB_URI!, process.env.MONGODB_DB);
    const client = await new MongoClient(process.env.MONGODB_URI!).connect();
    const browser = await playwright[engine].launch(), context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), ids = [];
      for (let i = 0; i < 12; i++) {
        const root = await repo.createCardDraft(group.adminId, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: `CP5 Card ${i + 1}`, description: "Disposable navigation coverage", mediaItem: null } }, "public");
        await repo.publishCard(group.adminId, root.cardTemplateId, 0); ids.push(root.cardTemplateId);
      }
      const deck = await repo.createDeckDraft(group.adminId, { ...createDefaultDeckContent([]), title: `CP5 twelve ${rich ? "rich" : "sparse"}`, cards: ids.map(cardTemplateId => ({ cardTemplateId })) }, "public");
      await repo.publishDeck(group.adminId, deck.deckTemplateId, 0); await repo.ensureDeckData(group.otherId, deck.deckTemplateId, 1);
      const owner = await repo.users().findOne({ _id: new ObjectId(group.adminId) } as never);
      // Reuse existing local provider bytes; only disposable metadata is added.
      const photo = owner!.cardsData.flatMap(card => card.mediaItems ?? []).find(item => item.mediaType === "image"); expect(photo).toBeTruthy();
      for (const [i, id] of ids.entries()) await repo.users().updateOne({ _id: new ObjectId(group.otherId) } as never, { $set: {
        "cardsData.$[card].mediaItems": rich ? Array.from({ length: 5 }, (_, n) => ({ ...photo!, id: randomUUID(), description: `Preview ${n}`, uploadedAt: new Date(1700000000000 + n).toISOString() })) : [],
        "cardsData.$[card].reflection": rich ? `Complete reflection ${i + 1}` : "",
      } }, { arrayFilters: [{ "card.cardTemplateId": id }] });
      await login(context, "Aoife Kelly");
      const response = page.waitForResponse(r => r.url().includes(`/decks-data/${deck.deckTemplateId}/preparation`) && r.request().method() === "POST");
      await page.goto(`/decks?openDeck=${deck.deckTemplateId}`);
      const value = await (await response).json(); expect(value.deck.cards).toHaveLength(12);
      for (const id of ids) { expect(value.contributions.media[id].items).toHaveLength(rich ? 5 : 0); expect(value.contributions.media[id].total).toBe(rich ? 5 : 0); expect(value.contributions.reflections[id]).toBeTruthy(); }
      await expect(page.locator(".deck-card.is-active")).toBeVisible();
      let mountedMetadata = 0;
      await page.route(/\/api\/(reflections\?|media\/history\?)/, route => { mountedMetadata++; return route.abort("failed"); });
      await page.locator(".deck-card.is-active").press("Enter"); await page.waitForTimeout(700); await swipe(page, 180, 0);
      const sequence = [...Array.from({ length: 12 }, (_, i) => i), ...Array.from({ length: 11 }, (_, i) => 10 - i)];
      for (const [position, index] of sequence.entries()) {
        // Existing traversal intentionally keeps departing and incoming Cards
        // together. Assert the settled single target before reading its face.
        await expect(page.locator(".focused-card-surface--back .card-title-anchor h2")).toHaveCount(1);
        await expect(page.locator(".focused-card-surface--back .card-title-anchor h2")).toHaveText(`Card ${index + 1}`);
        await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(rich ? 5 : 0);
        await expect(page.locator(".focused-card-surface--back .reflection-area")).toContainText(rich ? `Complete reflection ${index + 1}` : "Add a reflection");
        if (position < sequence.length - 1) { await page.waitForTimeout(700); await swipe(page, 0, sequence[position + 1] > index ? 170 : -170); }
      }
      expect(mountedMetadata).toBe(0);
    } finally { await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); await client.close(); }
  });
}

test("chromium: controlled 4G-like opening preserves complete six-Card navigation", async ({ playwright }) => {
  const browser = await playwright.chromium.launch(), context = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), cdp = await context.newCDPSession(page), samples = [];
  const profile = { urlPattern: "", latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 };
  try {
    await login(context); await cdp.send("Network.enable");
    for (let i = 0; i < 3; i++) {
      // Full navigation resets browser-memory resources. Tiles are usable
      // before timing; this measures in-app unprepared opening, not JS login.
      await page.goto("/decks");
      const tile = page.locator(`[data-collection-item-id="${group.experienceId}"] .deck-tile-open-action`); await expect(tile).toBeVisible();
      await cdp.send("Network.emulateNetworkConditionsByRule", { offline: false, matchedNetworkConditions: [profile] });
      const response = page.waitForResponse(r => new URL(r.url()).pathname === `/api/group-experiences/${group.experienceId}/preparation` && r.request().method() === "POST");
      await armAction(page, ".deck-tile-open-action", ".group-experience .deck-card.is-active");
      const start = Date.now(); await tile.click(); const result = await response; complete(await result.json());
      await expect(page.locator(".deck-card.is-active")).toBeVisible(); await expect(page.locator(".group-picker-current")).toBeEnabled();
      const completeMs = Date.now() - start, observed = await actionTiming(page);
      samples.push({ completeMs, trustedClickToDomReadyMs: observed.trustedClickToDomReadyMs,
        automationBeforeClickMs: observed.clickEpoch - start, bytes: (await result.body()).length });
    }
    let mountedReads = 0;
    await page.route(/\/api\/(reflections\?|media\/history\?|group-experiences\/[^/]+\/cards\/[^/]+\/media\?)/, route => { mountedReads++; return route.abort("failed"); });
    await page.locator(".deck-card.is-active").press("Enter"); await page.waitForTimeout(700); await swipe(page, 180, 0);
    const scene = page.locator(".group-experience"), sequence = [...Array.from({ length: 6 }, (_, i) => i), ...Array.from({ length: 5 }, (_, i) => 4 - i)];
    for (const [position, index] of sequence.entries()) {
      await expect(scene).toHaveAttribute("data-current-card", group.cardIds[index]);
      await expect(page.locator(".focused-card-surface--back .back-card-media-carousel-item")).toHaveCount(5);
      await expect(page.locator(".focused-card-surface--back .reflection-area")).toContainText(`Collective reflection for Card ${index + 1}`);
      if (position < sequence.length - 1) { await page.waitForTimeout(700); await swipe(page, 0, sequence[position + 1] > index ? 170 : -170); }
    }
    expect(mountedReads).toBe(0);
    console.log("CP5_CONTROLLED_NETWORK", JSON.stringify({ engine: "chromium", environment: "local optimized disposable; in-app unprepared entry", profile, samples, completeCards: 6, traversalSelections: sequence.length, mountedReads, physicalNetwork: false }));
  } finally { await context.unrouteAll({ behavior: "ignoreErrors" }); await browser.close(); }
});

for (const engine of ["chromium", "webkit"] as const) test(`${engine}: follower progress reaches the active Admin F summary`, async ({ playwright }) => {
  const browser = await playwright[engine].launch(), admin = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const player = await browser.newContext({ baseURL: process.env.PHASE2_BASE_URL }), samples = [];
  const page = await admin.newPage();
  try {
    await login(admin); await login(player, "Aoife Kelly");
    const base = `/api/group-experiences/${group.experienceId}`, metadata = await (await player.request.get(base)).json();
    const save = async (completionStatus: "todo" | "done") => expect((await player.request.patch(`${base}/cards/${group.cardIds[0]}/personal-learning`, {
      data: { version: 1, accessEpoch: metadata.accessEpoch, change: { kind: "completion", stepId: "group-0-a", completionStatus } },
    })).ok()).toBeTruthy();
    await save("todo");
    await page.goto(`/decks?openExperience=${group.experienceId}&openCard=${group.cardIds[0]}&progressScene=1&progressPerspective=group&progressFocused=1&progressFace=back`);
    await expect(page.locator(".focused-card-object")).toHaveClass(/is-flipped/);
    const physical = await page.locator(".focused-card-object").elementHandle();
    for (const value of ["done", "todo", "done"] as const) {
      const at = Date.now(); await save(value); const saveAckMs = Date.now() - at;
      const aggregate = await (await player.request.get(`${base}/aggregates?cardOffset=0`)).json();
      const expected = aggregate.cards[0].steps[0].followers;
      await expect(page.locator(`.focused-card-surface--back .group-step-counts[aria-label="${expected.doing} doing, ${expected.done} done"]`)).toHaveCount(1, { timeout: 7000 });
      samples.push({ completionStatus: value, saveAckMs, adminObservedMs: Date.now() - at, doing: expected.doing, done: expected.done });
      expect(await physical!.evaluate(node => node.isConnected)).toBe(true);
    }
    console.log("CP5_PROGRESS_LATENCY", JSON.stringify({ engine, environment: "optimized local disposable; independent player and Admin sessions", samples }));
  } finally { await player.close(); await browser.close(); }
});
