import { expect, test } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { CardRepository } from "../../src/lib/cards/repository";
import { cardFixture, deckFixture } from "../fixtures/frameworks";
import { assertDisposableDatabase } from "../../src/lib/cards/localDatabase";

test("Framework APIs expose the sample catalogue privately and enforce authentication and actor binding", async ({ page, playwright, baseURL }) => {
  const stranger = await playwright.request.newContext({ baseURL });
  try {
    for (const path of ["/api/frameworks", "/api/frameworks/summary", "/api/frameworks/forged/summary", "/api/items-data/forged/history", "/api/cards-data/forged/assessment-history"])
      expect((await stranger.get(path)).status()).toBe(401);
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    for (const path of ["/api/frameworks", "/api/frameworks/summary"]) {
      const response = await page.request.get(path, { headers: { "X-Personal-Viewer": process.env.PHASE2_USER_ID! } });
      expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toBe("private, no-store");
      expect(response.headers()["vary"]).toContain("Cookie"); expect(response.headers()["x-personal-viewer"]).toBe(process.env.PHASE2_USER_ID!);
      const frameworks = (await response.json()).frameworks;
      expect(frameworks.map((framework: { id: string }) => framework.id)).toEqual(["leaving-cert-hl"]);
      expect(frameworks[0].areas.map((area: { id: string }) => area.id)).toEqual(["algebra", "calculus", "trigonometry"]);
      expect((await page.request.get(path, { headers: { "X-Personal-Viewer": "another-user" } })).status()).toBe(409);
    }
    expect((await page.request.get("/api/frameworks/forged/summary")).status()).toBe(403);
    expect((await page.request.get("/api/items-data/forged/history")).status()).toBe(403);
    expect((await page.request.get("/api/cards-data/forged/assessment-history")).status()).toBe(403);
  } finally { await stranger.dispose(); }
});

test("assessment-history APIs retain adopted source attribution, revisions, ordering and partial history without writes or cross-user leakage", async ({ page, playwright, baseURL }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const stranger = await playwright.request.newContext({ baseURL });
  try {
    const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
    const source = cardFixture(randomUUID()), fork = cardFixture(randomUUID(), source.root.cardTemplateId), nested = cardFixture(randomUUID(), fork.root.cardTemplateId);
    source.version.content.intro.title = "Source assessment Card";
    source.data.tests = [{ id: "same-id", date: "2026-10-11", result: true, createdAt: new Date("2026-10-11T10:00:00Z") }]; source.data.testsRevision = 6;
    fork.data.tests = [{ id: "same-id", date: "2026-10-10", result: false, createdAt: new Date("2026-10-11T10:00:00Z") }];
    fork.data.historySourceCardTemplateId = source.root.cardTemplateId; nested.data.historySourceCardTemplateId = fork.root.cardTemplateId;
    const deck = deckFixture(randomUUID(), [source.root.cardTemplateId, fork.root.cardTemplateId, nested.root.cardTemplateId], true);
    for (const card of [source, fork, nested]) card.root.ownerUserId = actor;
    deck.root.ownerUserId = actor;
    await repo.cards().insertMany([source.root, fork.root, nested.root]); await repo.cardVersions().insertMany([source.version, fork.version, nested.version]);
    await repo.decks().insertOne(deck.root); await repo.deckVersions().insertOne(deck.version);
    await repo.users().updateOne({ _id: new ObjectId(actor) }, { $push: { decksData: deck.data, cardsData: { $each: [source.data, fork.data, nested.data] } } });
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    const url = `/api/cards-data/${nested.root.cardTemplateId}/assessment-history`, before = await repo.getPersonalUser(actor);
    const response = await page.request.get(url); expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toBe("private, no-store");
    const history = (await response.json()).history;
    expect(history.state).toBe("complete"); expect(history.count).toBe(2);
    expect(history.results[0].source).toEqual({ kind: "card", cardTemplateId: source.root.cardTemplateId });
    expect(history.results[0].sourceTitle).toBe("Source assessment Card"); expect(history.results[0].sourceRevision).toBe(6);
    expect(history.results[0].relationship).toBe("inherited-card");
    expect(history.latestThree.map((row: { result: boolean }) => row.result)).toEqual([false, true]);
    expect(await repo.getPersonalUser(actor)).toEqual(before);
    await stranger.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
    expect((await stranger.get(url)).status()).toBe(403);
    await repo.cards().deleteOne({ cardTemplateId: source.root.cardTemplateId });
    const missingTitle = (await (await page.request.get(url)).json()).history;
    expect(missingTitle.state).toBe("complete"); expect(missingTitle.results[0].sourceTitle).toBe("Card title unavailable");
    await repo.users().updateOne({ _id: new ObjectId(actor) }, { $pull: { cardsData: { cardTemplateId: source.root.cardTemplateId } } });
    const partial = (await (await page.request.get(url)).json()).history;
    expect(partial.state).toBe("incomplete"); expect(partial.count).toBeNull(); expect(partial.readableCount).toBe(1);
    expect(partial.latestThree).toEqual([]); expect(partial.results[0].source.cardTemplateId).toBe(fork.root.cardTemplateId);
  } finally { await stranger.dispose(); await client.close(); }
});

test("retained direct Item history remains readable without mapped Cards and does not create learning state", async ({ page, playwright, baseURL }) => {
  assertDisposableDatabase(); const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  const stranger = await playwright.request.newContext({ baseURL });
  try {
    const repo = new CardRepository(client.db(process.env.MONGODB_DB!), client), actor = process.env.PHASE2_USER_ID!;
    const itemId = randomUUID(), id = randomUUID(), url = `/api/items-data/${itemId}/history`;
    await repo.users().updateOne({ _id: new ObjectId(actor) }, { $set: { itemTests: [{ itemId, id, date: "2026-10-11", result: true, createdAt: new Date("2026-10-11T10:00:00Z") }], itemTestsRevision: 8 } });
    const before = await repo.getPersonalUser(actor);
    await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
    const response = await page.request.get(url); expect(response.status()).toBe(200);
    const body = await response.json(); expect(body.configured).toBe(false); expect(body.history.count).toBe(1);
    expect(body.history.results[0].source).toEqual({ kind: "item", itemId }); expect(body.history.results[0].sourceTitle).toBe("Item test");
    expect(body.history.results[0].sourceRevision).toBe(8); expect(await repo.getPersonalUser(actor)).toEqual(before);
    await stranger.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
    expect((await stranger.get(url)).status()).toBe(403);
  } finally { await stranger.dispose(); await client.close(); }
});
