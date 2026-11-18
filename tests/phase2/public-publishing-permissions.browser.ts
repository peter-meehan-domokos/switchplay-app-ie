import { test, expect, type APIRequestContext } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { deckContentHash } from "../../src/lib/cards/cardReuse";
let client: MongoClient;
const actor = process.env.PHASE2_USER_ID!;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB);
async function grant(value: unknown) { await db().collection("users").updateOne({ _id: new ObjectId(actor) }, value === undefined ? { $unset: { permissions: "" } } : { $set: { permissions: value } }); }
test.afterEach(async () => { await grant({ publicPublishing: true }); });
const content = () => ({ ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Permission practice", description: null, mediaItem: null } });
async function setup(visibility: "public" | "private" = "public") {
  const main = new CardRepository(db(), client), info = new InfoCardRepository(db(), client);
  const card = await main.createCardDraft(actor, content(), visibility);
  const deck = await main.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: `Permission deck ${randomUUID()}` }, visibility);
  const id = randomUUID(), series = randomUUID(); await info.createSeries(actor, series, `Basics ${series.slice(0, 5)}`); await info.create(actor, id);
  await info.save(actor, id, 0, { title: "Signs", body: "Keep the sign with its number.", seriesId: series, mediaItem: null }, visibility);
  return { main, info, card, deck, id };
}
async function publish(request: APIRequestContext, f: Awaited<ReturnType<typeof setup>>) {
  return [await request.patch(`/api/card-templates/${f.card.cardTemplateId}`, { data: { type: "publish", revision: 0 } }),
    await request.post(`/api/deck-templates/${f.deck.deckTemplateId}/publish`, { data: { revision: 0, review: await f.main.prepareDeckPublication(actor, f.deck.deckTemplateId, 0), acceptCardDrafts: false } }),
    await request.post(`/api/info-cards/${f.id}/publish`, { data: { revision: 1 } })];
}
for (const site of ["puckle", "switchplay", "strat17"]) test(`direct public APIs fail closed and private APIs remain usable in ${site}`, async ({ page, context }) => {
  await context.addCookies([{ name: "site", value: site, url: process.env.PHASE2_BASE_URL! }]);
  expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).status()).toBe(200);
  for (const value of [undefined, null, { publicPublishing: false }, { publicPublishing: "true" }, { publicPublishing: [true] }, [{ publicPublishing: true }]]) {
    await grant(value); const f = await setup();
    for (const response of await publish(page.request, f)) { expect(response.status()).toBe(403); expect((await response.json()).code).toBe("PUBLIC_PUBLISHING_FORBIDDEN"); }
    expect(await f.main.cardVersions().countDocuments({ cardTemplateId: f.card.cardTemplateId })).toBe(0);
    expect((await page.request.patch(`/api/card-templates/${f.card.cardTemplateId}`, { data: { type: "publish", revision: 0, permissions: { publicPublishing: true } } })).status()).toBe(400);
  }
  await grant({ publicPublishing: false }); const privateDrafts = await setup("private");
  for (const response of await publish(page.request, privateDrafts)) expect(response.status()).toBe(200);
  await grant({ publicPublishing: true }); const allowed = await setup();
  for (const response of await publish(page.request, allowed)) expect(response.status()).toBe(200);
  // Revoke with the same session. Every subsequent public version is denied.
  await grant({ publicPublishing: false });
  await allowed.main.saveCardDraft(actor, allowed.card.cardTemplateId, 1, { ...allowed.card.draft!, intro: { ...allowed.card.draft!.intro, title: "Changed" } });
  await allowed.main.saveDeckDraft(actor, allowed.deck.deckTemplateId, 1, { ...allowed.deck.draft!, title: "Changed" });
  await allowed.info.save(actor, allowed.id, 2, { ...(await allowed.info.versions().findOne({ infoCardId: allowed.id }))!.content, title: "Changed" }, "public");
  const review = await allowed.main.prepareDeckPublication(actor, allowed.deck.deckTemplateId, 2);
  const requests = [() => page.request.patch(`/api/card-templates/${allowed.card.cardTemplateId}`, { data: { type: "publish", revision: 2 } }),
    () => page.request.post(`/api/deck-templates/${allowed.deck.deckTemplateId}/publish`, { data: { revision: 2, review, acceptCardDrafts: false } }),
    () => page.request.post(`/api/info-cards/${allowed.id}/publish`, { data: { revision: 3 } })];
  for (const send of requests) expect((await send()).status()).toBe(403);
  await grant({ publicPublishing: true }); for (const send of requests) expect((await send()).status()).toBe(200);
});
test("Copy denial gives precise UI feedback, preserves edits and makes no partial write", async ({ page }) => {
  const f = await setup(); await grant({ publicPublishing: true });
  await f.main.publishCard(actor, f.card.cardTemplateId, 0); await f.main.publishDeck(actor, f.deck.deckTemplateId, 0);
  const source = await f.main.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Copy source", cards: [{ cardTemplateId: f.card.cardTemplateId }] });
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await grant({ publicPublishing: false });
  const beforeCard = await f.main.cards().findOne({ cardTemplateId: f.card.cardTemplateId });
  const beforeDeck = await f.main.decks().findOne({ deckTemplateId: f.deck.deckTemplateId });
  const direct = await page.request.post(`/api/card-templates/${f.card.cardTemplateId}/copy-to`, { data: { deckTemplateId: f.deck.deckTemplateId, revision: 1, contentHash: deckContentHash(f.deck.draft!) } });
  expect(direct.status()).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/creator/edit/${source.deckTemplateId}`);
  await page.locator(`[data-card-template-id="${f.card.cardTemplateId}"] .creator-card-title-button`).click();
  await page.getByRole("button", { name: "Copy to…", exact: true }).click();
  const section = page.getByRole("region", { name: "Copy Card", exact: true });
  await page.locator(".creator-modal").getByRole("textbox").fill("Local text retained");
  await section.getByRole("button", { name: f.deck.draft!.title, exact: true }).click();
  await expect(section.getByRole("alert")).toContainText("requires approval");
  await expect(section.getByRole("alert")).toContainText("Nothing was copied");
  await expect(page.locator(".creator-modal").getByRole("textbox")).toHaveValue("Local text retained");
  expect(await f.main.cards().findOne({ cardTemplateId: f.card.cardTemplateId })).toEqual(beforeCard);
  expect(await f.main.decks().findOne({ deckTemplateId: f.deck.deckTemplateId })).toEqual(beforeDeck);
});
test("Info Card UI preserves its saved draft when public publication is denied", async ({ page }) => {
  const f = await setup(); await grant({ publicPublishing: false });
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto(`/creator/info-cards/${f.id}`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("dialog", { name: "Publish Info Card publicly?" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
  await expect(page.getByText("Public publishing requires approval. Your draft is saved and private work remains available.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).toHaveValue("Keep the sign with its number.");
  await page.getByRole("alert").getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByText("Public publishing requires approval")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).toHaveValue("Keep the sign with its number.");
  expect(await f.info.versions().countDocuments({ infoCardId: f.id })).toBe(0);
});
for (const kind of ["Card", "Deck"]) test(`${kind} Creator publication feedback preserves the saved draft`, async ({ page }) => {
  const f = await setup(); await grant({ publicPublishing: false });
  const target = kind === "Card" ? await f.main.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Card editor", cards: [{ cardTemplateId: f.card.cardTemplateId }] }) : f.deck;
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto(`/creator/edit/${target.deckTemplateId}`);
  await page.getByRole("button", { name: kind === "Card" ? "Publish Card 1" : "Publish Deck", exact: true }).click();
  await page.getByRole("dialog", { name: "Confirm public publication" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
  await expect(page.locator(".creator-save-message--error")).toContainText("Public publishing requires approval");
  await page.locator(".creator-save-message--error").getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.locator(".creator-save-message--error")).toHaveCount(0);
  expect(await f.main.cardVersions().countDocuments({ cardTemplateId: f.card.cardTemplateId })).toBe(0);
  expect(await f.main.deckVersions().countDocuments({ deckTemplateId: f.deck.deckTemplateId })).toBe(0);
  expect((await f.main.cards().findOne({ cardTemplateId: f.card.cardTemplateId }))!.draft!.intro.title).toBe("Permission practice");
});

// --- Public stays in the one dropdown; unapproved users get an explanation instead of the selection ---
type Kind = "Deck" | "Card" | "Info Card";
async function open(page: import("@playwright/test").Page, f: Awaited<ReturnType<typeof setup>>, kind: Kind) {
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  if (kind === "Info Card") { await page.goto(`/creator/info-cards/${f.id}`); return page.getByRole("combobox", { name: "Info Card publication visibility", exact: true }); }
  const target = kind === "Card" ? await f.main.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Card editor", cards: [{ cardTemplateId: f.card.cardTemplateId }] }) : f.deck;
  await page.goto(`/creator/edit/${target.deckTemplateId}`);
  return page.getByRole("combobox", { name: kind === "Card" ? "Card 1 publication visibility" : "Deck publication visibility", exact: true });
}
const within = async (locator: import("@playwright/test").Locator, page: import("@playwright/test").Page) => {
  const box = (await locator.boundingBox())!, viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
};
for (const kind of ["Deck", "Card", "Info Card"] as Kind[]) test(`unapproved ${kind}: greyed Public explains approval, OK dismisses it and private work continues`, async ({ page }) => {
  await grant({ publicPublishing: false }); const f = await setup("private");
  await page.setViewportSize({ width: 390, height: 844 });
  const select = await open(page, f, kind);
  await expect(select).toHaveValue("private");
  await expect(select.locator("option[value=public]")).toHaveText("Public (requires approval)");
  await select.selectOption("public");
  const dialog = page.getByRole("alertdialog", { name: "Public publishing requires approval" });
  await expect(dialog).toContainText("Public publishing requires approval. You can continue creating and publishing privately.");
  await within(dialog, page); await within(dialog.getByRole("button", { name: "OK", exact: true }), page);
  await expect(select).toHaveValue("private");
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(select).toHaveValue("private");
  await expect(page.getByText("Public publishing requires approval")).toHaveCount(0);
  if (kind === "Info Card") await expect(page.getByRole("textbox", { name: "Explanation", exact: true })).toHaveValue("Keep the sign with its number.");
  // Private publication still works straight after dismissal.
  await page.getByRole("button", { name: kind === "Info Card" ? "Publish" : kind === "Card" ? "Publish Card 1" : "Publish Deck", exact: true }).click();
  if (kind === "Info Card") await expect.poll(() => f.info.versions().countDocuments({ infoCardId: f.id, visibility: "private" })).toBe(1);
  else if (kind === "Deck") await expect.poll(() => f.main.deckVersions().countDocuments({ deckTemplateId: f.deck.deckTemplateId, visibility: "private" })).toBe(1);
  else await expect.poll(() => f.main.cardVersions().countDocuments({ cardTemplateId: f.card.cardTemplateId, visibility: "private" })).toBe(1);
  expect(await f.main.cardVersions().countDocuments({ visibility: "public", publishedByUserId: actor, cardTemplateId: f.card.cardTemplateId })).toBe(0);
});
for (const kind of ["Deck", "Info Card"] as Kind[]) test(`approved ${kind}: Public is an ordinary selectable option with no prompt`, async ({ page }) => {
  await grant({ publicPublishing: true }); const f = await setup("private");
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto(kind === "Deck" ? `/creator/edit/${f.deck.deckTemplateId}` : `/creator/info-cards/${f.id}`);
  const select = page.getByRole("combobox", { name: `${kind} publication visibility`, exact: true });
  await select.selectOption("public");
  await expect(select).toHaveValue("public");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});
for (const kind of ["Deck", "Info Card"] as Kind[]) test(`${kind}: revocation after approval gives dismissible server feedback and a later refresh greys Public`, async ({ page }) => {
  await grant({ publicPublishing: true }); const f = await setup("private");
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto(kind === "Deck" ? `/creator/edit/${f.deck.deckTemplateId}` : `/creator/info-cards/${f.id}`);
  const select = page.getByRole("combobox", { name: `${kind} publication visibility`, exact: true });
  await expect(select).toBeVisible(); await page.waitForTimeout(500);       // let the advisory read settle as approved
  await grant({ publicPublishing: false });                                     // revoked while the page stays open and stale
  await select.selectOption("public");
  await page.getByRole("button", { name: kind === "Deck" ? "Publish Deck" : "Publish", exact: true }).click();
  await page.getByRole("dialog", { name: kind === "Deck" ? "Confirm public publication" : "Publish Info Card publicly?" }).getByRole("button", { name: "Publish publicly", exact: true }).click();
  const feedback = kind === "Deck" ? page.locator(".creator-save-message--error") : page.getByRole("alert").filter({ hasText: "requires approval" });
  await expect(feedback).toContainText("requires approval");
  await feedback.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByText("Public publishing requires approval")).toHaveCount(0);
  await select.selectOption("private");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));        // a refresh now sees the revocation
  await expect(select.locator("option[value=public]")).toHaveText("Public (requires approval)");
});
test("a grant made while the page is open is honoured when Public is tapped", async ({ page }) => {
  await grant({ publicPublishing: false }); const f = await setup("private");
  const select = await open(page, f, "Deck");
  await expect(select.locator("option[value=public]")).toHaveText("Public (requires approval)");
  await grant({ publicPublishing: true });
  await select.selectOption("public");
  await expect(select).toHaveValue("public");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});
