import { expect, test, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { CardRepository } from "../../src/lib/cards/repository";
import { InfoCardRepository } from "../../src/lib/infoCards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";

let client: MongoClient, main: CardRepository, infos: InfoCardRepository, actor: string;
test.beforeAll(async () => {
  assertDisposableDatabase();
  client = await new MongoClient(process.env.MONGODB_URI!).connect();
  main = new CardRepository(client.db(process.env.MONGODB_DB!), client);
  infos = new InfoCardRepository(main.db, client);
  actor = process.env.PHASE2_USER_ID!;
});
test.afterAll(async () => { await client?.close(); });

async function login(page: Page, username = "phase2") {
  expect((await page.request.post("/api/auth/login", { data: { identifier: username, password: "local-test-only" } })).ok()).toBe(true);
}
const modal = (page: Page) => page.locator(".creator-modal");
const current = (page: Page) => page.locator('[data-info-card-current="true"]');
async function open(page: Page) {
  await page.getByRole("button", { name: /^Open information cards/ }).click();
  await expect(page.locator("[data-info-card-stack]")).toHaveAttribute("data-info-stack-phase", "open");
}
async function close(page: Page) {
  await page.getByRole("button", { name: "Close information card stack", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Info card consultation", exact: true })).toHaveCount(0);
}
async function enter(page: Page, deckId: string, working: boolean) {
  // Library cards are server-rendered. Its existing viewer-status effect proves
  // hydration has run before sending a keypress that Playwright cannot replay.
  const hydrated = working ? null : page.waitForResponse(response => new URL(response.url()).pathname === "/api/library/viewer-status" && response.request().method() === "GET");
  await page.goto(working ? `/decks?openDeck=${deckId}` : `/library/${deckId}`);
  if (hydrated) expect((await hydrated).ok()).toBe(true);
  await page.locator(".deck-card.is-active").press("Enter");
  await page.locator(".focused-card-layer .active-card-identity").click();
  await expect(page.locator(".step-view-layer")).toHaveCount(1);
}
async function catalogue(page: Page) {
  await modal(page).getByRole("button", { name: "Add Info Card", exact: true }).click();
  const list = page.getByRole("listbox", { name: "Published Info Cards", exact: true });
  await expect(list).toHaveAttribute("aria-busy", "false");
  return list;
}
async function confirmPublic(page: Page) {
  await page.getByRole("dialog", { name: "Confirm public publication", exact: true })
    .getByRole("button", { name: "Publish publicly", exact: true }).click();
}

test("authoring through attachment publication reaches both readers; Info updates and main adoption remain independent", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // A second, dedicated published reference avoids depending on runner examples
  // whose titles other Creator/Library regressions intentionally edit.
  const companionId = randomUUID();
  await infos.create(actor, companionId);
  await infos.save(actor, companionId, 0, { title: "Companion tip", body: "Check each step.", seriesId: "demo-series-owner", mediaItem: null }, "public");
  await infos.publish(actor, companionId, 1);
  await login(page);
  const seriesName = `Tips ${randomUUID().slice(0, 4)}`;
  await page.goto("/creator/info-cards/new");
  await page.getByRole("combobox", { name: "Series", exact: true }).selectOption("__create__");
  await page.getByRole("textbox", { name: "New series name", exact: true }).fill(seriesName);
  await page.getByRole("button", { name: "Create series", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toBeEditable();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Release tip");
  await page.getByRole("textbox", { name: "Explanation", exact: true }).fill("Keep each sign attached.");
  await page.getByRole("combobox", { name: "Info Card publication visibility", exact: true }).selectOption("public");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("dialog", { name: "Publish Info Card publicly?", exact: true })
    .getByRole("button", { name: "Publish publicly", exact: true }).click();
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
  const infoId = new URL(page.url()).pathname.split("/").at(-1)!;
  const infoRoot = await infos.owner(actor, infoId);
  const initialInfoContent = (await infos.versions().findOne({ infoCardId: infoId, version: 1 }))!.content;
  expect(infoRoot.latestVersion).toBe(1);

  // This graph is authored through the real Creator, not seeded publications.
  await page.goto("/creator/new");
  await page.getByRole("button", { name: "Edit deck title and introduction", exact: true }).click();
  await modal(page).getByRole("textbox").fill(`Release programme ${randomUUID().slice(0, 4)}`);
  await modal(page).getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  const column = page.locator(".creator-column[data-card-template-id]").first();
  const cardId = (await column.getAttribute("data-card-template-id"))!;
  await expect.poll(async () => !!await main.cards().findOne({ cardTemplateId: cardId })).toBe(true);
  await column.locator(".creator-card-title-button").click();
  await modal(page).getByRole("textbox").fill("Release practice");
  await (await catalogue(page)).getByRole("option", { name: "Companion tip Basics", exact: true }).click();
  await (await catalogue(page)).getByRole("option", { name: `Release tip ${seriesName}`, exact: true }).click();
  await modal(page).getByRole("button", { name: "Move Release tip up", exact: true }).click();
  expect((await main.cards().findOne({ cardTemplateId: cardId }))!.draft!.infoCardIds ?? []).toEqual([]);
  await modal(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await main.cards().findOne({ cardTemplateId: cardId }))!.draft!.infoCardIds)
    .toEqual([infoId, companionId]);
  await column.getByRole("combobox", { name: "Card 1 publication visibility", exact: true }).selectOption("public");
  await column.getByRole("button", { name: "Publish Card 1", exact: true }).click();
  await confirmPublic(page);
  await expect(column.getByRole("button", { name: "Publish Card 1", exact: true })).toHaveText("Published");
  await page.getByRole("combobox", { name: "Deck publication visibility", exact: true }).selectOption("public");
  await page.getByRole("button", { name: "Publish Deck", exact: true }).click();
  await confirmPublic(page);
  await expect(page.getByRole("button", { name: "Publish Deck", exact: true })).toHaveText("Published");
  const deckId = new URL(page.url()).pathname.split("/").at(-1)!;
  expect((await main.getCardVersion(cardId, 1))!.content.infoCardIds).toEqual([infoId, companionId]);
  expect((await main.getDeckVersion(deckId, 1))!.content.cards).toEqual([{ cardTemplateId: cardId, cardVersionAtPublish: 1 }]);

  await enter(page, deckId, false);
  await open(page);
  await expect(current(page)).toHaveAttribute("data-info-card-id", infoId);
  await page.keyboard.press("ArrowDown");
  await expect(current(page)).toHaveAttribute("data-info-card-id", companionId);
  await close(page);
  await expect(page.locator(".step-view-layer")).toHaveCount(1);

  await login(page, "other");
  const follower = (await main.db.collection("users").findOne({ username: "other" }))!._id.toString();
  const manifest = (await (await page.request.get(`/api/library/decks/${deckId}`)).json()).manifest;
  expect((await page.request.post(`/api/library/decks/${deckId}/add`, { data: { manifest } })).ok()).toBe(true);
  await enter(page, deckId, true);
  await open(page);
  await expect(current(page)).toHaveAttribute("data-info-card-id", infoId);
  const before = (await main.getPersonalUser(follower))!.cardsData.find(row => row.cardTemplateId === cardId)!;
  expect(before.cardTemplateVersion).toBe(1);

  // Independent publication must neither mutate an open consultation nor adopt
  // a new main version. Use the real publication transaction in another actor's
  // backend session; the reading browser remains signed in as the follower.
  await infos.save(actor, infoId, infoRoot.revision, { ...initialInfoContent, title: "Fresh tip", body: "A newly published explanation." }, "public");
  await infos.publish(actor, infoId, infoRoot.revision + 1);
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("Release tip");
  await close(page); await open(page);
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("Fresh tip");
  expect((await main.cards().findOne({ cardTemplateId: cardId }))!.latestVersion).toBe(1);
  expect((await main.getPersonalUser(follower))!.cardsData.find(row => row.cardTemplateId === cardId)).toEqual(before);
  await close(page);

  // Attachment order is different: it is a main-card publication which requires
  // the existing explicit adoption contract, unlike Info content updates.
  const mainRoot = (await main.cards().findOne({ cardTemplateId: cardId }))!;
  const published = (await main.getCardVersion(cardId, 1))!.content;
  await main.saveCardDraft(actor, cardId, mainRoot.revision, { ...published, infoCardIds: [companionId, infoId] });
  await main.publishCard(actor, cardId, mainRoot.revision + 1, "Reorder reference cards");
  await enter(page, deckId, true); await open(page);
  await expect(current(page)).toHaveAttribute("data-info-card-id", infoId);
  await close(page);
  await enter(page, deckId, false); await open(page);
  await expect(current(page)).toHaveAttribute("data-info-card-id", companionId);
  await close(page);
  const reviewResponse = await page.request.get(`/api/cards-data/${cardId}/update`);
  expect(reviewResponse.ok()).toBe(true);
  const review = await reviewResponse.json();
  const adopted = await page.request.post(`/api/cards-data/${cardId}/update`, { data: { command: review.review.command } });
  expect(adopted.ok()).toBe(true);
  expect((await adopted.json()).adoptedVersion).toBe(2);
  await enter(page, deckId, true); await open(page);
  await expect(current(page)).toHaveAttribute("data-info-card-id", companionId);
  await page.keyboard.press("ArrowDown");
  await expect(current(page).locator("[data-info-card-title]")).toHaveText("Fresh tip");
  const after = (await main.getPersonalUser(follower))!;
  expect(after.decksData.find(row => row.deckTemplateId === deckId)!.deckTemplateVersion).toBe(1);
  expect(after.cardsData.find(row => row.cardTemplateId === cardId)!.items).toEqual(before.items);
  await page.screenshot({ path: testInfo.outputPath("published-adopted-consultation.png") });
});

test("newer public metadata must not regress when an older selected private publication response arrives last", async ({ page }) => {
  const id = randomUUID();
  await infos.create(actor, id);
  await infos.save(actor, id, 0, { title: "Delayed tip", body: "Keep the sign.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  await infos.publish(actor, id, 1);
  const content = { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), infoCardIds: [id] };
  const card = await main.createCardDraft(actor, content, "private");
  const deck = await main.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Delayed metadata", cards: [{ cardTemplateId: card.cardTemplateId }] }, "private");
  await login(page);
  await page.goto(`/creator/edit/${deck.deckTemplateId}`);
  await page.getByRole("combobox", { name: "Deck publication visibility", exact: true }).selectOption("public");

  let release!: () => void, captured!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { captured = resolve; });
  await page.route(`**/api/info-cards/${id}/publication`, async route => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const original = await response.json();
    expect(original.version).toBe(1); expect(original.visibility).toBe("private");
    captured(); await held;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.locator(".creator-card-title-button").first().click();
  await requested;
  const privateRoot = await infos.owner(actor, id);
  await infos.save(actor, id, privateRoot.revision, { title: "Delayed tip", body: "Keep the sign.", seriesId: "demo-series-owner", mediaItem: null }, "public");
  await infos.publish(actor, id, privateRoot.revision + 1);
  const list = await catalogue(page);
  await expect(list.getByRole("option", { name: "Delayed tip Basics", exact: true })).toHaveCount(1);
  await expect(modal(page).getByRole("status")).toHaveCount(0);
  const selected = modal(page).getByRole("list", { name: "Attached Info Cards", exact: true });
  await expect(selected).toContainText("Delayed tip");
  const late = page.waitForResponse(response => response.url().includes(`/api/info-cards/${id}/publication`));
  release(); await (await late).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(selected).toContainText("Delayed tip");
  await expect(modal(page).getByRole("status")).toHaveCount(0);
});

test("an older catalogue cannot replace newer selected-publication metadata or eligibility", async ({ page }) => {
  const id = randomUUID();
  await infos.create(actor, id);
  await infos.save(actor, id, 0, { title: "Delayed tip", body: "Keep the sign.", seriesId: "demo-series-owner", mediaItem: null }, "private");
  await infos.publish(actor, id, 1);
  const card = await main.createCardDraft(actor, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), infoCardIds: [id] }, "private");
  const deck = await main.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: "Delayed catalogue", cards: [{ cardTemplateId: card.cardTemplateId }] }, "private");
  await login(page); await page.goto(`/creator/edit/${deck.deckTemplateId}`);
  await page.getByRole("combobox", { name: "Deck publication visibility", exact: true }).selectOption("public");

  let releaseSelected!: () => void, releaseCatalogue!: () => void, captured!: () => void;
  const selectedGate = new Promise<void>(resolve => { releaseSelected = resolve; });
  const catalogueGate = new Promise<void>(resolve => { releaseCatalogue = resolve; });
  const oldCatalogueReady = new Promise<void>(resolve => { captured = resolve; });
  await page.route(`**/api/info-cards/${id}/publication`, async route => {
    await selectedGate;
    const response = await route.fetch();
    expect((await response.json()).version).toBe(2);
    await route.fulfill({ response });
  });
  await page.route("**/api/library/info-cards?*", async route => {
    const response = await route.fetch();
    const old = (await response.json()).items.find((info: { infoCardId: string }) => info.infoCardId === id);
    expect(old.version).toBe(1); expect(old.visibility).toBe("private");
    captured(); await catalogueGate;
    await route.fulfill({ response });
  }, { times: 1 });
  try {
    await page.locator(".creator-card-title-button").first().click();
    await modal(page).getByRole("button", { name: "Add Info Card", exact: true }).click();
    await oldCatalogueReady;
    const root = await infos.owner(actor, id);
    await infos.save(actor, id, root.revision, { title: "Public tip", body: "Keep the sign.", seriesId: "demo-series-owner", mediaItem: null }, "public");
    await infos.publish(actor, id, root.revision + 1);
    releaseSelected();
    const selected = modal(page).getByRole("list", { name: "Attached Info Cards", exact: true });
    await expect(selected).toContainText("Public tip");
    await expect(modal(page).getByRole("status")).toHaveCount(0);
    releaseCatalogue();
    const list = page.getByRole("listbox", { name: "Published Info Cards", exact: true });
    await expect(list).toHaveAttribute("aria-busy", "false");
    await expect(list.getByRole("option", { name: "Public tip Basics", exact: true })).toHaveCount(1);
    await expect(selected).toContainText("Public tip");
    await expect(modal(page).getByRole("status")).toHaveCount(0);
    await expect(selected.getByRole("button", { name: "Remove attachment Public tip", exact: true })).toBeVisible();
  } finally { releaseSelected(); releaseCatalogue(); }
});
