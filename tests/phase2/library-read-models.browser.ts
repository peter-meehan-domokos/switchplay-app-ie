import { expect, test } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
const repo = () => new CardRepository(client.db(process.env.MONGODB_DB!), client);
const actor = () => process.env.PHASE2_USER_ID!;
async function fixture() {
  const repository = repo(), prefix = randomUUID();
  const c = await repository.createCardDraft(actor(), { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
    intro: { title: `Public practice ${prefix}`, description: "Instruction", mediaItem: null } }, "public");
  await repository.publishCard(actor(), c.cardTemplateId, 0);
  const d = await repository.createDeckDraft(actor(), { ...createDefaultDeckContent([]), title: `Library programme ${prefix}`, cards: [{ cardTemplateId: c.cardTemplateId }] }, "public");
  await repository.publishDeck(actor(), d.deckTemplateId, 0);
  const privateDeck = await repository.createDeckDraft(actor(), { ...createDefaultDeckContent([]), title: `PRIVATE ${prefix}` });
  await repository.publishDeck(actor(), privateDeck.deckTemplateId, 0);
  return { repository, cardId: c.cardTemplateId, deckId: d.deckTemplateId, privateDeckId: privateDeck.deckTemplateId };
}

test("Library APIs authenticate, enforce public-only owner reads and reject historical/private query modes", async ({ request }) => {
  const { deckId, privateDeckId } = await fixture();
  for (const url of ["/api/library/decks", `/api/library/decks/${deckId}`, "/api/library/viewer-status"]) {
    const response = await request.get(url);
    expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toBe("private, no-store");
  }
  expect((await request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } })).ok()).toBeTruthy();
  expect((await request.get(`/api/library/decks/${deckId}`)).ok()).toBeTruthy();
  expect((await request.get(`/api/library/decks/${privateDeckId}`)).status()).toBe(403);
  expect((await request.get(`/api/library/decks/${deckId}?version=1`)).status()).toBe(400);
  expect((await request.get("/api/library/decks?actor=other")).status()).toBe(400);
  expect((await request.get("/api/library/decks?limit=51")).status()).toBe(400);
  expect((await request.get("/api/library/decks?cursor=invalid")).status()).toBe(400);
  expect((await request.post("/api/library/decks", { data: {} })).status()).toBe(405);
  const collection = await request.get("/api/library/decks?limit=50");
  expect(collection.headers()["vary"].split(",").map((value) => value.trim().toLowerCase())).toContain("cookie");
  expect((await collection.json()).entries.some((entry: { deckTemplateId: string }) => entry.deckTemplateId === privateDeckId)).toBe(false);
});

test("Library content remains canonical while viewer status changes across accounts; browsing makes no personal writes", async ({ request }) => {
  const { repository, deckId, cardId } = await fixture();
  await repository.ensureDeckData(actor(), deckId, 1);
  const before = await repository.getPersonalUser(actor());
  await request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  const canonical = await (await request.get(`/api/library/decks/${deckId}`)).json();
  const statusUrl = `/api/library/viewer-status?deckTemplateId=${deckId}&cardTemplateId=${cardId}`;
  const ownStatus = await request.get(statusUrl), own = await ownStatus.json();
  expect(own.viewerUserId).toBe(actor()); expect(own.decks[0].state).toBe("active"); expect(own.cards[0].activeDecks).toHaveLength(1);
  expect(ownStatus.headers()["cache-control"]).toBe("private, no-store");
  await request.post("/api/auth/logout");
  expect((await request.get(statusUrl)).status()).toBe(401);
  await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const other = await repository.db.collection("users").findOne({ username: "other" });
  const otherBefore = await repository.getPersonalUser(other!._id.toString());
  const otherStatus = await (await request.get(statusUrl)).json();
  expect(otherStatus.viewerUserId).toBe(other!._id.toString()); expect(otherStatus.decks[0].state).toBe("not-added");
  expect(otherStatus.cards[0].hasPersonalData).toBe(false); expect(otherStatus.cards[0].activeDecks).toEqual([]);
  expect(await (await request.get(`/api/library/decks/${deckId}`)).json()).toEqual(canonical);
  await request.get("/api/library/decks");
  expect(await repository.getPersonalUser(actor())).toEqual(before);
  expect(await repository.getPersonalUser(other!._id.toString())).toEqual(otherBefore);
  expect(before!.decksData.find((data) => data.deckTemplateId === deckId)!.openedAt).toBeNull();
  expect(before!.decksData.find((data) => data.deckTemplateId === deckId)!.cadenceAnchorDate).toBeNull();
  expect(await repository.users().countDocuments({ _id: new ObjectId(actor()) })).toBe(1);
});

test("broken public content returns a safe unavailable result without disabling valid Library entries", async ({ request }) => {
  const { repository, deckId, cardId } = await fixture();
  await repository.cards().deleteOne({ cardTemplateId: cardId });
  await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const detail = await request.get(`/api/library/decks/${deckId}`);
  expect(detail.ok()).toBeTruthy(); expect(await detail.json()).toEqual(expect.objectContaining({ availability: "unavailable", reason: "PUBLIC_CONTENT_UNAVAILABLE" }));
  expect(JSON.stringify(await detail.json())).not.toContain(cardId);
  const collection = await request.get("/api/library/decks?limit=50");
  expect(collection.ok()).toBeTruthy(); expect((await collection.json()).entries.find((entry: { deckTemplateId: string }) => entry.deckTemplateId === deckId).availability).toBe("unavailable");
});
