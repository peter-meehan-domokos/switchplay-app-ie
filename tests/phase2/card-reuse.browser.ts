import { test, expect, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const db = () => client.db(process.env.MONGODB_DB!);
const actor = () => new ObjectId(process.env.PHASE2_USER_ID!).toHexString();
const root = (id: string) => db().collection("deckTemplates").findOne({ deckTemplateId: id });
async function setup(page: Page, publishedCard = false) {
  const repo = new CardRepository(db(), client), prefix = randomUUID();
  const card = await repo.createCardDraft(actor(), { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: `Practice ${prefix}`, description: null, mediaItem: null } });
  if (publishedCard) await repo.publishCard(actor(), card.cardTemplateId, 0);
  const source = await repo.createDeckDraft(actor(), { ...createDefaultDeckContent([]), title: `Source ${prefix}`, cards: [{ cardTemplateId: card.cardTemplateId }] });
  const draft = await repo.createDeckDraft(actor(), { ...createDefaultDeckContent([]), title: `Draft ${prefix}` });
  const archived = await repo.createDeckDraft(actor(), { ...createDefaultDeckContent([]), title: `Archived ${prefix}` });
  await repo.publishDeck(actor(), archived.deckTemplateId, 0); await repo.archiveDeckData(actor(), archived.deckTemplateId);
  const other = await db().collection("users").findOne({ username: "other" });
  const foreign = await repo.createDeckDraft(other!._id.toString(), { ...createDefaultDeckContent([]), title: `Foreign ${prefix}` });
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await page.goto(`/creator/edit/${source.deckTemplateId}`);
  await page.locator(`[data-card-template-id="${card.cardTemplateId}"] .creator-card-title-button`).click();
  await page.getByRole("button", { name: "Copy to…", exact: true }).click();
  const section = page.getByRole("region", { name: "Copy Card", exact: true });
  await expect(section.getByRole("button", { name: draft.draft!.title, exact: true })).toBeVisible();
  return { repo, card, source, draft, archived, foreign, section };
}

test("Copy to reuses unpublished Card in owned draft/archived Decks without personal state or source edits", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const { card, source, draft, archived, foreign, section } = await setup(page);
  const before = await db().collection("users").findOne({ _id: new ObjectId(actor()) }), count = await db().collection("cardTemplates").countDocuments();
  await expect(section.getByRole("button", { name: source.draft!.title, exact: true })).toHaveCount(0);
  await expect(section.getByRole("button", { name: foreign.draft!.title, exact: true })).toHaveCount(0);
  await page.locator(".creator-modal").getByRole("textbox").fill("Local modal edit has not been applied");
  for (const dest of [draft, archived]) {
    await section.getByRole("button", { name: dest.draft!.title, exact: true }).click();
    await expect(section.getByRole("button", { name: `${dest.draft!.title} — already contains this Card`, exact: true })).toBeDisabled();
    await expect(section.getByRole("status")).toHaveText("Copied to the destination draft. Publish that Deck to make it live.");
    expect((await root(dest.deckTemplateId))!.draft.cards).toEqual([{ cardTemplateId: card.cardTemplateId }]);
  }
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${source.deckTemplateId}$`));
  expect(await db().collection("cardTemplates").countDocuments()).toBe(count);
  const stored = await db().collection("cardTemplates").findOne({ cardTemplateId: card.cardTemplateId });
  expect(stored!.draft.intro.title).toBe(card.draft!.intro.title); expect(stored!.firstReusedAt).toBeInstanceOf(Date);
  expect(await db().collection("users").findOne({ _id: new ObjectId(actor()) })).toEqual(before);
  await page.locator(".creator-modal-actions").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.locator(`[data-card-template-id="${card.cardTemplateId}"] .creator-card-title-button`).click();
  await page.getByRole("button", { name: "Delete Card", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(async () => (await root(source.deckTemplateId))!.draft.cards.length).toBe(0);
  expect(await db().collection("cardTemplates").countDocuments()).toBe(count);
  expect((await root(draft.deckTemplateId))!.draft.cards).toEqual([{ cardTemplateId: card.cardTemplateId }]);
});

test("lost Copy response recovers the exact command without duplicate attachment", async ({ page }) => {
  const { card, draft, section } = await setup(page); let calls = 0;
  await page.route(`**/api/card-templates/${card.cardTemplateId}/copy-to`, async (route) => {
    if (route.request().method() === "POST" && ++calls === 1) { await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await section.getByRole("button", { name: draft.draft!.title, exact: true }).click();
  await expect(section.getByRole("button", { name: `${draft.draft!.title} — already contains this Card`, exact: true })).toBeDisabled();
  expect(calls).toBe(2); expect((await root(draft.deckTemplateId))!.revision).toBe(1);
  expect((await root(draft.deckTemplateId))!.draft.cards).toEqual([{ cardTemplateId: card.cardTemplateId }]);
});

test("concurrent destination edit produces a visible conflict without overwriting; refresh allows explicit retry", async ({ page }) => {
  const { repo, card, draft, section } = await setup(page);
  await repo.saveDeckDraft(actor(), draft.deckTemplateId, 0, { ...draft.draft!, title: "Changed in another tab" });
  await section.getByRole("button", { name: draft.draft!.title, exact: true }).click();
  await expect(section.getByRole("alert")).toContainText("destination changed");
  expect((await root(draft.deckTemplateId))!.draft.cards).toEqual([]);
  await section.getByRole("button", { name: "Refresh destinations", exact: true }).click();
  await section.getByRole("button", { name: "Changed in another tab", exact: true }).click();
  await expect.poll(async () => (await root(draft.deckTemplateId))!.draft.cards).toEqual([{ cardTemplateId: card.cardTemplateId }]);
  expect((await root(draft.deckTemplateId))!.draft.title).toBe("Changed in another tab");
});


test("Copy to clean published archived Deck reports publication and recovers a lost response without another version", async ({ page }) => {
  const { repo, card, draft, archived, section } = await setup(page, true); let calls = 0;
  await repo.saveCardDraft(actor(), card.cardTemplateId, 1, { ...card.draft!, intro: { ...card.draft!.intro, title: "Newer unpublished Card title" } });
  await page.route(`**/api/card-templates/${card.cardTemplateId}/copy-to`, async (route) => {
    if (route.request().method() === "POST" && ++calls === 1) { await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await section.getByRole("button", { name: archived.draft!.title, exact: true }).click();
  await expect(section.getByRole("status")).toHaveText("Copied and published in the destination Deck.");
  expect(calls).toBe(2);
  const destination = (await root(archived.deckTemplateId))!;
  expect(destination.latestVersion).toBe(2); expect(destination.draft).toBeNull(); expect(destination.revision).toBe(3);
  expect(await db().collection("deckTemplateVersions").countDocuments({ deckTemplateId: archived.deckTemplateId })).toBe(2);
  expect((await repo.getDeckVersion(archived.deckTemplateId, 2))!.content.cards).toEqual([{ cardTemplateId: card.cardTemplateId, cardVersionAtPublish: 1 }]);
  const user = (await repo.getPersonalUser(actor()))!;
  expect(user.decksData.find((data) => data.deckTemplateId === archived.deckTemplateId)!.archivedAt).not.toBeNull();
  expect(user.decksData.find((data) => data.deckTemplateId === archived.deckTemplateId)!.deckTemplateVersion).toBe(2);
  expect((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.draft!.intro.title).toBe("Newer unpublished Card title");
  expect(await repo.cardVersions().countDocuments({ cardTemplateId: card.cardTemplateId })).toBe(1);
  await section.getByRole("button", { name: draft.draft!.title, exact: true }).click();
  await expect(section.getByRole("status")).toHaveText("Copied to the destination draft. Publish that Deck to make it live.");
  expect((await root(draft.deckTemplateId))!.latestVersion).toBe(0);
});
