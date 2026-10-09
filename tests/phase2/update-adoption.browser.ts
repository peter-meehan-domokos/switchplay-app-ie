import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { deckDraftContent } from "../../src/lib/cards/publicationRules";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function fixture() {
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!;
  const c = await repo.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: `Update practice ${randomUUID()}`, description: "", mediaItem: null } }, "public");
  await repo.publishCard(owner, c.cardTemplateId, 0);
  const d = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: `Update programme ${randomUUID()}`, cards: [{ cardTemplateId: c.cardTemplateId }] }, "public");
  await repo.publishDeck(owner, d.deckTemplateId, 0);
  return { repo, owner, cardId: c.cardTemplateId, deckId: d.deckTemplateId };
}
async function publishCard(f: Awaited<ReturnType<typeof fixture>>, note = "Updated instructions") {
  const root = (await f.repo.cards().findOne({ cardTemplateId: f.cardId }))!, content = (await f.repo.getCardVersion(f.cardId, root.latestVersion))!.content;
  await f.repo.saveCardDraft(f.owner, f.cardId, root.revision, { ...content, intro: { ...content.intro, title: `${content.intro.title} revised` } });
  await f.repo.publishCard(f.owner, f.cardId, root.revision + 1, note);
}
async function publishDeck(f: Awaited<ReturnType<typeof fixture>>) {
  const root = (await f.repo.decks().findOne({ deckTemplateId: f.deckId }))!, content = deckDraftContent((await f.repo.getDeckVersion(f.deckId, root.latestVersion))!.content);
  await f.repo.saveDeckDraft(f.owner, f.deckId, root.revision, { ...content, title: `${content.title} revised` }); await f.repo.publishDeck(f.owner, f.deckId, root.revision + 1, "Updated programme");
}

test("Update APIs authenticate, reject malformed commands and isolate the actor that reviewed adoption", async ({ request }) => {
  const f = await fixture(), cardUrl = `/api/cards-data/${f.cardId}/update`, deckUrl = `/api/decks-data/${f.deckId}/update`;
  for (const url of [cardUrl, deckUrl]) { expect((await request.get(url)).status()).toBe(401); expect((await request.post(url, { data: {} })).status()).toBe(401); }
  await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  expect((await request.post(cardUrl, { data: {} })).status()).toBe(400);
  expect((await request.get(cardUrl)).status()).toBe(403);
  expect((await request.get(cardUrl, { headers: { "X-Personal-Viewer": f.owner } })).status()).toBe(409);
  const manifest = (await (await request.get(`/api/library/decks/${f.deckId}`)).json()).manifest;
  expect((await request.post(`/api/library/decks/${f.deckId}/add`, { data: { manifest } })).ok()).toBeTruthy();
  await publishCard(f); const result = await (await request.get(cardUrl)).json();
  expect((await request.post(deckUrl, { data: { command: result.review.command } })).status()).toBe(400);
  await request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  const before = await f.repo.getPersonalUser(f.owner);
  expect((await request.post(cardUrl, { data: { command: result.review.command } })).status()).toBe(409);
  expect(await f.repo.getPersonalUser(f.owner)).toEqual(before);
});

test("Card review/adoption returns actor-scoped notes and coherent retry outcomes without advancing Deck adoption", async ({ request }) => {
  const f = await fixture(); await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const manifest = (await (await request.get(`/api/library/decks/${f.deckId}`)).json()).manifest;
  await request.post(`/api/library/decks/${f.deckId}/add`, { data: { manifest } }); await publishCard(f);
  const base = `/api/cards-data/${f.cardId}/update`, review = await request.get(base);
  expect(review.headers()["cache-control"]).toBe("private, no-store");
  // Next adds its own routing Vary tokens. Cookie isolation is the contract;
  // exclusivity would incorrectly reject a valid HTTP token list.
  expect(review.headers().vary.split(",").map((token) => token.trim().toLowerCase())).toContain("cookie");
  const result = await review.json(); expect(result.review.notes).toEqual([{ version: 2, updateNote: "Updated instructions" }]);
  const response = await request.post(base, { data: { command: result.review.command } }); expect(response.ok()).toBeTruthy();
  const adopted = await response.json(); expect(adopted.viewerUserId).toBe(result.viewerUserId); expect(adopted.adoptedVersion).toBe(2); expect(adopted.outcome).toBe("updated");
  const before = await f.repo.getPersonalUser(result.viewerUserId);
  expect((await (await request.post(base, { data: { command: result.review.command } })).json()).outcome).toBe("already-adopted");
  expect(await f.repo.getPersonalUser(result.viewerUserId)).toEqual(before);
  expect((await (await request.get(`/api/decks-data/${f.deckId}`)).json()).adoptedVersion).toBe(1);
});

test("stale Update API returns Refresh/Cancel information and never silently adopts the newer unreviewed publication", async ({ request }) => {
  const f = await fixture(); await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const manifest = (await (await request.get(`/api/library/decks/${f.deckId}`)).json()).manifest;
  await request.post(`/api/library/decks/${f.deckId}/add`, { data: { manifest } }); await publishCard(f);
  const base = `/api/cards-data/${f.cardId}/update`, result = await (await request.get(base)).json(); await publishCard(f, "Unreviewed publication");
  const before = await f.repo.getPersonalUser(result.viewerUserId), response = await request.post(base, { data: { command: result.review.command } });
  expect(response.status()).toBe(409); const conflict = await response.json(); expect(conflict.code).toBe("UPDATE_REVIEW_CONFLICT"); expect(conflict.refreshRequired).toBe(true);
  expect(conflict.latestReview.review.command.targetVersion).toBe(3); expect(await f.repo.getPersonalUser(result.viewerUserId)).toEqual(before);
});

test("Deck Update API leaves first-open initialization pending and delayed retry preserves a later Archive", async ({ request }) => {
  const f = await fixture(); await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const manifest = (await (await request.get(`/api/library/decks/${f.deckId}`)).json()).manifest;
  const added = await (await request.post(`/api/library/decks/${f.deckId}/add`, { data: { manifest } })).json(); await publishDeck(f);
  const base = `/api/decks-data/${f.deckId}/update`, result = await (await request.get(base)).json();
  const response = await request.post(base, { data: { command: result.review.command } }); expect(response.ok()).toBeTruthy(); expect((await response.json()).adoptedVersion).toBe(2);
  const user = (await f.repo.getPersonalUser(added.viewerUserId))!, data = user.decksData.find((d) => d.deckTemplateId === f.deckId)!;
  expect(data.openedAt).toBeNull(); expect(data.cadenceAnchorDate).toBeNull(); expect(user.cardsData.find((c) => c.cardTemplateId === f.cardId)!.targetDate).toBeNull();
  await request.patch(`/api/decks-data/${f.deckId}`, { data: { type: "archive" } }); const archived = await f.repo.getPersonalUser(added.viewerUserId);
  const retry = await (await request.post(base, { data: { command: result.review.command } })).json(); expect(retry.outcome).toBe("already-adopted"); expect(retry.membershipState).toBe("archived");
  expect(await f.repo.getPersonalUser(added.viewerUserId)).toEqual(archived);
});
