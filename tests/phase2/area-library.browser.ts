import { expect, test, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { cardFixture, deckFixture } from "../fixtures/frameworks";
import { itemFixtureRoutes } from "./helpers/assessmentFixtureRoutes";
import { geometry } from "./helpers/presentationGeometry";
import type { Framework } from "../../src/lib/frameworks/configuration";

async function fixture(page: Page) {
  assertDisposableDatabase();
  const client = await new MongoClient(process.env.MONGODB_URI!).connect(), repo = new CardRepository(client.db(process.env.MONGODB_DB!), client);
  const actor = new ObjectId(), owner = new ObjectId(), username = `area-library-${randomUUID()}`;
  const original = cardFixture(randomUUID()), fork = cardFixture(randomUUID(), original.root.cardTemplateId),
    nested = cardFixture(randomUUID(), fork.root.cardTemplateId), second = cardFixture(randomUUID()), unrelated = cardFixture(randomUUID());
  const cards = [original, fork, nested, second, unrelated];
  for (const card of cards) { card.root.ownerUserId = owner.toHexString(); card.root.visibility = card.version.visibility = "public"; }
  original.data.items[0].completionStatus = "done"; original.data.signalReadings[0].reading = 8;
  const currentCard = structuredClone(original.version); currentCard.version = 2; currentCard.content.intro.title = "Public algebra Card v2"; original.root.latestVersion = 2;
  const active = deckFixture(randomUUID(), [original.root.cardTemplateId, fork.root.cardTemplateId]);
  const archived = deckFixture(randomUUID(), [nested.root.cardTemplateId], true);
  const fresh = deckFixture(randomUUID(), [original.root.cardTemplateId, fork.root.cardTemplateId, nested.root.cardTemplateId, second.root.cardTemplateId]);
  const decks = [active, archived, fresh];
  for (const [index, deck] of decks.entries()) {
    deck.root.ownerUserId = owner.toHexString(); deck.root.visibility = deck.version.visibility = "public";
    deck.version.content.title = deck.root.draft!.title = ["Working Algebra", "Archived Algebra", "New Algebra"][index];
  }
  active.data.activeCardId = fork.root.cardTemplateId;
  const published = structuredClone(active.version); published.version = 2; published.content.title = "Public Algebra";
  published.content.cards.push({ cardTemplateId: second.root.cardTemplateId, cardVersionAtPublish: 1 }); active.root.latestVersion = 2;
  const filler = Array.from({ length: 25 }, (_, index) => {
    const deck = deckFixture(randomUUID(), [unrelated.root.cardTemplateId]);
    deck.root.ownerUserId = owner.toHexString(); deck.root.visibility = deck.version.visibility = "public";
    deck.version.content.title = `Unrelated public ${index}`; deck.version.publishedAt = new Date("2026-10-12T14:00:00Z"); return deck;
  });
  const privateDeck = deckFixture(randomUUID(), [original.root.cardTemplateId]); privateDeck.root.ownerUserId = owner.toHexString();
  await repo.cards().insertMany(cards.map((card) => card.root));
  await repo.cardVersions().insertMany([...cards.map((card) => card.version), currentCard]);
  await repo.decks().insertMany([...decks, ...filler, privateDeck].map((deck) => deck.root));
  await repo.deckVersions().insertMany([...decks, ...filler, privateDeck].map((deck) => deck.version).concat(published));
  const users = [{ _id: actor, username, email: `${username}@example.invalid`, passwordHash: hashSync("local-test-only", 4),
    cardsData: cards.map((card) => card.data), decksData: [active.data, archived.data], itemTests: [], itemTestsRevision: 0, createdAt: new Date(), updatedAt: new Date() },
    { _id: owner, username: "Maths mentor", decksData: [], cardsData: [{ ...structuredClone(original.data), tests: [{ id: randomUUID(), date: "2026-10-12", result: false, createdAt: new Date() }], reflection: "PRIVATE CREATOR REFLECTION" }] }];
  await repo.users().insertMany(users);
  const frameworks: Framework[] = [{ id: "library-maths", title: "Library Maths", areas: [{ id: "algebra", title: "Algebra", items: [
    { id: "library-equations", title: "Equations", cardTemplateIds: [original.root.cardTemplateId, second.root.cardTemplateId] },
  ] }, { id: "empty", title: "Empty Area", items: [] }, ...Array.from({ length: 12 }, (_, index) => ({ id: `extra-${index}`, title: `Additional Area ${index}`, items: [{ id: `library-extra-${index}`, title: "Additional goal", cardTemplateIds: [] }] }))] }];
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).status()).toBe(200);
  await itemFixtureRoutes(page, repo, actor.toHexString(), frameworks);
  return { client, repo, actor: actor.toHexString(), active, archived, fresh, original, published, owner };
}
const dialog = (page: Page) => page.getByRole("dialog", { name: "Algebra", exact: true });
const library = (page: Page) => dialog(page).locator("#area-decks-library");
async function show(page: Page) {
  await page.goto("/progress"); await page.locator('tr[data-area-id="algebra"] .progress-content-title').click();
  const toggle = dialog(page).getByRole("button", { name: /^Library/ });
  await expect(toggle.locator("span").first()).toHaveText("1");
  await expect(toggle).toHaveAttribute("aria-expanded", "false"); await toggle.click();
}
async function dispose(page: Page, f: Awaited<ReturnType<typeof fixture>>) {
  await page.unrouteAll({ behavior: "wait" });
  // Public discovery intentionally sees every creator. Remove only this fixture's
  // own canonical records so deliberate corruption cannot contaminate later tests.
  const deckIds = (await f.repo.decks().find({ ownerUserId: f.owner.toHexString() }, { projection: { deckTemplateId: 1 } }).toArray()).map((deck) => deck.deckTemplateId);
  const cardIds = (await f.repo.cards().find({ ownerUserId: f.owner.toHexString() }, { projection: { cardTemplateId: 1 } }).toArray()).map((card) => card.cardTemplateId);
  await f.repo.deckVersions().deleteMany({ deckTemplateId: { $in: deckIds } });
  await f.repo.decks().deleteMany({ deckTemplateId: { $in: deckIds } });
  await f.repo.cardVersions().deleteMany({ cardTemplateId: { $in: cardIds } });
  await f.repo.cards().deleteMany({ cardTemplateId: { $in: cardIds } });
  await f.repo.users().deleteMany({ _id: { $in: [new ObjectId(f.actor), f.owner] } });
  await f.client.close();
}

test("Library relevance reaches beyond the ordinary first page; static public fronts rank correctly without personal metadata or writes", async ({ page }) => {
  const f = await fixture(page);
  try {
    const video = { id: "area-intro", description: "Public intro", mediaType: "video" as const, provider: "cloudflare-stream" as const,
      assetId: "area-static-intro", src: "https://iframe.videodelivery.net/area-static-intro", thumbnailSrc: "https://example.invalid/area-static-poster.png" };
    await f.repo.deckVersions().updateOne({ deckTemplateId: f.fresh.root.deckTemplateId, version: 1 }, { $set: { "content.introduction": { image: null, video } } });
    await page.route("https://example.invalid/area-static-poster.png", (route) => route.fulfill({ contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") }));
    let videoRequests = 0;
    page.on("request", (request) => { if (/\/api\/media\/stream\/status|\/manifest\/video\.m3u8/.test(request.url())) videoRequests++; });
    const ordinary = await (await page.request.get("/api/library/decks")).json();
    expect(ordinary.entries).toHaveLength(20); expect(ordinary.entries.some((entry: { deckTemplateId: string }) => entry.deckTemplateId === f.fresh.root.deckTemplateId)).toBe(false);
    const before = await f.repo.getPersonalUser(f.actor); let writes = 0;
    page.on("request", (request) => { if (request.method() !== "GET" && /\/api\/(decks-data|cards-data|library)/.test(request.url())) writes++; });
    await show(page);
    expect(await library(page).locator(".deck-tile-title").allTextContents()).toEqual(["New Algebra ›"]);
    await expect(library(page).getByText("4 matching Cards", { exact: true })).toBeVisible();
    const publicFresh = library(page).locator(`[data-destination="${f.fresh.root.deckTemplateId}"]`);
    await expect(library(page).locator(`[data-destination="${f.active.root.deckTemplateId}"], [data-destination="${f.archived.root.deckTemplateId}"]`)).toHaveCount(0);
    const personalShared = dialog(page).locator(`[data-context="active"][data-destination="${f.active.root.deckTemplateId}"]`);
    await expect(personalShared.locator(".deck-tile-meta-confidence")).toHaveText("8");
    await expect(personalShared.locator(".deck-tile-title")).toHaveText("Working Algebra ›");
    await expect(publicFresh.locator(".deck-tile-meta")).toHaveText("4 cards");
    await expect(publicFresh.locator(".deck-tile-meta-confidence")).toHaveCount(0);
    await expect(library(page).locator("video, .tile-mini-card-action, .tile-mini-card-play-affordance")).toHaveCount(0);
    await expect(library(page).locator('.tile-mini-card-poster[src="https://example.invalid/area-static-poster.png"]')).toBeVisible();
    await expect(dialog(page)).not.toContainText("PRIVATE CREATOR REFLECTION");
    expect(videoRequests).toBe(0);
    await library(page).getByRole("button", { name: "Select Library New Algebra", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/library/${f.fresh.root.deckTemplateId}\\?progressFramework=library-maths&progressArea=algebra`));
    await expect(page.locator(".deck-detail h1")).toHaveText("New Algebra");
    await expect(page.getByRole("button", { name: "Add to My Decks", exact: true })).toBeEnabled();
    await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Public algebra Card v2");
    await page.locator(".deck-card.is-active").press("Enter");
    await expect(page.locator(".focused-card-stage")).toBeVisible();
    const title = ".focused-card-surface--front .card-title-anchor";
    const rect = (await geometry(page, [title]))[title];
    await page.mouse.move(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2);
    await page.mouse.down();
    await page.mouse.move(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2 + 170, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator(".focused-card-surface--front .active-card-identity").last()).toContainText("My Next Card");
    await expect(page.locator(".focused-card-surface--front .active-card-identity")).toHaveCount(1);
    await page.getByRole("button", { name: "Close focused card", exact: true }).press("Enter");
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before); expect(writes).toBe(0);
    await expect(page.locator(".library-shell")).not.toContainText("PRIVATE CREATOR REFLECTION");
  } finally { await dispose(page, f); }
});

test("Add, archive and Restore and open move a public Deck between Progress sections without Library duplication or version adoption", async ({ page }) => {
  const f = await fixture(page);
  try {
    await show(page); await expect(page.locator('tr[data-item-id="library-equations"] td').nth(0)).toHaveText("11%");
    await library(page).getByRole("button", { name: "Select Library New Algebra", exact: true }).click();
    await page.getByRole("button", { name: "Add to My Decks", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open in My Decks", exact: true })).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(`/library/${f.fresh.root.deckTemplateId}\\?progressFramework=library-maths&progressArea=algebra`));
    const user = (await f.repo.getPersonalUser(f.actor))!;
    expect(user.decksData.filter((deck) => deck.deckTemplateId === f.fresh.root.deckTemplateId)).toHaveLength(1);
    expect(user.cardsData.find((card) => card.cardTemplateId === f.original.root.cardTemplateId)!.cardTemplateVersion).toBe(1);
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("library-maths");
    await expect(page.locator('tr[data-item-id="library-equations"] td').nth(0)).toHaveText("8%");
    await page.locator('tr[data-area-id="algebra"] .progress-content-title').click();
    await expect(dialog(page).getByRole("button", { name: /^My Decks/ }).locator("span").first()).toHaveText("2");
    await expect(dialog(page).getByRole("button", { name: /^Archived/ }).locator("span").first()).toHaveText("1");
    await expect(dialog(page).getByRole("button", { name: /^Library/ }).locator("span").first()).toHaveText("0");
    await dialog(page).getByRole("button", { name: /^Library/ }).click();
    await expect(library(page).getByText("No matching Library Decks.", { exact: true })).toBeVisible();
    await expect(library(page).locator(`[data-destination="${f.fresh.root.deckTemplateId}"]`)).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Open New Algebra", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("New Algebra");
    await expect(page.getByRole("button", { name: "Back to Progress", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Archive Deck", exact: true }).click();
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("library-maths");
    await page.locator('tr[data-area-id="algebra"] .progress-content-title').click();
    await expect(dialog(page).getByRole("button", { name: /^My Decks/ }).locator("span").first()).toHaveText("1");
    await expect(dialog(page).getByRole("button", { name: /^Archived/ }).locator("span").first()).toHaveText("2");
    await expect(dialog(page).getByRole("button", { name: /^Library/ }).locator("span").first()).toHaveText("0");
    await dialog(page).getByRole("button", { name: /^Archived/ }).click();
    await dialog(page).getByRole("button", { name: "Select archived New Algebra", exact: true }).click();
    expect((await f.repo.getPersonalUser(f.actor))!.decksData.find((deck) => deck.deckTemplateId === f.fresh.root.deckTemplateId)!.archivedAt).not.toBeNull();
    await dialog(page).getByRole("button", { name: "Restore and open", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("New Algebra");
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await page.locator('tr[data-area-id="algebra"] .progress-content-title').click();
    await expect(dialog(page).getByRole("button", { name: /^My Decks/ }).locator("span").first()).toHaveText("2");
    await expect(dialog(page).getByRole("button", { name: /^Archived/ }).locator("span").first()).toHaveText("1");
    await expect(dialog(page).getByRole("button", { name: /^Library/ }).locator("span").first()).toHaveText("0");
    await expect(dialog(page).getByRole("button", { name: "Open New Algebra", exact: true })).toBeEnabled();
    // Normal Library remains a public browsing destination after all transitions.
    await page.goto(`/library/${f.fresh.root.deckTemplateId}`);
    await expect(page.locator(".deck-detail h1")).toHaveText("New Algebra");
    await expect(page.getByRole("button", { name: "Open in My Decks", exact: true })).toBeEnabled();
  } finally { await dispose(page, f); }
});

test("main Library still displays imported Decks at public versions while explicit working entry keeps adoption and active Card", async ({ page }) => {
  const f = await fixture(page);
  try {
    const before = await f.repo.getPersonalUser(f.actor);
    await show(page);
    await expect(library(page).locator(`[data-destination="${f.active.root.deckTemplateId}"]`)).toHaveCount(0);
    await page.goto(`/library/${f.active.root.deckTemplateId}?progressFramework=library-maths&progressArea=algebra`);
    await expect(page.locator(".deck-detail h1")).toHaveText("Public Algebra");
    await expect(page.locator(".deck-card.is-active .active-card-identity")).toContainText("Public algebra Card v2");
    await expect(page.getByRole("button", { name: "Open in My Decks", exact: true })).toBeEnabled();
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await page.getByRole("button", { name: "Open in My Decks", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Working Algebra");
    const working = (await f.repo.getPersonalUser(f.actor))!;
    expect(working.decksData.find((deck) => deck.deckTemplateId === f.active.root.deckTemplateId)!.activeCardId).toBe(f.active.data.activeCardId);
    expect(working.cardsData.find((card) => card.cardTemplateId === f.original.root.cardTemplateId)!.cardTemplateVersion).toBe(1);
    await expect(page.getByRole("button", { name: "Back to Progress", exact: true })).toBeVisible();
  } finally { await dispose(page, f); }
});

test("Library browsing archived Decks does not restore them; explicit existing Library Restore keeps Progress return and refreshes counts", async ({ page }) => {
  const f = await fixture(page);
  try {
    const before = await f.repo.getPersonalUser(f.actor);
    await show(page);
    await expect(library(page).locator(`[data-destination="${f.archived.root.deckTemplateId}"]`)).toHaveCount(0);
    await page.goto(`/library/${f.archived.root.deckTemplateId}?progressFramework=library-maths&progressArea=algebra`);
    await expect(page.getByRole("button", { name: "Restore to My Decks", exact: true })).toBeEnabled();
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await page.getByRole("button", { name: "Restore to My Decks", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open in My Decks", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Back to Progress", exact: true }).click();
    await page.locator('tr[data-area-id="algebra"] .progress-content-title').click();
    await expect(dialog(page).getByRole("button", { name: /^My Decks/ }).locator("span").first()).toHaveText("2");
    await expect(dialog(page).getByRole("button", { name: /^Archived/ }).locator("span").first()).toHaveText("0");
  } finally { await dispose(page, f); }
});

test("stale publications require refreshing the Area list; inaccessible public destinations never import or open a personal substitute", async ({ page }) => {
  const f = await fixture(page);
  try {
    const before = await f.repo.getPersonalUser(f.actor);
    await show(page);
    const changed = structuredClone(f.fresh.version); changed.version = 2; changed.content.title = "Revised Algebra";
    await f.repo.deckVersions().insertOne(changed); await f.repo.decks().updateOne({ deckTemplateId: f.fresh.root.deckTemplateId }, { $set: { latestVersion: 2 } });
    await library(page).getByRole("button", { name: "Select Library New Algebra", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("publication changed");
    await dialog(page).getByRole("button", { name: "Refresh Decks", exact: true }).click();
    await expect(library(page).getByRole("button", { name: "Select Library Revised Algebra", exact: true })).toBeEnabled();
    await f.repo.decks().updateOne({ deckTemplateId: f.fresh.root.deckTemplateId }, { $set: { visibility: "private" } });
    await library(page).getByRole("button", { name: "Select Library Revised Algebra", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("no longer accessible");
    await expect(page).toHaveURL(/\/progress$/);
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    await f.repo.decks().updateOne({ deckTemplateId: f.fresh.root.deckTemplateId }, { $set: { visibility: "public" } });
    await dialog(page).getByRole("button", { name: "Refresh Decks", exact: true }).click();
    await library(page).getByRole("button", { name: "Select Library Revised Algebra", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Revised Algebra");
  } finally { await dispose(page, f); }
});

test("ordinary Library entry retains its normal Back destination", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(`/library/${f.active.root.deckTemplateId}`);
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to Progress", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
  } finally { await dispose(page, f); }
});

test("unmapped Areas stay non-navigable; Library partial discovery and database request failures stay distinguishable", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto("/progress");
    await expect(page.getByRole("button", { name: "Empty Area", exact: true })).toBeDisabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Keep a distinct unadopted public Deck readable while the fresh publication
    // becomes unavailable; adopted Decks remain excluded from the Library section.
    const readable = structuredClone(f.fresh.root), version = structuredClone(f.fresh.version);
    readable.deckTemplateId = version.deckTemplateId = randomUUID();
    version.content.title = "Readable Algebra";
    version.content.cards = [{ cardTemplateId: f.original.root.cardTemplateId, cardVersionAtPublish: 1 }];
    await f.repo.decks().insertOne(readable); await f.repo.deckVersions().insertOne(version);
    const secondId = f.fresh.version.content.cards[3].cardTemplateId;
    await f.repo.cardVersions().deleteOne({ cardTemplateId: secondId, version: 1 });
    await page.locator('tr[data-area-id="algebra"] .progress-content-title').click();
    await expect(dialog(page).getByRole("button", { name: /^Library/ }).locator("span").first()).toHaveText("—");
    await dialog(page).getByRole("button", { name: /^Library/ }).click();
    await expect(library(page).getByText(/Some public Decks could not be checked/)).toBeVisible();
    await expect(library(page).getByRole("button", { name: "Select Library Readable Algebra", exact: true })).toBeEnabled();
    await expect(library(page).getByText("No matching Library Decks.", { exact: true })).toHaveCount(0);
    await page.route("**/api/frameworks/library-maths/destinations?*", (route) => route.fulfill({ status: 503,
      json: { error: "Database unavailable" }, headers: { "X-Personal-Viewer": f.actor } }));
    await dialog(page).getByRole("button", { name: "Refresh Decks", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toBeVisible();
    await expect(library(page).getByRole("button", { name: "Select Library Readable Algebra", exact: true })).toBeDisabled();
    await expect(library(page).getByText("No matching Library Decks.", { exact: true })).toHaveCount(0);
  } finally { await dispose(page, f); }
});

test("account switching before Library navigation cannot reuse the previous learner's selection", async ({ page }) => {
  const f = await fixture(page);
  try {
    await show(page); const before = await f.repo.getPersonalUser(f.actor);
    await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
    await library(page).getByRole("button", { name: "Select Library New Algebra", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("sign-in changed");
    expect(await f.repo.getPersonalUser(f.actor)).toEqual(before);
    const other = await f.repo.users().findOne({ username: "other" } as never);
    expect(other!.decksData.some((deck) => deck.deckTemplateId === f.fresh.root.deckTemplateId)).toBe(false);
  } finally { await dispose(page, f); }
});

for (const width of [320, 390, 1440]) test(`Library/working Back to Progress matches visually and restores Framework, expansion and scroll at ${width}px`, async ({ page }, info) => {
  const f = await fixture(page);
  try {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto("/progress");
    await page.getByRole("button", { name: "Collapse Additional Area 0", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 190));
    await page.locator('tr[data-area-id="algebra"] .progress-content-title').click();
    const savedScroll = await page.evaluate(() => window.scrollY);
    await dialog(page).getByRole("button", { name: /^Library/ }).click();
    expect(await dialog(page).evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`area-library-${width}.png`), fullPage: true });
    await library(page).getByRole("button", { name: "Select Library New Algebra", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("New Algebra");
    const publicBounds = (await geometry(page, [".deck-detail", ".back-button"]))[".back-button"];
    const styles = () => page.locator(".back-button").evaluate((element) => {
      const s = getComputedStyle(element); return [s.color, s.backgroundColor, s.border, s.borderRadius, s.padding, s.fontSize, s.fontWeight, s.gap];
    });
    const publicStyles = await styles();
    await page.screenshot({ path: info.outputPath(`library-back-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Back to Progress", exact: true }).press("Enter");
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("library-maths");
    await expect(page.getByRole("button", { name: "Expand Additional Area 0", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedScroll);
    await page.locator('tr[data-area-id="algebra"] .progress-content-title').click();
    await dialog(page).getByRole("button", { name: "Open Working Algebra", exact: true }).click();
    await expect(page.locator(".deck-detail h1")).toHaveText("Working Algebra");
    expect((await geometry(page, [".deck-detail", ".back-button"]))[".back-button"]).toEqual(publicBounds);
    expect(await styles()).toEqual(publicStyles);
    await page.screenshot({ path: info.outputPath(`working-back-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Back to Progress", exact: true }).press("Enter");
    await expect(page.getByLabel("Framework", { exact: true })).toHaveValue("library-maths");
    await expect(page.getByRole("button", { name: "Expand Additional Area 0", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedScroll);
    await page.locator('tr[data-area-id="algebra"] .progress-content-title').click();
    await dialog(page).getByRole("button", { name: "Close", exact: true }).focus(); await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator('tr[data-area-id="algebra"] .progress-content-title')).toBeFocused();
  } finally { await dispose(page, f); }
});
