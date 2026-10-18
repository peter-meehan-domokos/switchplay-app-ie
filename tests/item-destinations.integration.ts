import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { readItemDestinations } from "../src/lib/frameworks/destinations";
import { frameworkCataloguePlugin } from "./helpers/frameworkCataloguePlugin";
import { cardFixture, deckFixture } from "./fixtures/frameworks";
import type { Framework } from "../src/lib/frameworks/configuration";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_item_destinations_${sequence++}`), client); await createFoundationIndexes(repo.db);
  const original = cardFixture("original"), fork = cardFixture("fork", "original"), nested = cardFixture("nested", "fork"),
    library = cardFixture("public-only"), unmapped = cardFixture("unmapped"), orphan = cardFixture("standalone");
  const cards = [original, fork, nested, library, unmapped, orphan];
  for (const card of cards) { card.root.ownerUserId = "bob"; card.root.visibility = card.version.visibility = "public"; }
  original.version.content.intro.title = fork.version.content.intro.title = "Shared title";
  original.version.content.intro.description = "Original adopted description";
  const newest = structuredClone(original.version); newest.version = 2; newest.content.intro.title = "New public title"; original.root.latestVersion = 2;
  const active = deckFixture("active", ["unmapped", "original", "fork"]), other = deckFixture("other", ["original"]),
    archived = deckFixture("archived", ["nested"], true), publicDeck = deckFixture("public", ["original", "fork", "public-only"]);
  const decks = [active, other, archived, publicDeck];
  for (const deck of decks) { deck.root.ownerUserId = "bob"; deck.root.visibility = deck.version.visibility = "public"; }
  active.data.activeCardId = "unmapped";
  const current = structuredClone(active.version); current.version = 2; current.content.cards = [{ cardTemplateId: "unmapped", cardVersionAtPublish: 1 }]; active.root.latestVersion = 2;
  await repo.cards().insertMany(cards.map((card) => card.root)); await repo.cardVersions().insertMany([...cards.map((card) => card.version), newest]);
  await repo.decks().insertMany(decks.map((deck) => deck.root)); await repo.deckVersions().insertMany([...decks.map((deck) => deck.version), current]);
  const users = [{ _id: "alice", username: "Learner", cardsData: cards.filter((card) => card !== library).map((card) => ({ ...card.data, reflection: "PRIVATE REFLECTION" })), decksData: [active.data, other.data, archived.data] },
    { _id: "bob", username: "Mentor", cardsData: [{ ...original.data, tests: [{ id: "private-test", date: "2026-10-12", result: true, createdAt: new Date() }] }], decksData: [] }];
  await repo.users().insertMany(users);
  const frameworks: Framework[] = [{ id: "maths", title: "Maths", areas: [{ id: "algebra", title: "Algebra", items: [
    { id: "core", title: "Core", cardTemplateIds: ["original"] }, { id: "public-only", title: "Public only", cardTemplateIds: ["public-only"] },
    { id: "empty", title: "Empty", cardTemplateIds: [] }, { id: "standalone", title: "Standalone", cardTemplateIds: ["standalone"] },
  ] }] }];
  const read = (id = "core", actor = "alice") => readItemDestinations(repo, actor, "maths", id, frameworks);
  return { repo, frameworks, read, original, fork, nested, library, active, publicDeck };
}

test("Item snapshot deduplicates identities and references, keeps original/forks distinct, prefers adopted versions and retains all valid contexts", async () => {
  const f = await setup(), before = await f.repo.users().find({}).toArray(), result = await f.read();
  assert.equal(result.state, "complete"); assert.equal(result.count, 3);
  assert.deepEqual(result.cards.map((card) => card.cardTemplateId), ["original", "fork", "nested"]);
  const original = result.cards[0];
  assert.equal(original.presentation.version, 1); assert.equal(original.presentation.intro.title, "Shared title");
  assert.equal(original.presentation.intro.description, "Original adopted description"); assert.equal(original.versionsDiffer, true);
  assert.deepEqual(original.contexts.map((context) => [context.deckTemplateId, context.kind, context.cardVersion]), [["active", "active", 1], ["other", "active", 1], ["public", "library", 2]]);
  assert.equal(result.cards[1].presentation.intro.title, original.presentation.intro.title);
  assert.equal(result.cards[1].presentation.creator?.immediateSourceUsername, "Mentor");
  assert.equal(result.cards[2].presentationContext, "archived");
  assert.equal(result.cards[2].contexts[0].kind, "archived");
  assert.equal(original.contexts.filter((context) => context.deckTemplateId === "active").length, 1);
  assert.equal(original.contexts.some((context) => context.kind === "library" && context.deckTemplateId === "active"), false);
  assert.equal(JSON.stringify(result).includes("PRIVATE REFLECTION"), false); assert.equal(JSON.stringify(result).includes("private-test"), false);
  assert.equal(JSON.stringify(original.presentation).includes("completionStatus"), false);
  assert.deepEqual(await f.repo.users().find({}).toArray(), before);
});

test("one public Card with one Deck destination uses current publication and reads create no personal records", async () => {
  const f = await setup(), before = await f.repo.getPersonalUser("alice"), result = await f.read("public-only");
  assert.equal(result.count, 1); assert.equal(result.cards[0].presentationContext, "library");
  assert.equal(result.cards[0].contexts.length, 1); assert.equal(result.cards[0].contexts[0].deckTemplateId, "public");
  assert.equal(result.cards[0].contexts[0].kind, "library");
  assert.deepEqual(await f.repo.getPersonalUser("alice"), before);
});

test("empty mappings and standalone mapped Cards produce genuine empty results; orphan data never creates navigation", async () => {
  const f = await setup();
  for (const id of ["empty", "standalone"]) { const result = await f.read(id); assert.equal(result.state, "empty"); assert.equal(result.count, 0); assert.deepEqual(result.cards, []); }
  await f.repo.cards().updateOne({ cardTemplateId: "standalone" }, { $set: { latestVersion: 0 } });
  assert.equal((await f.read("standalone")).state, "empty");
});

test("unavailable contributors preserve valid matches and explicit incomplete state; forbidden adopted versions are not displayed", async () => {
  const f = await setup();
  await f.repo.cardVersions().deleteOne({ cardTemplateId: "original", version: 1 });
  let result = await f.read(); assert.equal(result.state, "incomplete"); assert.equal(result.count, null);
  const original = result.cards.find((card) => card.cardTemplateId === "original")!;
  assert.equal(original.presentationContext, "library"); assert.equal(original.presentation.version, 2);
  assert.ok(original.contexts.every((context) => context.kind === "library"));
  assert.ok(result.issues.some((issue) => issue.code === "ADOPTED_CARDS_UNAVAILABLE"));
  await f.repo.cards().updateOne({ cardTemplateId: "nested" }, { $set: { forkedFrom: { cardTemplateId: "missing", version: 1 } } });
  result = await f.read(); assert.equal(result.state, "incomplete"); assert.equal(result.cards.some((card) => card.cardTemplateId === "nested"), false);
  assert.ok(result.cards.some((card) => card.cardTemplateId === "original"));
  await f.repo.cardVersions().updateOne({ cardTemplateId: "fork", version: 1 }, { $set: { visibility: "private" } });
  result = await f.read(); assert.equal(result.cards.some((card) => card.cardTemplateId === "fork"), false);
  assert.equal(result.state, "incomplete");
});

test("mapping conflicts affect involved Items, unmapped Items remain empty, and Frameworks stay independent", async () => {
  const f = await setup(); f.frameworks[0] = { ...f.frameworks[0], areas: [{ ...f.frameworks[0].areas[0], items: [...f.frameworks[0].areas[0].items, { id: "conflicting", title: "Conflict", cardTemplateIds: ["fork"] }] }] };
  assert.equal((await f.read()).state, "incomplete"); assert.equal((await f.read("empty")).state, "empty");
  const alternative: Framework = { id: "alternative", title: "Other", areas: [{ id: "other", title: "Other", items: [{ id: "alt", title: "Alternative", cardTemplateIds: ["original"] }] }] };
  assert.equal((await readItemDestinations(f.repo, "alice", "alternative", "alt", [...f.frameworks, alternative])).state, "complete");
});

test("Item destinations are actor-bound, validate exclusive queries, use private/no-store and propagate database failures", async () => {
  const f = await setup();
  const bundle = await build({ stdin: { contents: `export { GET } from "@/app/api/frameworks/[frameworkId]/destinations/route"; export { CardRepository } from "@/lib/cards/repository";`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
    plugins: [{ name: "auth", setup(builder) { builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: 'export async function getCurrentUser() { return { id: "alice" }; }', loader: "ts" })); } }, frameworkCataloguePlugin(f.frameworks)] });
  const fixture = { exports: {} }; new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve(process.cwd(), "package.json")), fixture, fixture.exports);
  const routes = fixture.exports as { GET(request: Request, context: { params: Promise<{ frameworkId: string }> }): Promise<Response>; CardRepository: { application(): Promise<CardRepository> } };
  routes.CardRepository.application = async () => f.repo;
  const request = (query: string, actor = "alice") => routes.GET(new Request(`http://localhost/api/frameworks/maths/destinations?${query}`, { headers: { "X-Personal-Viewer": actor } }), { params: Promise.resolve({ frameworkId: "maths" }) });
  const response = await request("itemId=core"); assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Personal-Viewer"), "alice"); assert.equal((await response.json()).cards.length, 3);
  for (const query of ["itemId=core&areaId=algebra", "itemId=core&itemId=core", "itemId=core&extra=x"]) assert.equal((await request(query)).status, 400);
  assert.equal((await request("itemId=forged")).status, 403); assert.equal((await request("itemId=core", "bob")).status, 409);
  const other = await f.read("core", "bob"); assert.ok(other.cards.every((card) => card.presentationContext === "library"));
  const before = await f.repo.getPersonalUser("alice"); await request("itemId=core"); assert.deepEqual(await f.repo.getPersonalUser("alice"), before);
  f.repo.cards = () => { throw new Error("Database unavailable"); }; assert.equal((await request("itemId=core")).status, 500);
});

test("optional targeted working version check rejects stale or invalid selections before personal entry writes", async () => {
  const f = await setup(), before = await f.repo.getPersonalUser("alice");
  await assert.rejects(f.repo.openWorkingDeck("alice", "active", "2026-10-12", "original", 2), /TARGET_CARD_VERSION_CONFLICT/);
  await assert.rejects(f.repo.openWorkingDeck("alice", "active", "2026-10-12", "original", 0), /INVALID_ADOPTED_VERSION/);
  await assert.rejects(f.repo.openWorkingDeck("alice", "active", "2026-10-12", undefined, 1), /TARGET_CARD_CONTEXT_REQUIRED/);
  assert.deepEqual(await f.repo.getPersonalUser("alice"), before);
  await f.repo.openWorkingDeck("alice", "active", "2026-10-12", "original", 1);
  assert.equal((await f.repo.getPersonalUser("alice"))!.decksData[0].activeCardId, "original");
  await f.repo.openWorkingDeck("alice", "active", "2026-10-12", "fork");
  assert.equal((await f.repo.getPersonalUser("alice"))!.decksData[0].activeCardId, "fork");
});

test("one Card across active, archived and Library contexts remains one visual with independent context versions", async () => {
  const f = await setup();
  await f.repo.deckVersions().updateOne({ deckTemplateId: "archived", version: 1 }, { $push: { "content.cards": { cardTemplateId: "original", cardVersionAtPublish: 1 } } });
  const result = await f.read(), selected = result.cards.filter((card) => card.cardTemplateId === "original");
  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0].contexts.map((context) => [context.kind, context.cardVersion]), [["active", 1], ["active", 1], ["archived", 1], ["library", 2]]);
  assert.equal(selected[0].presentation.version, 1); assert.equal(selected[0].versionsDiffer, true);
  assert.equal(selected[0].contexts.some((context) => context.kind === "library" && context.deckTemplateId === "archived"), false);
});
