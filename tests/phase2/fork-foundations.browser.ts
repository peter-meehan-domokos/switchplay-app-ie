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
