import { test, expect, type APIRequestContext } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../../src/lib/cards/forks";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { deckDraftContent } from "../../src/lib/cards/publicationRules";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function setup(request: APIRequestContext) {
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = new ObjectId(process.env.PHASE2_USER_ID!).toHexString();
  const bob = (await repo.db.collection("users").findOne({ username: "other" }))!._id.toString();
  const content = { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Source practice", description: null, mediaItem: null } };
  const card = await repo.createCardDraft(bob, content, "public"), other = await repo.createCardDraft(bob,
    { ...content, steps: createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]).steps }, "public");
  await repo.publishCard(bob, card.cardTemplateId, 0); await repo.publishCard(bob, other.cardTemplateId, 0);
  const deck = await repo.createDeckDraft(bob, { ...createDefaultDeckContent([]), title: "Source programme", cards: [card, other].map((root) => ({ cardTemplateId: root.cardTemplateId })) }, "public");
  await repo.publishDeck(bob, deck.deckTemplateId, 0);
  await request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  const cardId = randomUUID(), stepIds = [randomUUID(), randomUUID(), randomUUID()], source = { cardTemplateId: card.cardTemplateId, version: 1 };
  const copied = forkCardContent(content, source, stepIds);
  return { repo, actor, bob, deck, card, cardId, source, stepIds, edit: { ...copied, intro: { ...copied.intro, title: "Edited sparse fork" } } };
}

test("authenticated backend fork/publication/history supports continuity and retained foreign references without UI", async ({ page }) => {
  const { repo, actor, deck, card, cardId, source, stepIds, edit } = await setup(page.request);
  await repo.ensureDeckData(actor, deck.deckTemplateId, 1); await repo.openWorkingDeck(actor, deck.deckTemplateId, "2026-10-07");
  await repo.setCompletion(actor, deck.deckTemplateId, card.cardTemplateId, card.draft!.steps[0].stepId, "skipped");
  const before = await repo.getPersonalUser(actor), deckId = randomUUID(), context = { kind: "my-decks", deckTemplateId: deck.deckTemplateId };
  const body = { sourceVersion: 1, deckTemplateId: deckId, content: deck.draft, context,
    cardFork: { source, cardTemplateId: cardId, stepIds, content: edit, context } };
  const create = await page.request.post(`/api/deck-templates/${deck.deckTemplateId}/fork`, { data: body });
  expect(create.status()).toBe(200);
  expect(await repo.getPersonalUser(actor)).toEqual(before);
  expect((await page.request.post(`/api/deck-templates/${deck.deckTemplateId}/fork`, { data: body })).status()).toBe(200);
  const cardPublish = await page.request.patch(`/api/card-templates/${cardId}`, { data: { type: "publish", revision: 0 } });
  expect(cardPublish.status()).toBe(200);
  expect((await page.request.patch(`/api/card-templates/${cardId}`, { data: { type: "publish", revision: 0 } })).status()).toBe(200);
  const review = await (await page.request.get(`/api/deck-templates/${deckId}/publish?revision=0`)).json();
  const publishBody = { revision: 0, review, acceptCardDrafts: true, forkEntry: { enterMyDecks: true } };
  const publish = await page.request.post(`/api/deck-templates/${deckId}/publish`, { data: publishBody });
  expect(publish.status()).toBe(200); expect(await publish.json()).toEqual({ deckTemplateId: deckId, publishedVersion: 1 });
  expect((await page.request.post(`/api/deck-templates/${deckId}/publish`, { data: publishBody })).status()).toBe(200);
  const changedReview = { ...review, cards: review.cards.map((card: { latestVersion: number }) => ({ ...card, latestVersion: card.latestVersion + 1 })) };
  expect((await page.request.post(`/api/deck-templates/${deckId}/publish`, { data: { ...publishBody, review: changedReview } })).status()).toBe(409);
  const history = await page.request.get(`/api/cards-data/${cardId}/history`);
  expect(history.status()).toBe(200);
  const historyBody = await history.json();
  expect(historyBody.segments.map((item: { cardTemplateId: string }) => item.cardTemplateId)).toEqual([cardId, card.cardTemplateId]);
  for (const segment of historyBody.segments) {
    expect(segment.currentAdoptedCardTemplateVersion).toBe(1);
    expect(segment.eventVersionAttribution).toBe("not-recorded");
    expect(segment).not.toHaveProperty("cardTemplateVersion");
  }
  expect((await repo.getPersonalUser(actor))!.cardsData.find((data) => data.cardTemplateId === cardId)!.items[0].completionStatus).toBe("skipped");
  expect(await repo.deckVersions().countDocuments({ deckTemplateId: deckId })).toBe(1);
  expect(await repo.cardVersions().countDocuments({ cardTemplateId: cardId })).toBe(1);
  const saved = deckDraftContent((await repo.getDeckVersion(deckId, 1))!.content);
  await repo.saveDeckDraft(actor, deckId, 1, { ...saved, title: "Later fork Deck publication" });
  const laterReview = await (await page.request.get(`/api/deck-templates/${deckId}/publish?revision=2`)).json();
  const later = await page.request.post(`/api/deck-templates/${deckId}/publish`, { data: { revision: 2, review: laterReview, acceptCardDrafts: true } });
  expect(later.status()).toBe(200); expect(await later.json()).toEqual({ deckTemplateId: deckId, publishedVersion: 2 });
  expect((await page.request.post(`/api/deck-templates/${deckId}/publish`, { data: publishBody })).status()).toBe(200);
  expect(await repo.deckVersions().countDocuments({ deckTemplateId: deckId })).toBe(2);
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  expect((await page.request.get(`/api/cards-data/${cardId}/history`)).status()).not.toBe(200);
  expect((await page.request.patch(`/api/card-templates/${cardId}`, { data: { type: "publish", revision: 0 } })).status()).toBe(403);
});

test("Library-origin Card fork API creates canonical-only v1 without source personal state", async ({ page }) => {
  const { repo, actor, card, cardId, stepIds, edit } = await setup(page.request);
  const before = await repo.getPersonalUser(actor);
  const create = await page.request.post(`/api/card-templates/${card.cardTemplateId}/fork`, { data: {
    sourceVersion: 1, cardTemplateId: cardId, stepIds, content: edit, context: { kind: "library" },
  } });
  expect(create.status()).toBe(200);
  expect((await page.request.patch(`/api/card-templates/${cardId}`, { data: { type: "publish", revision: 0 } })).status()).toBe(200);
  expect(await repo.getPersonalUser(actor)).toEqual(before);
});

test("Deck fork API denies private-era and unclassified versions after public promotion; owner and public versions remain accessible", async ({ page }) => {
  const { repo, bob, card } = await setup(page.request);
  const source = await repo.createDeckDraft(bob, { ...createDefaultDeckContent([]), title: "Private-era Deck", cards: [{ cardTemplateId: card.cardTemplateId }] });
  await repo.publishDeck(bob, source.deckTemplateId, 0);
  await repo.saveDeckDraft(bob, source.deckTemplateId, 1, { ...source.draft!, title: "Public Deck" }, "public");
  await repo.publishDeck(bob, source.deckTemplateId, 2);
  const fork = (version: number) => page.request.post(`/api/deck-templates/${source.deckTemplateId}/fork`, { data: {
    sourceVersion: version, deckTemplateId: randomUUID(), content: { ...source.draft!, title: "Adapted Deck" }, context: { kind: "library" },
  } });
  const denied = await fork(1);
  expect(denied.status()).toBe(403); expect((await denied.json()).code).toBe("DECK_VERSION_FORBIDDEN");
  expect((await fork(2)).status()).toBe(200);
  await repo.deckVersions().updateOne({ deckTemplateId: source.deckTemplateId, version: 1 }, { $unset: { visibility: "" } });
  expect((await fork(1)).status()).toBe(403);
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  expect((await fork(1)).status()).toBe(200);
});

for (const origin of ["library", "my-decks"] as const) test(`${origin} fork displays viewer history in working UI without writable media duplication`, async ({ page }) => {
  const { repo, actor, deck, card, cardId, stepIds, edit } = await setup(page.request);
  await repo.ensureDeckData(actor, deck.deckTemplateId, 1);
  await repo.setCompletion(actor, deck.deckTemplateId, card.cardTemplateId, card.draft!.steps[0].stepId, "skipped");
  await repo.setSignalReading(actor, deck.deckTemplateId, card.cardTemplateId, card.draft!.steps[0].stepId, 7);
  await repo.setReflection(actor, deck.deckTemplateId, card.cardTemplateId, "My retained reflection");
  const image = { id: "source-evidence", mediaType: "image", provider: "cloudflare-r2", assetId: `user-cards/${actor}/${card.cardTemplateId}/source.png`,
    src: new URL("/history-evidence.png", process.env.PHASE2_BASE_URL!).toString(), description: "Retained source evidence" };
  await page.route("**/history-evidence.png", (route) => route.fulfill({ contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=", "base64") }));
  await repo.users().updateOne({ _id: new ObjectId(actor) }, { $set: {
    "cardsData.$[card].mediaItems": [image],
    "cardsData.$[card].tests": [{ id: "source-test", date: "2026-10-07", result: true, createdAt: new Date() }],
    "cardsData.$[card].chats": [{ id: "source-chat", deckTemplateId: deck.deckTemplateId,
      comments: [{ id: "source-comment", creatorId: actor, createdAt: "2026-10-07", text: "Retained original observation", isRetained: true }] }],
  } }, { arrayFilters: [{ "card.cardTemplateId": card.cardTemplateId }] });
  const context = origin === "library" ? { kind: origin } : { kind: origin, deckTemplateId: deck.deckTemplateId };
  const create = await page.request.post(`/api/card-templates/${card.cardTemplateId}/fork`, { data: { sourceVersion: 1, cardTemplateId: cardId, stepIds, content: edit, context } });
  expect(create.status()).toBe(200);
  expect((await page.request.patch(`/api/card-templates/${cardId}`, { data: { type: "publish", revision: 0 } })).status()).toBe(200);
  const personal = (await repo.getPersonalUser(actor))!.cardsData.find((data) => data.cardTemplateId === cardId)!;
  expect(personal.reflection).toBe("My retained reflection"); expect(personal.items[0].completionStatus).toBe("skipped");
  expect(personal.signalReadings[0].reading).toBe(7);
  expect(personal.mediaItems).toEqual([]); expect(personal.chats).toEqual([]); expect(personal.tests).toEqual([]);
  const programme = await repo.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: `History programme ${origin}`, cards: [{ cardTemplateId: cardId }] });
  await repo.publishDeck(actor, programme.deckTemplateId, 0);
  await repo.archiveDeckData(actor, deck.deckTemplateId);
  const video = { id: "source-video", mediaType: "video", provider: "cloudflare-stream", assetId: `fixture-${randomUUID()}`,
    src: "https://example.invalid/evidence.m3u8", description: "Retained video evidence" };
  await repo.users().updateOne({ _id: new ObjectId(actor) }, { $push: { "cardsData.$[card].mediaItems": video } }, { arrayFilters: [{ "card.cardTemplateId": card.cardTemplateId }] });
  const statusUrl = `/api/media/stream/status?scope=user-card&deckTemplateId=${programme.deckTemplateId}&cardTemplateId=${card.cardTemplateId}&assetId=${video.assetId}`;
  expect((await page.request.get(statusUrl)).status()).toBe(200);
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  expect((await page.request.get(statusUrl)).status()).toBe(403);
  expect((await page.request.delete(`/api/cards-data/${card.cardTemplateId}/media/${video.id}`)).status()).toBe(403);
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  expect((await page.request.delete(`/api/cards-data/${card.cardTemplateId}/media/${video.id}`)).status()).toBe(200);
  // Readable history must survive individual corrupt events and comments without
  // making the source or this adapted programme unavailable.
  await repo.users().updateOne({ _id: new ObjectId(actor) }, { $push: {
    "cardsData.$[card].tests": { $each: [
      { id: "recovered-test", date: "2026-10-07", result: false, createdAt: "2026-10-07T12:00:00Z" },
      { id: "bad-test", date: "2026-10-07", result: true, createdAt: "broken" },
    ] },
    "cardsData.$[card].chats.0.comments": { id: "bad-comment", text: { malformed: true } },
  } }, { arrayFilters: [{ "card.cardTemplateId": card.cardTemplateId }] });
  await page.goto(`/decks?openDeck=${programme.deckTemplateId}`);
  await expect(page.getByRole("heading", { name: programme.draft!.title, exact: true })).toBeVisible();
  await page.locator(".deck-card[role=button]").press("Enter");
  const header = page.locator(".focused-card-surface--front .card-title-anchor");
  let previous = "";
  await expect.poll(async () => { const current = JSON.stringify(await header.boundingBox()), stable = current === previous; previous = current; return stable; }).toBe(true);
  const box = (await header.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75 + 220, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
  await expect(page.getByRole("button", { name: "Add media", exact: true })).toBeVisible();
  await expect(page.locator(".focused-card-surface--back").getByText("Retained original observation", { exact: true })).toBeVisible();
  await expect(page.locator(".focused-card-surface--back").getByAltText("Retained source evidence")).toBeVisible();
  await page.getByRole("button", { name: "Add media", exact: true }).click();
  const remove = page.getByRole("dialog", { name: "Card media", exact: true }).getByRole("button", { name: /Remove image Retained source evidence/ });
  await expect(remove).toBeVisible();
  // Another actor cannot delete this user's source-stored item, including when
  // that actor owns the canonical source Card.
  const stranger = await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  expect(stranger.status()).toBe(200);
  expect((await page.request.delete(`/api/cards-data/${card.cardTemplateId}/media/${image.id}`)).status()).toBe(403);
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  await remove.click();
  await expect(remove).toHaveCount(0);
  await expect(page.locator(".focused-card-surface--back").getByAltText("Retained source evidence")).toHaveCount(0);
  expect((await repo.getPersonalUser(actor))!.cardsData.find((data) => data.cardTemplateId === card.cardTemplateId)!.mediaItems).toEqual([]);
  expect((await repo.getPersonalUser(actor))!.cardsData.find((data) => data.cardTemplateId === cardId)!.mediaItems).toEqual([]);
  const working = await (await page.request.get(`/api/decks-data/${programme.deckTemplateId}`)).json();
  expect(working.cards[0].personalHistory.flatMap((segment: { tests: unknown[] }) => segment.tests)).toHaveLength(2);
  expect(working.cards[0].personalHistory[1].chats[0].deckTemplateId).toBe(deck.deckTemplateId);
  await repo.users().updateOne({ _id: new ObjectId(actor) }, { $set: { "cardsData.$[card].chats": [] } }, { arrayFilters: [{ "card.cardTemplateId": card.cardTemplateId }] });
  await page.reload();
  const refreshed = await (await page.request.get(`/api/decks-data/${programme.deckTemplateId}`)).json();
  expect(refreshed.cards[0].personalHistory[1].mediaItems).toEqual([]);
  expect(refreshed.cards[0].personalHistory[1].chats).toEqual([]);
});

test("My Decks renders an unavailable retained membership alongside valid working Decks", async ({ page }) => {
  const { repo, actor } = await setup(page.request);
  const valid = await repo.createDeckDraft(actor, { ...createDefaultDeckContent([]), title: `Available ${randomUUID()}` });
  await repo.publishDeck(actor, valid.deckTemplateId, 0);
  const before = (await repo.getPersonalUser(actor))!, sample = before.decksData.find((data) => data.deckTemplateId === valid.deckTemplateId)!;
  const missingId = randomUUID();
  await repo.users().updateOne({ _id: new ObjectId(actor) }, { $push: { decksData: { ...sample, deckTemplateId: missingId } } });
  try {
    await page.goto("/decks");
    await expect(page.getByRole("heading", { name: "My decks", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Open ${valid.draft!.title}`, exact: true })).toBeVisible();
    await expect(page.getByText("Unavailable Deck — your membership is retained.")).toBeVisible();
    const response = await page.request.get("/api/decks-data"); expect(response.status()).toBe(200);
    const memberships = await response.json();
    expect(memberships.find((entry: { deckTemplateId: string }) => entry.deckTemplateId === missingId).availability).toBe("unavailable");
    expect((await repo.getPersonalUser(actor))!.decksData.some((data) => data.deckTemplateId === missingId)).toBe(true);
  } finally {
    // Keep later fixture journeys independent; this is disposable test cleanup.
    await repo.users().updateOne({ _id: new ObjectId(actor) }, { $pull: { decksData: { deckTemplateId: missingId } } });
  }
});
