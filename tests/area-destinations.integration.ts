import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { readAreaDestinations } from "../src/lib/frameworks/destinations";
import { cardFixture, deckFixture, frameworkFixtures } from "./fixtures/frameworks";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { frameworkCataloguePlugin } from "./helpers/frameworkCataloguePlugin";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_area_destinations_${sequence++}`), client);
  await createFoundationIndexes(repo.db);
  const cards = [cardFixture("original"), cardFixture("fork", "original"), cardFixture("nested", "fork"), cardFixture("second"), cardFixture("speed"), cardFixture("unmapped"), cardFixture("orphan")];
  cards[0].data.items[0].completionStatus = "done"; cards[0].data.signalReadings[0].reading = 7;
  cards[1].data.items.forEach((step) => { step.completionStatus = "done"; });
  cards[5].data.items.forEach((step) => { step.completionStatus = "done"; });
  cards[0].data.tests = [{ id: "personal-secret", date: "2026-10-12", result: true, createdAt: new Date() }];
  const decks = [deckFixture("active", ["original", "fork", "unmapped"]), deckFixture("archived", ["nested", "second", "speed"], true),
    deckFixture("single", ["fork"]), deckFixture("unrelated", ["unmapped"])];
  decks[0].data.activeCardId = "fork";
  for (const card of cards) { await repo.cards().insertOne(card.root); await repo.cardVersions().insertOne(card.version); }
  for (const deck of decks) { await repo.decks().insertOne(deck.root); await repo.deckVersions().insertOne(deck.version); }
  await repo.users().insertMany([{ _id: "alice", cardsData: cards.map((card) => card.data), decksData: decks.map((deck) => deck.data) },
    { _id: "bob", cardsData: [], decksData: [] }]);
  return { repo, cards, decks, frameworks: frameworkFixtures() };
}
test("Area discovery ranks active/archived adopted Decks; deduplicates matches and returns personal metadata without private histories or writes", async () => {
  const { repo, frameworks } = await setup(), before = await repo.getPersonalUser("alice");
  frameworks[0].areas[0].items[0].cardTemplateIds.push("orphan");
  const result = await readAreaDestinations(repo, "alice", "practice", "skills", frameworks);
  assert.equal(result.myDecks.state, "complete"); assert.equal(result.myDecks.count, 2);
  assert.deepEqual(result.myDecks.entries.map((entry) => [entry.deckTemplateId, entry.matchingCardCount]), [["active", 2], ["single", 1]]);
  assert.equal(result.archived.count, 1); assert.equal(result.archived.entries[0].matchingCardCount, 3);
  assert.equal(result.myDecks.entries[0].front.context, "personal");
  const front = result.myDecks.entries[0].front;
  if (front.context !== "personal") throw new Error("Expected personal metadata");
  // Unmapped Card still contributes to ordinary Deck metadata: 7/9 Steps.
  assert.equal(Math.round(front.completion!), 78); assert.equal(front.confidence, 7);
  assert.equal(JSON.stringify(result).includes("personal-secret"), false);
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  assert.equal((await readAreaDestinations(repo, "bob", "practice", "skills", frameworks)).myDecks.state, "empty");
  assert.equal((await readAreaDestinations(repo, "alice", "practice", "empty", frameworks)).myDecks.state, "empty");
  await assert.rejects(readAreaDestinations(repo, "alice", "practice", "forged", frameworks), /FRAMEWORK_AREA_CONTEXT_FORBIDDEN/);
});
test("destination API is actor-bound, private/no-store, validates identifiers and never initializes personal data", async () => {
  const { repo, frameworks } = await setup();
  const bundle = await build({ stdin: { contents: `
    export { GET } from "@/app/api/frameworks/[frameworkId]/destinations/route";
    export { CardRepository } from "@/lib/cards/repository";
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
    plugins: [{ name: "area-auth", setup(builder) {
      builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: 'export async function getCurrentUser() { return { id: "alice" }; }', loader: "ts" }));
    } }, frameworkCataloguePlugin(frameworks)] });
  const fixture = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve(process.cwd(), "package.json")), fixture, fixture.exports);
  const routes = fixture.exports as { GET: (request: Request, context: { params: Promise<{ frameworkId: string }> }) => Promise<Response>; CardRepository: { application(): Promise<CardRepository> } };
  routes.CardRepository.application = async () => repo;
  const request = (query: string, actor = "alice", frameworkId = "practice") => routes.GET(new Request("http://localhost/api/frameworks/practice/destinations?" + query,
    { headers: { "X-Personal-Viewer": actor } }), { params: Promise.resolve({ frameworkId }) });
  const before = await repo.getPersonalUser("alice"), response = await request("areaId=skills");
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Personal-Viewer"), "alice");
  assert.equal((await response.json()).myDecks.count, 2);
  assert.equal((await request("areaId=skills", "bob")).status, 409);
  assert.equal((await request("areaId=skills", "alice", "forged")).status, 403);
  assert.equal((await request("areaId=skills&areaId=skills")).status, 400);
  assert.equal((await request("areaId=skills&userId=bob")).status, 400);
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
});
test("ambiguous membership and inaccessible adopted Decks cannot become selectable destinations", async () => {
  const { repo, decks, frameworks } = await setup();
  await repo.users().updateOne({ _id: "alice" }, { $push: { decksData: structuredClone(decks[0].data) } });
  let result = await readAreaDestinations(repo, "alice", "practice", "skills", frameworks);
  assert.equal(result.myDecks.state, "incomplete"); assert.equal(result.myDecks.entries.some((entry) => entry.deckTemplateId === "active"), false);
  await repo.decks().updateOne({ deckTemplateId: "single" }, { $set: { ownerUserId: "bob" } });
  result = await readAreaDestinations(repo, "alice", "practice", "skills", frameworks);
  assert.equal(result.myDecks.entries.length, 0); assert.equal(result.archived.state, "complete");
});
test("discovery retains adopted Deck/Card versions and Framework-local ancestry, not drafts or latest composition", async () => {
  const { repo, decks, cards, frameworks } = await setup();
  const latest = structuredClone(decks[0].version); latest.version = 2; latest.content.title = "New public title"; latest.content.cards = [];
  await repo.deckVersions().insertOne(latest); await repo.decks().updateOne({ deckTemplateId: "active" }, { $set: { latestVersion: 2 } });
  const laterCard = structuredClone(cards[0].version); laterCard.version = 2; laterCard.content.steps = cardFixture("new").version.content.steps;
  await repo.cardVersions().insertOne(laterCard); await repo.cards().updateOne({ cardTemplateId: "original" }, { $set: { latestVersion: 2 } });
  let result = await readAreaDestinations(repo, "alice", "practice", "skills", frameworks);
  assert.equal(result.myDecks.entries[0].front.title, "active"); assert.equal(result.myDecks.entries[0].adoptedDeckVersion, 1);
  assert.equal(result.myDecks.entries[0].front.context === "personal" && result.myDecks.entries[0].front.confidence, 7);
  frameworks[0].areas[0].items[1].cardTemplateIds.push("fork");
  assert.equal((await readAreaDestinations(repo, "alice", "practice", "skills", frameworks)).myDecks.state, "incomplete");
  result = await readAreaDestinations(repo, "alice", "alternative", "skills", frameworks);
  assert.equal(result.myDecks.state, "complete"); assert.equal(result.archived.entries[0].matchingCardCount, 1);
});
test("unavailable adopted contributors and unresolved compositions stay distinct from empty, preserving valid destinations", async () => {
  const { repo, frameworks } = await setup();
  await repo.cardVersions().deleteOne({ cardTemplateId: "second", version: 1 });
  let result = await readAreaDestinations(repo, "alice", "practice", "skills", frameworks);
  assert.equal(result.myDecks.state, "complete"); assert.equal(result.archived.state, "incomplete"); assert.equal(result.archived.count, null);
  assert.equal(result.archived.entries[0].availability, "unavailable");
  assert.equal(result.archived.entries[0].front.context === "personal" && result.archived.entries[0].front.completion, null);
  await repo.deckVersions().deleteOne({ deckTemplateId: "active", version: 1 });
  result = await readAreaDestinations(repo, "alice", "practice", "skills", frameworks);
  assert.equal(result.myDecks.state, "incomplete"); assert.equal(result.myDecks.count, null);
  assert.deepEqual(result.myDecks.entries.map((entry) => entry.deckTemplateId), ["single"]);
  await repo.cards().updateOne({ cardTemplateId: "fork" }, { $set: { forkedFrom: { cardTemplateId: "missing", version: 1 } } });
  result = await readAreaDestinations(repo, "alice", "practice", "skills", frameworks);
  assert.equal(result.myDecks.entries.length, 0); assert.equal(result.myDecks.state, "incomplete");
});
test("membership access is revalidated; stale restoration fails and a later open failure never reverses restoration", async () => {
  const { repo, frameworks } = await setup();
  const entry = (await readAreaDestinations(repo, "alice", "practice", "skills", frameworks)).archived.entries[0];
  await assert.rejects(repo.restoreLibraryDeck("alice", entry.deckTemplateId, entry.membershipRevision + 1), /REVISION/);
  assert.notEqual((await repo.getPersonalUser("alice"))!.decksData.find((data) => data.deckTemplateId === entry.deckTemplateId)!.archivedAt, null);
  await repo.restoreLibraryDeck("alice", entry.deckTemplateId, entry.membershipRevision);
  await repo.cardVersions().deleteOne({ cardTemplateId: "second", version: 1 });
  await assert.rejects(repo.openWorkingDeck("alice", entry.deckTemplateId, "2026-10-12"));
  const data = (await repo.getPersonalUser("alice"))!.decksData.find((data) => data.deckTemplateId === entry.deckTemplateId)!;
  assert.equal(data.archivedAt, null); assert.equal(data.deckTemplateVersion, 1); assert.equal(data.membershipRevision, entry.membershipRevision + 1);
  await assert.rejects(repo.openWorkingDeck("bob", "active", "2026-10-12"));
});
test("Area entry preserves active Card, targeted reentry changes it deliberately, and database failures propagate", async () => {
  const { repo } = await setup();
  await repo.openWorkingDeck("alice", "active", "2026-10-12");
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].activeCardId, "fork");
  await repo.openWorkingDeck("alice", "active", "2026-10-12", "original");
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].activeCardId, "original");
  repo.cardVersions = () => { throw new Error("Database failure"); };
  await assert.rejects(readAreaDestinations(repo, "alice", "practice", "skills", frameworkFixtures()), /Database failure/);
});
