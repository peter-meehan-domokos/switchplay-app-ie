import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { deckDraftContent } from "../../src/lib/cards/publicationRules";

let client: MongoClient;
test.beforeAll(async () => { assertDisposableDatabase(); client = await new MongoClient(process.env.MONGODB_URI!).connect(); });
test.afterAll(async () => { await client?.close(); });
async function fixture() {
  const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), owner = process.env.PHASE2_USER_ID!, ids: string[] = [];
  for (let index = 0; index < 2; index++) {
    const c = await repo.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: `Entry instruction ${randomUUID()}`, description: "", mediaItem: null } }, "public");
    await repo.publishCard(owner, c.cardTemplateId, 0); ids.push(c.cardTemplateId);
  }
  const d = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title: `Entry programme ${randomUUID()}`, cards: ids.map((cardTemplateId) => ({ cardTemplateId })) }, "public");
  await repo.publishDeck(owner, d.deckTemplateId, 0);
  return { repo, owner, id: d.deckTemplateId, ids };
}

test("Library Add/Restore authenticate and reject malformed or identity-mismatched commands", async ({ request }) => {
  const { id } = await fixture(), base = `/api/library/decks/${id}`;
  expect((await request.post(`${base}/add`, { data: {} })).status()).toBe(401);
  expect((await request.post(`${base}/restore`, { data: {} })).status()).toBe(401);
  await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  expect((await request.post(`${base}/add`, { data: { manifest: { deckTemplateId: id, deckVersion: 0, cards: [] } } })).status()).toBe(400);
  expect((await request.post(`${base}/add`, { data: { manifest: { deckTemplateId: "other", deckVersion: 1, cards: [] } } })).status()).toBe(400);
  expect((await request.post(`${base}/restore`, { data: {} })).status()).toBe(400);
  expect((await request.post(`${base}/restore`, { data: { membershipRevision: 0 } })).status()).toBe(400);
});

test("stale Add returns 409 and Refresh information, with no personal membership or partial CardData", async ({ request }) => {
  const { repo, owner, id, ids } = await fixture();
  await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const displayed = (await (await request.get(`/api/library/decks/${id}`)).json()).manifest;
  const content = (await repo.getCardVersion(ids[1], 1))!.content;
  await repo.saveCardDraft(owner, ids[1], 1, { ...content, intro: { ...content.intro, title: "Fresh canonical title" } }); await repo.publishCard(owner, ids[1], 2);
  const response = await request.post(`/api/library/decks/${id}/add`, { data: { manifest: displayed } });
  expect(response.status()).toBe(409); expect(response.headers()["cache-control"]).toBe("private, no-store");
  const error = await response.json(); expect(error.code).toBe("LIBRARY_PREVIEW_CONFLICT"); expect(error.refreshRequired).toBe(true); expect(error.latestManifest.cards[1].version).toBe(2);
  const viewer = await repo.db.collection("users").findOne({ username: "other" });
  expect(viewer!.decksData.some((data: { deckTemplateId: string }) => data.deckTemplateId === id)).toBe(false);
  expect(viewer!.cardsData.some((data: { cardTemplateId: string }) => ids.includes(data.cardTemplateId))).toBe(false);
});

test("Add remains unopened; targeted working open initializes cadence and adopted Card, while Restore and delayed retries preserve archive lifecycle", async ({ request }) => {
  const { repo, id, ids } = await fixture();
  await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const base = `/api/library/decks/${id}`, displayed = (await (await request.get(base)).json()).manifest;
  const added = await request.post(`${base}/add`, { data: { manifest: displayed } }); expect(added.ok()).toBeTruthy();
  const acknowledged = await added.json(); expect(acknowledged.outcome).toBe("added");
  const viewer = (await repo.db.collection("users").findOne({ username: "other" }))!, actor = viewer._id.toString();
  expect(acknowledged.viewerUserId).toBe(actor);
  let user = (await repo.getPersonalUser(actor))!, data = user.decksData.find((item) => item.deckTemplateId === id)!;
  expect(data.openedAt).toBeNull(); expect(data.cadenceAnchorDate).toBeNull(); expect(user.cardsData.filter((item) => ids.includes(item.cardTemplateId)).every((item) => item.targetDate === null)).toBe(true);
  const opened = await request.post("/api/decks-data", { data: { deckTemplateId: id, localDate: "2026-10-08", cardTemplateId: ids[1] } }); expect(opened.ok()).toBeTruthy(); expect((await opened.json()).activeCardId).toBe(ids[1]);
  user = (await repo.getPersonalUser(actor))!; data = user.decksData.find((item) => item.deckTemplateId === id)!;
  expect(data.cadenceAnchorDate).toBe("2026-10-08"); expect(data.activeCardId).toBe(ids[1]); expect(user.cardsData.find((item) => item.cardTemplateId === ids[1])!.targetDate).toBe("2026-10-22");
  await request.patch(`/api/decks-data/${id}`, { data: { type: "archive" } });
  const repeated = await request.post(`${base}/add`, { data: { manifest: displayed } }); expect((await repeated.json()).outcome).toBe("archived");
  const restored = await request.post(`${base}/restore`, { data: { membershipRevision: 1 } }); expect(restored.ok()).toBeTruthy(); expect((await restored.json()).outcome).toBe("restored");
  await request.patch(`/api/decks-data/${id}`, { data: { type: "archive" } });
  expect((await request.post(`${base}/restore`, { data: { membershipRevision: 1 } })).status()).toBe(409);
  expect((await repo.getPersonalUser(actor))!.decksData.find((item) => item.deckTemplateId === id)!.archivedAt).not.toBeNull();
});

test("targeted opening uses the adopted composition and rejects unrelated Card identities", async ({ request }) => {
  const { repo, owner, id, ids } = await fixture();
  await request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const base = `/api/library/decks/${id}`, displayed = (await (await request.get(base)).json()).manifest;
  await request.post(`${base}/add`, { data: { manifest: displayed } });
  await repo.saveDeckDraft(owner, id, 1, { ...deckDraftContent((await repo.getDeckVersion(id, 1))!.content), cards: [{ cardTemplateId: ids[1] }] }); await repo.publishDeck(owner, id, 2);
  // The removed Card remains eligible through the user's adopted v1 composition.
  const opened = await request.post("/api/decks-data", { data: { deckTemplateId: id, localDate: "2026-10-08", cardTemplateId: ids[0] } });
  expect(opened.ok()).toBeTruthy(); expect((await opened.json()).activeCardId).toBe(ids[0]);
  const invalid = await request.post("/api/decks-data", { data: { deckTemplateId: id, localDate: "2026-10-08", cardTemplateId: "foreign-or-fork-identity" } });
  expect(invalid.status()).toBe(403); expect((await invalid.json()).code).toBe("TARGET_CARD_CONTEXT_UNAVAILABLE");
});
