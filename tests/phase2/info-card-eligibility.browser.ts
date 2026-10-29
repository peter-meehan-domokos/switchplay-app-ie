import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";

let client: MongoClient, main: CardRepository, info: InfoCardRepository, actor: string, other: string;
test.beforeAll(async () => {
  assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect();
  main = new CardRepository(client.db(process.env.MONGODB_DB!), client); info = new InfoCardRepository(main.db, client);
  actor = process.env.PHASE2_USER_ID!; other = (await main.db.collection("users").findOne({ username: "other" }))!._id.toString();
  for (const [id, owner, title, visibility, seriesId] of [
    ["eligibility-private", actor, "Owned private", "private", "demo-series-owner"],
    ["eligibility-public", actor, "Owned public", "public", "demo-series-owner"],
    ["eligibility-shared", other, "Shared public", "public", "demo-series-other"],
    ["eligibility-hidden", other, "Hidden private", "private", "demo-series-other"],
  ] as const) if (!await info.roots().findOne({ infoCardId: id })) {
    await info.create(owner, id); await info.save(owner, id, 0, { title, body: "Keep each sign.", seriesId, mediaItem: null }, visibility); await info.publish(owner, id, 1);
  }
});
test.afterAll(async () => { await client?.close(); });
async function fixture(owner = actor, published = false) {
  const content = { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
    intro: { title: "Useful practice", description: null, mediaItem: null }, infoCardIds: ["eligibility-public"] };
  const card = await main.createCardDraft(owner, content, published ? "public" : "private");
  if (published) await main.publishCard(owner, card.cardTemplateId, 0);
  const deck = await main.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: "Attachment programme", cards: [{ cardTemplateId: card.cardTemplateId }] }, published ? "public" : "private");
  if (published) await main.publishDeck(owner, deck.deckTemplateId, 0);
  return { card, deck, content };
}
async function enter(page: Page, deckId: string) {
  expect((await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).ok()).toBe(true);
  await page.goto(`/creator/edit/${deckId}`);
}
const modal = (page: Page) => page.locator(".creator-modal");
const cardVisibility = (page: Page) => page.getByRole("combobox", { name: "Card 1 publication visibility", exact: true });
const deckVisibility = (page: Page) => page.getByRole("combobox", { name: "Deck publication visibility", exact: true });
async function titleModal(page: Page) { await page.locator(".creator-card-title-button").first().click(); }
async function dropdown(page: Page) {
  await modal(page).getByRole("button", { name: "Add Info Card", exact: true }).click();
  const list = page.getByRole("listbox", { name: "Published Info Cards" }); await expect(list).toHaveAttribute("aria-busy", "false"); return list;
}
const root = (id: string) => main.cards().findOne({ cardTemplateId: id });

for (const deck of ["private", "public"] as const) for (const card of ["private", "public"] as const) {
  test(`${deck} Deck / ${card} Card filters new selections without changing published visibility`, async ({ page }) => {
    const f = await fixture(); await enter(page, f.deck.deckTemplateId);
    await deckVisibility(page).selectOption(deck); await cardVisibility(page).selectOption(card);
    await titleModal(page); const list = await dropdown(page);
    await expect(list.getByRole("option", { name: "Owned private Basics", exact: true })).toHaveCount(deck === "private" && card === "private" ? 1 : 0);
    await expect(list.getByRole("option", { name: "Owned public Basics", exact: true })).toHaveCount(1);
    await expect(list.getByRole("option", { name: "Shared public Basics · by other", exact: true })).toHaveCount(1);
    await expect(list).not.toContainText("Hidden private");
    expect((await root(f.card.cardTemplateId))!.visibility).toBe("private");
    expect((await info.owner(actor, "eligibility-private")).visibility).toBe("private");
  });
}

for (const scope of ["Deck", "Card"] as const) test(`live ${scope} visibility changes filter open options while retaining modal-local private selections and recoverable saves`, async ({ page }) => {
  const f = await fixture(); await enter(page, f.deck.deckTemplateId); await titleModal(page);
  await (await dropdown(page)).getByRole("option", { name: "Owned private Basics", exact: true }).click();
  const selected = modal(page).getByRole("list", { name: "Attached Info Cards" });
  await dropdown(page);
  // Controlled state-change probe while the popup is mounted. This does not add
  // a way for users to interact with the header through the title modal.
  const visibility = scope === "Deck" ? deckVisibility(page) : cardVisibility(page);
  await visibility.evaluate((el: HTMLSelectElement) => { el.value = "public"; el.dispatchEvent(new Event("change", { bubbles: true })); });
  await expect(page.getByRole("listbox").getByRole("option", { name: "Owned private Basics", exact: true })).toHaveCount(0);
  await expect(selected).toContainText("Owned private");
  await expect(selected.getByRole("button", { name: "Remove attachment Owned private", exact: true })).toBeEnabled();
  await expect(modal(page).getByRole("status")).toContainText("private Info Card attached: Owned private");
  await page.keyboard.press("Escape");
  await modal(page).getByRole("textbox").fill("Saved private attachment draft"); await modal(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await root(f.card.cardTemplateId))!.draft!.infoCardIds).toEqual(["eligibility-public", "eligibility-private"]);
  await visibility.selectOption("private"); await titleModal(page);
  await expect(modal(page).getByRole("status")).toHaveCount(0);
  await expect((await dropdown(page)).getByRole("option", { name: "Owned private Basics", exact: true })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await modal(page).getByRole("button", { name: "Remove attachment Owned private", exact: true }).click();
  await modal(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await root(f.card.cardTemplateId))!.draft!.infoCardIds).toEqual(["eligibility-public"]);
});

test("previously published public visibility is permanent and still excludes private selections", async ({ page }) => {
  const f = await fixture(actor, true); await enter(page, f.deck.deckTemplateId);
  await expect(deckVisibility(page)).toBeDisabled(); await expect(cardVisibility(page)).toBeDisabled();
  await titleModal(page); await expect((await dropdown(page)).getByRole("option", { name: "Owned private Basics", exact: true })).toHaveCount(0);
});

test("private copies of a foreign public Deck and Card use the resulting ownership/visibility context", async ({ page }) => {
  const f = await fixture(other, true); await enter(page, f.deck.deckTemplateId);
  await page.getByRole("dialog", { name: "Edit your own Deck" }).getByRole("button", { name: "Continue editing", exact: true }).click();
  await titleModal(page); await (await dropdown(page)).getByRole("option", { name: "Owned private Basics", exact: true }).click();
  await modal(page).getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("dialog", { name: "Edit your own Card" }).getByRole("button", { name: "Continue editing", exact: true }).click();
  await expect.poll(async () => !!await main.cards().findOne({ ownerUserId: actor, "forkedFrom.cardTemplateId": f.card.cardTemplateId })).toBe(true);
  const copy = (await main.cards().findOne({ ownerUserId: actor, "forkedFrom.cardTemplateId": f.card.cardTemplateId }))!;
  expect(copy.visibility).toBe("private"); expect(copy.draft!.infoCardIds).toEqual(["eligibility-public", "eligibility-private"]);
  expect((await root(f.card.cardTemplateId))!.draft).toBeNull();
  const deckCopy = (await main.decks().findOne({ ownerUserId: actor, "forkedFrom.deckTemplateId": f.deck.deckTemplateId }))!;
  // The database commit precedes the client identity/URL handoff. Reload the
  // completed owned copy, rather than racing that unrelated transition.
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${deckCopy.deckTemplateId}(?:\\?|$)`));
  await page.reload(); await expect(deckVisibility(page)).toHaveValue("private"); await expect(cardVisibility(page)).toHaveValue("private");
  await titleModal(page); await expect((await dropdown(page)).getByRole("option", { name: "Owned private Basics", exact: true })).toHaveCount(1);
});

async function incompatible() {
  const f = await fixture(actor, true);
  await main.saveCardDraft(actor, f.card.cardTemplateId, 1, { ...f.content, infoCardIds: ["eligibility-private"] });
  return f;
}
const publicationError = "Cannot publish publicly. One or more attached Info Cards are private. Remove them or publish those Info Cards publicly first.";

test("direct Card publication explains real backend rejection and removal resolves it without losing history", async ({ page }) => {
  const f = await incompatible(); await enter(page, f.deck.deckTemplateId); await titleModal(page);
  await expect(modal(page).getByRole("status")).toContainText("Owned private");
  await modal(page).getByRole("button", { name: "Cancel", exact: true }).click();
  const publish = page.getByRole("button", { name: "Publish Card 1", exact: true });
  await publish.click(); await expect(page.getByText(publicationError, { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("PRIVATE_INFO_BLOCKS_PUBLICATION");
  expect((await root(f.card.cardTemplateId))!.latestVersion).toBe(1); expect((await root(f.card.cardTemplateId))!.draft!.infoCardIds).toEqual(["eligibility-private"]);
  expect((await main.getCardVersion(f.card.cardTemplateId, 1))!.content.infoCardIds).toEqual(["eligibility-public"]);
  await titleModal(page); await modal(page).getByRole("button", { name: "Remove attachment Owned private", exact: true }).click();
  await expect(modal(page).getByRole("status")).toHaveCount(0);
  await modal(page).getByRole("button", { name: "Save", exact: true }).click(); await expect(publish).toBeEnabled(); await publish.click();
  await expect.poll(async () => (await root(f.card.cardTemplateId))!.latestVersion).toBe(2);
});

test("Publish and leave translates the real guard failure and retains the editor and draft", async ({ page }) => {
  const f = await incompatible(); await enter(page, f.deck.deckTemplateId);
  await page.locator(".creator-back-link").click();
  await page.getByRole("dialog", { name: "Leave Creator confirmation" }).getByRole("button", { name: "Publish and leave", exact: true }).click();
  await expect(page.getByText(publicationError, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/creator/edit/${f.deck.deckTemplateId}`));
  await expect(page.locator("body")).not.toContainText("PRIVATE_INFO_BLOCKS_PUBLICATION");
  expect((await root(f.card.cardTemplateId))!.draft!.infoCardIds).toEqual(["eligibility-private"]);
});

test("Deck Publish translates a structured guard error without leaking its code", async ({ page }) => {
  const f = await fixture(actor, true);
  await main.saveDeckDraft(actor, f.deck.deckTemplateId, 1, { ...f.deck.draft!, title: "Updated attachment programme" });
  await enter(page, f.deck.deckTemplateId);
  // This is a UI error-boundary probe. Ordinary Deck-only publication pins
  // published mains; it does not itself publish their newer attachment drafts.
  await page.route(`**/api/deck-templates/${f.deck.deckTemplateId}/publish?revision=*`, route => route.fulfill({ status: 400, json: { code: "PRIVATE_INFO_BLOCKS_PUBLICATION", error: "PRIVATE_INFO_BLOCKS_PUBLICATION" } }));
  await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
  await expect(page.getByText(publicationError, { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("PRIVATE_INFO_BLOCKS_PUBLICATION");
});

test("public Info publication resolves eligibility and the existing main draft without implicit promotion", async ({ page }) => {
  const id = randomUUID(); await info.create(actor, id);
  await info.save(actor, id, 0, { title: "Promotable tip", body: "Keep each sign.", seriesId: "demo-series-owner", mediaItem: null }, "private"); await info.publish(actor, id, 1);
  const f = await fixture(actor, true); await main.saveCardDraft(actor, f.card.cardTemplateId, 1, { ...f.content, infoCardIds: [id] });
  await enter(page, f.deck.deckTemplateId); await titleModal(page);
  const documentStarted = await page.evaluate(() => performance.timeOrigin);
  await expect(modal(page).getByRole("status")).toContainText("Promotable tip");
  await info.save(actor, id, 2, { title: "Promotable tip", body: "Keep each sign.", seriesId: "demo-series-owner", mediaItem: null }, "public");
  expect((await info.owner(actor, id)).visibility).toBe("private");
  await expect((await dropdown(page)).getByRole("option", { name: "Promotable tip Basics", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape"); await info.publish(actor, id, 3);
  await expect((await dropdown(page)).getByRole("option", { name: "Promotable tip Basics", exact: true })).toHaveCount(1);
  await expect(modal(page).getByRole("status")).toHaveCount(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStarted);
  await expect(modal(page).getByRole("list", { name: "Attached Info Cards" })).toContainText("Promotable tip");
  expect((await root(f.card.cardTemplateId))!.latestVersion).toBe(1);
  await page.keyboard.press("Escape"); await modal(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Publish Card 1", exact: true }).click();
  await expect.poll(async () => (await root(f.card.cardTemplateId))!.latestVersion).toBe(2);
});
