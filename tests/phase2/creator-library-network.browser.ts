import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

// Observation-only network harness: deliberately does NOT assert perfect first
// paint or change application navigation/fetching to obtain a desired result.
type Sample = { ms: number; phase: string; ids: string[]; targetY: number | null; highlight: boolean; scrollY: number };
type ReviewWindow = typeof window & { networkReview: { start: number; target: string; marker: string; samples: Sample[]; stop: boolean } };
let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client.close(); });
const pause = (ms: number) => new Promise<void>(done => setTimeout(done, ms));

for (const kind of ["deck", "info"] as const) for (const action of ["new", "republish", "draft"] as const) for (const network of ["normal", "slow-mobile", "delayed-data"] as const) {
  test(`${kind} ${action} ${network}: observe ordinary Creator to Library navigation`, async ({ page, context }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).ok()).toBeTruthy();
    const actor = process.env.PHASE2_USER_ID!, db = client.db(process.env.MONGODB_DB!), cards = new CardRepository(db, client), notes = new InfoCardRepository(db, client);
    const path = kind === "deck" ? "/library" : "/library?tab=info-cards", api = kind === "deck" ? "/api/library/decks" : "/api/library/info-cards";
    let id: string = randomUUID();
    if (kind === "deck" && action !== "new") {
      id = (await cards.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Reference programme" }, "public")).deckTemplateId;
      await cards.publishDeck(actor, id, 0);
      await cards.deckVersions().updateOne({ deckTemplateId: id }, { $set: { publishedAt: new Date("2000-01-01") } });
      const peer = await cards.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Newer programme" }, "public");
      await cards.publishDeck(actor, peer.deckTemplateId, 0);
    } else if (kind === "info" && action !== "new") {
      await notes.create(actor, id);
      await notes.save(actor, id, 0, { seriesId: "demo-series-owner", title: "Reference", body: "Keep the sign attached.", mediaItem: null }, "private");
      await notes.publish(actor, id, 1);
      await notes.versions().updateOne({ infoCardId: id }, { $set: { publishedAt: new Date("2000-01-01") } });
      const peer = randomUUID(); await notes.create(actor, peer);
      await notes.save(actor, peer, 0, { seriesId: "demo-series-owner", title: "Newer note", body: "Check each step.", mediaItem: null }, "private"); await notes.publish(actor, peer, 1);
    }
    // Enter Creator through the actual application links, keeping the Library's
    // router state in the same document. A hard editor goto would miss cached
    // route/component restoration during the return we are investigating.
    await page.goto(path); await expect(page.locator("[data-collection-item-id]").first()).toBeVisible();
    const entryDocumentTime = await page.evaluate(() => performance.timeOrigin);
    if (action === "new") {
      await page.getByRole("button", { name: "Overview menu", exact: true }).click();
      await page.getByRole("menuitem", { name: "Create", exact: true }).click();
      if (kind === "info") {
        await page.getByRole("combobox", { name: "Creator mode" }).selectOption("info-card");
        await page.getByRole("combobox", { name: "Series", exact: true }).selectOption({ label: "Basics (phase2)" });
        await page.getByRole("textbox", { name: "Title", exact: true }).fill("Reference");
        await page.getByRole("textbox", { name: "Explanation", exact: true }).fill("Keep the sign attached.");
      } else await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public");
      await expect(page).toHaveURL(kind === "deck" ? /\/creator\/edit\// : /\/creator\/info-cards\/[a-f\d-]+/);
      id = new URL(page.url()).pathname.split("/").at(-1)!;
    } else {
      const row = page.locator(`[data-collection-item-id="${id}"]`);
      while (!await row.count()) {
        const more = page.getByRole("button", { name: kind === "deck" ? "More Decks" : "More Info Cards", exact: true });
        if (!await more.count()) { await expect(row).toBeVisible(); break; }
        await more.click();
        // Wait for the page to settle before deciding whether another page is
        // needed. The last response may remove More while revealing the row.
        await expect.poll(async () => !!await row.count() || !await more.count() || await more.isEnabled()).toBe(true);
      }
      if (kind === "info") await row.getByRole("link", { name: /^Edit / }).click();
      else {
        await row.locator(".deck-tile-open-action").click();
        await page.getByRole("button", { name: "Deck menu", exact: true }).click();
        await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
      }
    }
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(entryDocumentTime);
    const updatedTitle = kind === "deck" ? "Updated programme" : "Updated note";
    if (kind === "deck") {
      await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
      await page.locator(".creator-modal textarea").fill(updatedTitle); await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
    } else await page.getByRole("textbox", { name: "Title", exact: true }).fill(updatedTitle);

    const cdp = await context.newCDPSession(page);
    if (network === "slow-mobile") await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, connectionType: "cellular4g" });
    const dataRequests: { url: string; startMs: number; delayMs: number }[] = [];
    let begin = Date.now();
    if (network === "delayed-data") await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      const data = kind === "info" ? url.pathname === api : url.pathname === "/library" && request.headers().rsc === "1";
      if (data) { dataRequests.push({ url: url.pathname, startMs: Date.now() - begin, delayMs: 1500 }); await pause(1500); }
      await route.continue();
    });
    if (action !== "draft") {
      const published = kind === "deck" ? page.getByRole("button", { name: "Publish Deck", exact: true }) : page.getByRole("button", { name: "Publish", exact: true });
      await expect(published).toBeEnabled(); await published.click();
      if (kind === "deck" && action === "new") await page.getByRole("dialog", { name: "Confirm public publication" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
      await expect(page.getByRole("button", { name: kind === "deck" ? "Publish Deck" : "Published", exact: true })).toHaveText("Published");
    }
    const canonical = await (await page.request.get(api)).json();
    const expected: string[] = kind === "deck" ? canonical.entries.map((item: { deckTemplateId: string }) => item.deckTemplateId) : canonical.items.map((item: { infoCardId: string }) => item.infoCardId);
    if (action !== "draft") expect(expected[0]).toBe(id);
    const marker = randomUUID();
    await page.evaluate(({ target, marker }) => {
      const view = window as ReviewWindow;
      view.networkReview = { start: performance.now(), target, marker, samples: [], stop: false };
      const visible = (node: Element) => node.getClientRects().length > 0 && !node.closest("[inert], [aria-hidden=true]") && getComputedStyle(node).visibility !== "hidden";
      const sample = () => {
        const state = view.networkReview; if (state.stop) return;
        const rows = [...document.querySelectorAll<HTMLElement>(".library-shell [data-collection-item-id]")].filter(visible);
        const ids = rows.map(node => node.dataset.collectionItemId!);
        const headings = [...document.querySelectorAll("h1")].filter(visible).map(node => node.textContent ?? "");
        const loading = [...document.querySelectorAll("[role=status]")].some(node => visible(node) && /^Loading (Library|Info Cards)/.test(node.textContent ?? ""));
        const creator = [...document.querySelectorAll(".creator-lab")].some(visible) || headings.some(text => /^(New|Edit) Info Card$/.test(text));
        const phase = ids.length ? "collection" : loading ? "loading" : creator ? "creator" : headings.includes("Library") ? "library-chrome" : "blank";
        const target = rows.find(node => node.dataset.collectionItemId === state.target);
        state.samples.push({ ms: Math.round(performance.now() - state.start), phase, ids, targetY: target?.getBoundingClientRect().top ?? null, highlight: target?.dataset.returnHighlight === "true", scrollY });
        requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    }, { target: id, marker });
    let documentRequests = 0; page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests++; });
    begin = Date.now(); const documentTime = await page.evaluate(() => performance.timeOrigin);
    const back = kind === "deck" ? page.locator(".creator-back-link") : page.getByRole("button", { name: "Library", exact: true });
    const captures: { file: string; ms: number }[] = [];
    const capture = async (name: string) => { const file = `${name}.png`; await page.screenshot({ path: info.outputPath(file) }); captures.push({ file, ms: Date.now() - begin }); };
    await capture("00-initiation");
    const leaving = back.click();
    if (kind === "deck" && action === "draft") await page.getByRole("button", { name: "Leave without publishing", exact: true }).click();
    const milestones = [250, 1000, 2000, 4000, ...(network === "slow-mobile" ? [6000] : [])];
    for (const ms of milestones) { await pause(Math.max(0, ms - (Date.now() - begin))); await capture(`frame-${ms}`); }
    await leaving;
    await expect(page).toHaveURL(action === "draft" ? path : `${path}${kind === "deck" ? "?" : "&"}published=${id}`);
    // Observe settling, but do not repair/assert first-paint order. A stale or
    // unsettled client view is evidence to report, not permission for a fix.
    const deadline = begin + 15_000;
    while (Date.now() < deadline) {
      const ids = await page.locator(".library-shell [data-collection-item-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-collection-item-id")));
      if (JSON.stringify(ids) === JSON.stringify(expected)) break;
      await pause(200);
    }
    await capture("99-final");
    const state = await page.evaluate(() => { const state = (window as ReviewWindow).networkReview; state.stop = true; return state; });
    expect(state.marker).toBe(marker); expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentTime); expect(documentRequests).toBe(0);
    const collection = state.samples.filter(sample => sample.phase === "collection");
    const matches = (ids: string[]) => JSON.stringify(ids) === JSON.stringify(expected);
    const firstCorrect = collection.find(sample => matches(sample.ids));
    const phases = state.samples.filter((sample, index, all) => index === 0 || sample.phase !== all[index - 1].phase);
    const orders = collection.filter((sample, index, all) => index === 0 || JSON.stringify(sample.ids) !== JSON.stringify(all[index - 1].ids));
    const result = { kind, action, network, profile: network === "slow-mobile" ? { latencyMs: 400, downloadBitsPerSecond: 1_600_000, uploadBitsPerSecond: 750_000 } : network === "delayed-data" ? { libraryDataDelayMs: 1500 } : "unthrottled local dev",
      durationMs: Date.now() - begin, documentRequests, expected, firstCollectionMs: collection[0]?.ms ?? null, firstCorrectMs: firstCorrect?.ms ?? null,
      staleDisplayed: collection.some(sample => !matches(sample.ids)), orderChanges: orders.length ? orders.length - 1 : 0,
      finalCorrect: collection.length > 0 && matches(collection.at(-1)!.ids), phases, orders, captures, dataRequests, samples: state.samples };
    await writeFile(info.outputPath("observations.json"), JSON.stringify(result, null, 2));
    console.log(`NETWORK_REVIEW ${JSON.stringify({ kind, action, network, firstCollectionMs: result.firstCollectionMs, firstCorrectMs: result.firstCorrectMs, staleDisplayed: result.staleDisplayed, orderChanges: result.orderChanges, finalCorrect: result.finalCorrect, phases: phases.map(({ ms, phase }) => ({ ms, phase })) })}`);
    await cdp.detach();
  });
}
