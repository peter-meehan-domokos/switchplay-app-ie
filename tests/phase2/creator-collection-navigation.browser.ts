import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client.close(); });
const db = () => client.db(process.env.MONGODB_DB!);
const actor = () => process.env.PHASE2_USER_ID!;
async function login(page: Page, username = "phase2") {
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).ok()).toBeTruthy();
}
async function title(page: Page, value: string) {
  await page.getByRole("button", { name: "Edit deck title and introduction" }).click();
  await page.locator(".creator-modal textarea").fill(value); await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
}
async function seedDeck(visibility: "public" | "private", owner = actor()) {
  const repo = new CardRepository(db(), client), root = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: `Deck ${randomUUID()}` }, visibility);
  await repo.publishDeck(owner, root.deckTemplateId, 0); return root.deckTemplateId;
}

test("new Deck return follows visibility intent and reload, warns about unpublished drafts and never opens working content", async ({ page }) => {
  await login(page); await page.goto("/creator/new");
  const back = page.locator(".creator-back-link"); await expect(back).toHaveText("My Decks");
  await title(page, `New ${randomUUID()}`);
  await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public");
  await expect(back).toHaveText("Library");
  await expect.poll(async () => (await (await page.request.get(`/api/deck-templates/${new URL(page.url()).pathname.split("/").at(-1)}`)).json()).root?.draftVisibility).toBe("public");
  await page.reload(); await expect(back).toHaveText("Library");
  await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("private"); await expect(back).toHaveText("My Decks");
  await back.click(); const leave = page.getByRole("dialog", { name: "Leave Creator confirmation" });
  await expect(leave).toContainText("saved in My Drafts"); await leave.getByRole("button", { name: "Cancel", exact: true }).click();
  let workingOpens = 0; page.on("request", request => { if (new URL(request.url()).pathname === "/api/decks-data" && request.method() === "POST") workingOpens++; });
  await back.click(); await leave.getByRole("button", { name: "Leave without publishing", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/); await expect(page.getByRole("heading", { name: "My Decks", exact: true })).toBeVisible(); expect(workingOpens).toBe(0);
});

test("existing Deck origins stay collection-based through reload and visibility changes", async ({ page }) => {
  await login(page); const privateId = await seedDeck("private"), publicId = await seedDeck("public");
  await page.goto(`/creator/edit/${privateId}?returnTo=deck&returnDeckId=${privateId}`);
  await page.getByRole("combobox", { name: "Deck publication visibility" }).selectOption("public");
  await expect(page.locator(".creator-back-link")).toHaveText("My Decks");
  await expect.poll(async () => (await (await page.request.get(`/api/deck-templates/${privateId}`)).json()).root?.draftVisibility).toBe("public");
  await page.reload(); await expect(page.locator(".creator-back-link")).toHaveText("My Decks");
  await page.goto(`/creator/edit/${publicId}?returnTo=library&returnDeckId=${publicId}`);
  await expect(page.locator(".creator-back-link")).toHaveText("Library");
  let opens = 0; page.on("request", request => { if (new URL(request.url()).pathname === "/api/decks-data" && request.method() === "POST") opens++; });
  await page.locator(".creator-back-link").click(); await expect(page).toHaveURL("/library");
  await expect(page.locator(".deck-detail h1")).toHaveCount(0); expect(opens).toBe(0);
  await page.goto(`/creator/edit/${publicId}`); await expect(page.locator(".creator-back-link")).toHaveText("Library");
});

test("Library-origin private copy returns to My Decks using its resulting ID", async ({ page }) => {
  const other = (await db().collection("users").findOne({ username: "other" }))!._id.toString();
  const source = await seedDeck("public", other); await login(page);
  await page.goto(`/creator/edit/${source}?returnTo=library&returnDeckId=${source}`);
  await page.getByRole("dialog", { name: "Edit your own Deck" }).getByRole("button", { name: "Continue editing" }).click();
  await title(page, "My private copy");
  await expect(page.locator(".creator-back-link")).toHaveText("My Decks");
  const copied = new URL(page.url()).pathname.split("/").at(-1)!; expect(copied).not.toBe(source);
  await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish Deck", exact: true })).toHaveText("Published");
  await page.locator(".creator-back-link").click(); await expect(page).toHaveURL(`/decks?reveal=${copied}`);
  await expect(page.locator(`[data-collection-item-id="${copied}"]`)).toBeVisible();
  await expect(page.locator(".deck-detail h1")).toHaveCount(0);
});

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
type FrameWindow = typeof window & { collectionFrames: string[][]; collectionScrolls: number };
async function observePaints(page: Page) {
  await page.addInitScript(() => {
    const observed = window as FrameWindow; observed.collectionFrames = []; observed.collectionScrolls = 0;
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) { observed.collectionScrolls++; return original.apply(this, args); };
    const frame = () => {
      if (location.pathname === "/library") {
        const ids = [...document.querySelectorAll<HTMLElement>("[data-collection-item-id]")].filter(node => node.getClientRects().length).map(node => node.dataset.collectionItemId!);
        if (ids.length) observed.collectionFrames.push(ids);
      }
      requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
  });
}
async function seedInfo() {
  const repo = new InfoCardRepository(db(), client), id = randomUUID();
  await repo.create(actor(), id);
  await repo.save(actor(), id, 0, { seriesId: "demo-series-owner", title: "Old note", body: "Keep the sign.", mediaItem: null }, "private");
  await repo.publish(actor(), id, 1); return id;
}
for (const kind of ["deck", "info"] as const) {
  const path = kind === "deck" ? "/library" : "/library?tab=info-cards";
  const api = kind === "deck" ? "/api/library/decks" : "/api/library/info-cards";
  const editor = (id: string) => kind === "deck" ? `/creator/edit/${id}?returnTo=library&returnDeckId=${id}` : `/creator/info-cards/${id}`;
  const back = (page: Page) => kind === "deck" ? page.locator(".creator-back-link") : page.getByRole("button", { name: "Library", exact: true });
  const publish = (page: Page) => page.getByRole("button", { name: kind === "deck" ? "Publish Deck" : "Publish", exact: true });
  const edit = async (page: Page) => { if (kind === "deck") await title(page, "Republished programme"); else await page.getByRole("textbox", { name: "Title", exact: true }).fill("Republished note"); };

  test(`${kind}: confirmed republication returns by SPA, settles in publication order, and highlight never scrolls`, async ({ page }) => {
    await login(page); await page.setViewportSize({ width: 390, height: 844 }); await observePaints(page);
    const id = kind === "deck" ? await seedDeck("public") : await seedInfo();
    const versions = kind === "deck" ? new CardRepository(db(), client).deckVersions() : new InfoCardRepository(db(), client).versions();
    await versions.updateOne(kind === "deck" ? { deckTemplateId: id } : { infoCardId: id }, { $set: { publishedAt: new Date("2000-01-01") } });
    if (kind === "deck") await seedDeck("public");
    const stale = await (await page.request.get(api)).json();
    await page.goto(path); await expect(page.locator("[data-collection-item-id]").first()).not.toHaveAttribute("data-collection-item-id", id);
    const oldRead = deferred(), oldStarted = deferred(), oldFinished = deferred();
    let heldOldRead = false;
    await page.route(`**${api}*`, async route => {
      // Hold only the pre-navigation read. The newly mounted SPA Library must
      // still be able to make its own ordinary initial request.
      if (heldOldRead) { await route.continue(); return; }
      heldOldRead = true; oldStarted.resolve(); await oldRead.promise;
      try { await route.fulfill({ json: stale }); } catch { /* the old mounted read was cancelled */ } finally { oldFinished.resolve(); }
    });
    if (kind === "deck") { await page.clock.install(); await page.clock.fastForward(61_000); }
    else await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await oldStarted.promise;
    await page.goto(editor(id)); await edit(page);
    const receipt = deferred(), receiptStarted = deferred(); let attempts = 0;
    const endpoint = kind === "deck" ? `/api/deck-templates/${id}/publish` : `/api/info-cards/${id}/publish`;
    await page.route(`**${endpoint}*`, async route => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      if (++attempts === 1) { await route.fulfill({ status: 422, json: { error: "PUBLICATION_REJECTED", code: "PUBLICATION_REJECTED" } }); return; }
      const response = await route.fetch(); expect(response.ok()).toBeTruthy(); receiptStarted.resolve(); await receipt.promise; await route.fulfill({ response });
    });
    await publish(page).click(); await expect.poll(() => attempts).toBe(1); await expect(publish(page)).toBeEnabled();
    await expect(back(page)).not.toHaveAttribute("href", /published=/);
    await publish(page).click(); await receiptStarted.promise;
    if (kind === "deck") await back(page).click(); else await expect(back(page)).toBeDisabled();
    expect(new URL(page.url()).pathname).toContain("/creator/");
    receipt.resolve();
    await expect(page.getByRole("button", { name: kind === "deck" ? "Publish Deck" : "Published", exact: true })).toHaveText("Published");
    const destination = `${path}${kind === "deck" ? "?" : "&"}published=${id}`;
    await page.evaluate(() => { (window as FrameWindow).collectionFrames = []; });
    const documentTime = await page.evaluate(() => performance.timeOrigin);
    await back(page).click(); await expect(page).toHaveURL(destination);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentTime);
    const item = page.locator(`[data-collection-item-id="${id}"]`);
    await expect(page.locator("[data-collection-item-id]").first()).toHaveAttribute("data-collection-item-id", id);
    await expect(item).toHaveAttribute("data-return-highlight", "true");
    oldRead.resolve(); await oldFinished.promise;
    await expect.poll(() => page.evaluate(() => (window as FrameWindow).collectionFrames.length)).toBeGreaterThan(5);
    expect(await page.evaluate(() => ({ scrolls: (window as FrameWindow).collectionScrolls, y: scrollY }))).toEqual({ scrolls: 0, y: 0 });
    await expect(page.getByRole("button", { name: /Show newest/ })).toHaveCount(0);
    await expect(item).not.toHaveAttribute("data-return-highlight", "true", { timeout: 4000 });
  });

  test(`${kind}: draft-only return starts at the ordinary collection top with no highlight, scroll or promotion`, async ({ page }) => {
    await login(page); await observePaints(page);
    const id = kind === "deck" ? await seedDeck("public") : await seedInfo();
    const versions = kind === "deck" ? new CardRepository(db(), client).deckVersions() : new InfoCardRepository(db(), client).versions();
    await versions.updateOne(kind === "deck" ? { deckTemplateId: id } : { infoCardId: id }, { $set: { publishedAt: new Date("2000-01-01") } });
    if (kind === "deck") await seedDeck("public");
    const before = await (await page.request.get(api)).json();
    await page.goto(path); await page.goto(editor(id)); await edit(page); await back(page).click();
    if (kind === "deck") await page.getByRole("button", { name: "Leave without publishing", exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.locator("[data-collection-item-id]").first()).not.toHaveAttribute("data-collection-item-id", id);
    expect(await (await page.request.get(api)).json()).toEqual(before);
    await expect(page.locator("[data-return-highlight]")).toHaveCount(0);
    expect(await page.evaluate(() => ({ scrolls: (window as FrameWindow).collectionScrolls, y: scrollY }))).toEqual({ scrolls: 0, y: 0 });
    await expect(page.getByRole("button", { name: /Show newest/ })).toHaveCount(0);
  });

  test(`${kind}: returning after an account change uses the actual authenticated session, not a cached catalogue`, async ({ page }) => {
    await login(page); await page.goto(path);
    const id = kind === "deck" ? await seedDeck("public") : "demo-owner-private";
    await page.goto(editor(id)); await edit(page); await publish(page).click();
    await expect(page.getByRole("button", { name: kind === "deck" ? "Publish Deck" : "Published", exact: true })).toHaveText("Published");
    await login(page, "other"); await back(page).click();
    await expect(page).toHaveURL(`${path}${kind === "deck" ? "?" : "&"}published=${id}`); await expect(page.locator(".eyebrow")).toHaveText("other");
    await expect(page.locator('[data-info-id="demo-owner-private"]')).toHaveCount(0);
    if (kind === "info") await expect(page.locator('[data-info-id="demo-other-private"]')).toBeVisible();
    await expect(page.locator("[data-return-highlight]")).toHaveCount(0);
  });
}
test("removed Library reveal query contracts reject requests rather than seeking hidden content", async ({ page }) => {
  await login(page);
  for (const path of ["/api/library/decks?reveal=absent", "/api/library/info-cards?reveal=demo-other-private"]) expect((await page.request.get(path)).status()).toBe(400);
});
