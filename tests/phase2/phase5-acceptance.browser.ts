import { libraryDeckAction } from "./deck-menu-helpers";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { geometry } from "./helpers/presentationGeometry";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function fixture(cardOwnedByViewer = false) {
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), viewer = process.env.PHASE2_USER_ID!;
  const creator = (await repo.users().findOne({ username: "other" }))!._id.toString();
  const content = createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]);
  const card = await repo.createCardDraft(cardOwnedByViewer ? viewer : creator, {
    ...content,
    steps: content.steps.map((step, index) => ({ ...step, title: `Activity ${index + 1}`, description: `Instruction ${index + 1}` })),
    intro: { title: `Acceptance practice ${randomUUID()}`, description: "Canonical instruction", mediaItem: null },
  }, "public");
  await repo.publishCard(card.ownerUserId, card.cardTemplateId, 0);
  const deck = await repo.createDeckDraft(creator, { ...createDefaultDeckContent([]),
    title: `Acceptance programme ${randomUUID()}`, cards: [{ cardTemplateId: card.cardTemplateId }],
  }, "public");
  await repo.publishDeck(creator, deck.deckTemplateId, 0);
  return { repo, viewer, creator, card, deck };
}
async function login(page: Page, identifier: string) {
  expect((await page.request.post("/api/auth/login", { data: { identifier, password: "local-test-only" } })).ok()).toBe(true);
}
async function editCardTitle(page: Page, id: string, title: string) {
  await page.locator(`[data-card-template-id="${id}"] .creator-card-title-button`).click();
  await page.locator(".creator-modal textarea").fill(title);
  await page.locator(".creator-modal").getByRole("button", { name: "Save", exact: true }).click();
}

test("offline browser journey adds, adopts an owner update, then publishes a media-first continuity copy without resetting source state", async ({ page, context }, testInfo) => {
  const f = await fixture(), blocked = new Set<string>();
  // This blocks external browser traffic, not loopback API/provider traffic.
  // Mongo/runtime dependencies are verified separately with runtime downloads disabled.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      blocked.add(`${url.origin}${url.pathname}`); await route.abort("internetdisconnected");
    } else await route.continue();
  });
  try {
    await login(page, "phase2"); await page.goto(`/library/${f.deck.deckTemplateId}`);
    const before = (await f.repo.getPersonalUser(f.viewer))!;
    await expect(page.locator(".working-update-button, .step-progress-hit-area, .card-target-date-value")).toHaveCount(0);
    expect(await f.repo.getPersonalUser(f.viewer)).toEqual(before);
    await (await libraryDeckAction(page, "Add to My Decks")).click();
    await expect((await libraryDeckAction(page, "Open in My Decks"))).toBeVisible();
    const added = (await f.repo.getPersonalUser(f.viewer))!;
    const membership = added.decksData.find((data) => data.deckTemplateId === f.deck.deckTemplateId)!;
    expect(membership.openedAt).toBe(null); expect(membership.cadenceAnchorDate).toBe(null);
    expect(added.cardsData.find((data) => data.cardTemplateId === f.card.cardTemplateId)!.targetDate).toBe(null);
    await (await libraryDeckAction(page, "Open in My Decks")).click();
    await expect(page).toHaveURL(new RegExp(`/decks\\?openDeck=${f.deck.deckTemplateId}`));
    await expect(page.locator(".deck-detail h1")).toHaveText(f.deck.draft!.title);
    await page.locator(".deck-card.is-active").press("Enter");
    await geometry(page, [".focused-card-surface--front"]);
    const saved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.request().postDataJSON()?.type === "completion", { timeout: 15000 });
    await page.locator(".focused-card-surface--front button.step-progress-hit-area").first().click();
    expect((await saved).ok()).toBe(true);
    const sourceState = (await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.card.cardTemplateId)!;

    // The real owner edits/publishes through Creator, without personal membership.
    await login(page, "other"); await page.goto(`/creator/edit/${f.deck.deckTemplateId}?returnTo=library&returnDeckId=${f.deck.deckTemplateId}`);
    await editCardTitle(page, f.card.cardTemplateId, "Owner improvement");
    const publish = page.getByRole("button", { name: "Publish Card 1", exact: true });
    await expect(publish).toBeEnabled(); await publish.click(); await expect(publish).toHaveText("Published");
    expect((await f.repo.cards().findOne({ cardTemplateId: f.card.cardTemplateId }))!.latestVersion).toBe(2);
    expect((await f.repo.getDeckVersion(f.deck.deckTemplateId, 1))!.content.cards[0].cardVersionAtPublish).toBe(1);

    await login(page, "phase2"); await page.goto(`/decks?openDeck=${f.deck.deckTemplateId}`);
    await page.locator(".deck-card.is-active .working-card-update").click();
    const update = page.getByRole("dialog", { name: /^Update / });
    await expect(update).toContainText("everywhere you use it");
    await update.getByRole("button", { name: "Update", exact: true }).click();
    await expect(update).toHaveCount(0); await expect(page.locator(".active-card-identity")).toContainText("Owner improvement");
    const adopted = (await f.repo.getPersonalUser(f.viewer))!.cardsData.find((data) => data.cardTemplateId === f.card.cardTemplateId)!;
    expect(adopted.cardTemplateVersion).toBe(2); expect(adopted.items).toEqual(sourceState.items); expect(adopted.targetDate).toBe(sourceState.targetDate);

    const working = await (await page.request.get(`/api/decks-data/${f.deck.deckTemplateId}`)).json();
    expect(working.permissions.canEditDeck).toBe(false);
    await page.getByRole("button", { name: "Deck menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.getByRole("dialog", { name: "Edit your own Deck" }).getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/decks\\?openDeck=${f.deck.deckTemplateId}`));
    expect(await f.repo.decks().countDocuments({ ownerUserId: f.viewer, "forkedFrom.deckTemplateId": f.deck.deckTemplateId })).toBe(0);
    await page.getByRole("button", { name: "Deck menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.getByRole("dialog", { name: "Edit your own Deck" }).getByRole("button", { name: "Continue editing", exact: true }).click();
    await page.locator('.creator-card-intro-media-slot input[type="file"]').setInputFiles({ name: "continuing.mp4", mimeType: "video/mp4", buffer: Buffer.from("local mock media") });
    await page.getByRole("dialog", { name: "Edit your own Card" }).getByRole("button", { name: "Continue editing", exact: true }).click();
    await expect.poll(async () => (await f.repo.cards().findOne({ ownerUserId: f.viewer, "forkedFrom.cardTemplateId": f.card.cardTemplateId }))?.draft?.intro.mediaItem?.description).toBe("continuing.mp4");
    await page.locator(".creator-back-link").click(); await page.getByRole("button", { name: "Publish and leave", exact: true }).click();
    const fork = (await f.repo.decks().findOne({ ownerUserId: f.viewer, "forkedFrom.deckTemplateId": f.deck.deckTemplateId }))!;
    await expect(page).toHaveURL(new RegExp(`/decks\\?openDeck=${fork.deckTemplateId}`));
    await expect(page.locator(".deck-detail h1")).toBeVisible();
    const card = (await f.repo.cards().findOne({ ownerUserId: f.viewer, "forkedFrom.cardTemplateId": f.card.cardTemplateId }))!;
    const user = (await f.repo.getPersonalUser(f.viewer))!, copied = user.cardsData.find((data) => data.cardTemplateId === card.cardTemplateId)!;
    expect(user.cardsData.find((data) => data.cardTemplateId === f.card.cardTemplateId)).toEqual(adopted);
    expect(copied.items.map((item) => item.completionStatus)).toEqual(adopted.items.map((item) => item.completionStatus));
    expect(copied.targetDate).toBe(adopted.targetDate); expect(copied.historySourceCardTemplateId).toBe(f.card.cardTemplateId);
    expect(user.decksData.find((data) => data.deckTemplateId === f.deck.deckTemplateId)!.archivedAt).toBe(null);
    expect(card.latestVersion).toBe(1);
    expect((await f.repo.decks().findOne({ deckTemplateId: fork.deckTemplateId }))!.latestVersion).toBe(1);
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("switchplay:creator-operation:")).length)).toBe(0);
    await login(page, "other");
    expect((await page.request.get(`/api/library/decks/${fork.deckTemplateId}`)).status()).toBe(403);
    expect((await page.request.get(`/api/decks-data/${fork.deckTemplateId}`)).ok()).toBe(false);
  } finally {
    await testInfo.attach("blocked-external-browser-requests", { body: JSON.stringify([...blocked], null, 2), contentType: "application/json" });
  }
});

test("an owned Card in a foreign Library Deck publishes in place without creating a Deck copy or personal records", async ({ page }) => {
  const f = await fixture(true); await login(page, "phase2");
  const before = await f.repo.getPersonalUser(f.viewer), original = await f.repo.getDeckVersion(f.deck.deckTemplateId, 1);
  await page.goto(`/library/${f.deck.deckTemplateId}`); await page.getByRole("button", { name: "Deck menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Continue editing", exact: true }).click();
  await editCardTitle(page, f.card.cardTemplateId, "Owned refinement in shared programme");
  await expect(page.getByRole("dialog", { name: "Edit your own Card" })).toHaveCount(0);
  await page.locator(".creator-back-link").click(); await page.getByRole("button", { name: "Publish and leave", exact: true }).click();
  await expect(page).toHaveURL(`/library/${f.deck.deckTemplateId}`);
  expect((await f.repo.cards().findOne({ cardTemplateId: f.card.cardTemplateId }))!.latestVersion).toBe(2);
  expect(await f.repo.getDeckVersion(f.deck.deckTemplateId, 1)).toEqual(original);
  expect(await f.repo.cards().countDocuments({ "forkedFrom.cardTemplateId": f.card.cardTemplateId })).toBe(0);
  expect(await f.repo.decks().countDocuments({ "forkedFrom.deckTemplateId": f.deck.deckTemplateId })).toBe(0);
  expect(await f.repo.getPersonalUser(f.viewer)).toEqual(before);
});
