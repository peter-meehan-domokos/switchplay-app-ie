import { expect, test } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { cardFixture, deckFixture } from "../fixtures/frameworks";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

test("authenticated Card assessment APIs preserve original sources, archived history and two-user privacy", async ({ page, playwright, baseURL }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const stranger = await playwright.request.newContext({ baseURL });
  try {
    const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
    const source = cardFixture(randomUUID()), fork = cardFixture(randomUUID(), source.root.cardTemplateId);
    const deck = deckFixture(randomUUID(), [source.root.cardTemplateId, fork.root.cardTemplateId]);
    for (const card of [source, fork]) card.root.ownerUserId = actor;
    deck.root.ownerUserId = actor;
    await repo.cards().insertMany([source.root, fork.root]); await repo.cardVersions().insertMany([source.version, fork.version]);
    await repo.decks().insertOne(deck.root); await repo.deckVersions().insertOne(deck.version);
    await repo.ensureDeckData(actor, deck.root.deckTemplateId, 1);
    await repo.users().updateOne({ _id: new ObjectId(actor) }, { $set: { "cardsData.$[card].historySourceCardTemplateId": source.root.cardTemplateId } },
      { arrayFilters: [{ "card.cardTemplateId": fork.root.cardTemplateId }] });
    const sourceUrl = `/api/cards-data/${source.root.cardTemplateId}/tests`, forkUrl = `/api/cards-data/${fork.root.cardTemplateId}/tests`;
    expect((await stranger.get(sourceUrl)).status()).toBe(401);
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    const before = await repo.getPersonalUser(actor);
    const command = { viewerUserId: actor, source: { kind: "card", cardTemplateId: source.root.cardTemplateId }, action: "add", id: randomUUID(),
      expectedRevision: 0, deckTemplateId: deck.root.deckTemplateId, date: "2026-10-11", result: true };
    const created = await page.request.post(sourceUrl, { data: command, headers: { "X-Personal-Viewer": actor } });
    expect(created.status()).toBe(200); expect(created.headers()["cache-control"]).toContain("no-store");
    const saved = await created.json(); expect(saved.revision).toBe(1);
    expect((await (await page.request.post(sourceUrl, { data: command })).json()).outcome).toBe("already-present");
    const history = await (await page.request.get(`/api/cards-data/${fork.root.cardTemplateId}/history`)).json();
    expect(history.segments[0].tests).toEqual([]); expect(history.segments[1].tests[0].id).toBe(command.id);
    const forkCommand = { ...command, source: { kind: "card", cardTemplateId: fork.root.cardTemplateId }, id: randomUUID() };
    expect((await page.request.post(forkUrl, { data: forkCommand })).status()).toBe(200);
    expect((await page.request.post(sourceUrl, { data: { ...command, id: randomUUID(), expectedRevision: 1, createdAt: "forged" } })).status()).toBe(400);
    expect((await page.request.post(forkUrl, { data: command })).status()).toBe(409);
    expect((await page.request.get(sourceUrl, { headers: { "X-Personal-Viewer": "another-actor" } })).status()).toBe(409);
    await stranger.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
    expect((await stranger.get(sourceUrl)).status()).toBe(403);
    expect((await stranger.post(sourceUrl, { data: command })).status()).toBe(409);
    await repo.archiveDeckData(actor, deck.root.deckTemplateId);
    const update = { viewerUserId: actor, source: command.source, id: command.id, expectedRevision: 1, action: "update", date: "2026-10-10", result: false };
    const edited = await page.request.patch(`${sourceUrl}/${command.id}`, { data: update });
    expect(edited.status()).toBe(200); expect((await edited.json()).tests[0].createdAt).toBe(saved.tests[0].createdAt);
    const refreshed = await (await page.request.get(`/api/cards-data/${fork.root.cardTemplateId}/history`)).json();
    expect(refreshed.segments[1].tests[0].result).toBe(false);
    const deletion = { viewerUserId: actor, source: command.source, id: command.id, expectedRevision: 2, action: "delete" };
    expect((await page.request.delete(`${sourceUrl}/${command.id}`, { data: deletion })).status()).toBe(200);
    expect((await page.request.post(sourceUrl, { data: command })).status()).toBe(409);
    expect((await page.request.patch(`${sourceUrl}/forged-result`, { data: update })).status()).toBe(409);
    const latest = await repo.getPersonalUser(actor);
    expect(latest!.cardsData.find((card) => card.cardTemplateId === source.root.cardTemplateId)!.tests).toEqual([]);
    expect(latest!.cardsData.find((card) => card.cardTemplateId === fork.root.cardTemplateId)!.tests[0].id).toBe(forkCommand.id);
    expect(latest!.cardsData.map((card) => card.cardTemplateVersion)).toEqual(before!.cardsData.map((card) => card.cardTemplateVersion));
    expect(latest!.decksData.length).toBe(before!.decksData.length);
  } finally { await stranger.dispose(); await client.close(); }
});

test("direct Item API retains removed Item results without memberships; empty real catalogue rejects new results", async ({ page }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
    const itemId = randomUUID(), id = randomUUID(), url = `/api/items-data/${itemId}/tests`;
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    const user = (await repo.getPersonalUser(actor))!;
    await repo.users().updateOne({ _id: user._id }, { $set: { itemTests: [{ itemId, id, date: "2026-10-11", result: true, createdAt: new Date("2026-10-11T10:00:00Z") }] } });
    const stored = await (await page.request.get(url)).json(); expect(stored.revision).toBe(0); expect(stored.tests[0].id).toBe(id);
    const source = { kind: "item", itemId };
    expect((await page.request.post(url, { data: { viewerUserId: actor, source, id: randomUUID(), action: "add", expectedRevision: 0, date: "2026-10-11", result: true } })).status()).toBe(403);
    const update = { viewerUserId: actor, source, id, action: "update", expectedRevision: 0, date: "2026-10-10", result: false };
    const edited = await page.request.patch(`${url}/${id}`, { data: update }); expect(edited.status()).toBe(200);
    expect((await edited.json()).tests[0].createdAt).toBe(stored.tests[0].createdAt);
    expect((await page.request.delete(`${url}/${id}`, { data: { viewerUserId: actor, source, id, action: "delete", expectedRevision: 1 } })).status()).toBe(200);
    const after = (await repo.getPersonalUser(actor))!; expect(after.cardsData).toEqual(user.cardsData); expect(after.decksData).toEqual(user.decksData);
    expect(after.itemTests).toEqual([]); expect(after.itemTestsRevision).toBe(2);
  } finally { await client.close(); }
});
