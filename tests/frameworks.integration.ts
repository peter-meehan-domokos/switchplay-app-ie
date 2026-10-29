import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { readCanonicalAncestry } from "../src/lib/frameworks/mappingRepository";
import { resolveEffectiveMapping, validateFrameworkAncestry } from "../src/lib/frameworks/mapping";
import { collectPersonalEligibility } from "../src/lib/frameworks/eligibility";
import { calculateMappedProgress, resolveAdoptedCardCalculation } from "../src/lib/frameworks/calculations";
import { cardFixture, deckFixture, frameworkFixtures } from "./fixtures/frameworks";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_frameworks_${sequence++}`), client);
  await createFoundationIndexes(repo.db);
  const cards = [cardFixture("original"), cardFixture("second"), cardFixture("speed"), cardFixture("fork", "original"), cardFixture("nested", "fork"), cardFixture("unrelated")];
  await repo.cards().insertMany(cards.map((card) => structuredClone(card.root))); await repo.cardVersions().insertMany(cards.map((card) => structuredClone(card.version)));
  return { repo, cards };
}

test("database-backed ancestry validation follows nested forks, detects distant conflicts and projects no content or personal data", async () => {
  const { repo } = await setup(); const frameworks = frameworkFixtures();
  const graph = await readCanonicalAncestry(repo, frameworks, ["nested"]);
  const result = resolveEffectiveMapping(frameworks[0], "nested", graph);
  assert.equal(result.state, "mapped"); if (result.state === "mapped") assert.equal(result.itemId, "practice-control");
  assert.deepEqual(Object.keys(graph.get("original") as object).sort(), ["cardTemplateId", "forkedFrom"]);
  assert.deepEqual(validateFrameworkAncestry(frameworks[0], graph), []);
  frameworks[0].areas[0].items[1].cardTemplateIds = ["nested", "fork"];
  const conflicting = await readCanonicalAncestry(repo, frameworks);
  assert.ok(validateFrameworkAncestry(frameworks[0], conflicting).some((issue) => issue.code === "MAPPING_CONFLICT"));
  assert.deepEqual(validateFrameworkAncestry(frameworks[1], conflicting), []);
});

test("database-backed missing, malformed and cyclic ancestry is explicit; database failures propagate", async () => {
  const { repo } = await setup(); const framework = frameworkFixtures()[0];
  for (const [from, code] of [[{ cardTemplateId: "gone", version: 1 }, "MISSING_CANONICAL_ANCESTOR"],
    [{ cardTemplateId: "original", version: 0 }, "MALFORMED_CANONICAL_ANCESTRY"], [{ cardTemplateId: "nested", version: 1 }, "ANCESTRY_CYCLE"]] as const) {
    await repo.cards().updateOne({ cardTemplateId: "fork" }, { $set: { forkedFrom: from } });
    const graph = await readCanonicalAncestry(repo, [framework], ["nested"]);
    const result = resolveEffectiveMapping(framework, "nested", graph);
    assert.equal(result.state, "incomplete"); if (result.state === "incomplete") assert.equal(result.issues[0].code, code);
  }
  const failed = new CardRepository(repo.db, client);
  failed.cards = () => { throw new Error("Simulated database read failure"); };
  await assert.rejects(readCanonicalAncestry(failed, [framework]), /Simulated database read failure/);
});

test("stored active/archived adoption deduplicates Cards, counts originals/forks independently and ignores orphan/owned/Library-only Cards", async () => {
  const { repo, cards } = await setup(); const decks = [deckFixture("active", ["original", "unrelated"]), deckFixture("archive", ["original", "fork"], true)];
  await repo.decks().insertMany(decks.map((deck) => deck.root)); await repo.deckVersions().insertMany(decks.map((deck) => deck.version));
  cards.find((card) => card.root.cardTemplateId === "fork")!.data.items.forEach((step) => { step.completionStatus = "done"; });
  await repo.users().insertMany([{ _id: "alice", decksData: decks.map((deck) => deck.data), cardsData: cards.map((card) => card.data) },
    { _id: "bob", decksData: [], cardsData: cards.map((card) => card.data) }]);
  await repo.transaction(async (session) => {
    const user = (await repo.getPersonalUser("alice", session))!, roots = await repo.cards().find({}, { session }).toArray();
    const cardVersions = await repo.cardVersions().find({}, { session }).toArray();
    const eligibility = collectPersonalEligibility("alice", user.decksData, await repo.decks().find({}, { session }).toArray(), await repo.deckVersions().find({}, { session }).toArray());
    const graph = await readCanonicalAncestry(repo, frameworkFixtures(), eligibility.cardTemplateIds, session);
    const calculations = new Map(eligibility.cardTemplateIds.map((id) => [id, resolveAdoptedCardCalculation("alice", id, roots, cardVersions, user.cardsData)]));
    const result = calculateMappedProgress(frameworkFixtures()[0], { areaId: "skills" }, graph, eligibility, calculations);
    assert.equal(result.completion, 50); assert.equal(result.eligibleCardCount, 2);
    assert.deepEqual(eligibility.cardTemplateIds, ["original", "unrelated", "fork"]);
    const bob = (await repo.getPersonalUser("bob", session))!;
    assert.deepEqual(collectPersonalEligibility("bob", bob.decksData, decks.map((deck) => deck.root), decks.map((deck) => deck.version)).cardTemplateIds, []);
  });
});

test("private adopted versions fail safely; public foreign forks use only the actor's adopted state and ignore newer versions", async () => {
  const { repo, cards } = await setup(); const fork = cards.find((card) => card.root.cardTemplateId === "fork")!;
  await repo.cards().updateOne({ cardTemplateId: "fork" }, { $set: { ownerUserId: "bob", visibility: "public", latestVersion: 2 } });
  await repo.cardVersions().updateOne({ cardTemplateId: "fork", version: 1 }, { $set: { visibility: "public" } });
  await repo.cardVersions().insertOne({ ...fork.version, version: 2, visibility: "public", content: cardFixture("new-steps").version.content });
  const deck = deckFixture("foreign-fork", ["fork"], true); await repo.decks().insertOne(deck.root); await repo.deckVersions().insertOne(deck.version);
  const creatorState = structuredClone(fork.data); creatorState.items.forEach((step) => { step.completionStatus = "done"; });
  creatorState.tests = [{ id: "creator-private-test", date: "2026-10-11", result: true, createdAt: new Date() }];
  await repo.users().insertMany([{ _id: "alice", decksData: [deck.data], cardsData: [fork.data] }, { _id: "bob", decksData: [], cardsData: [creatorState] }]);
  const user = (await repo.getPersonalUser("alice"))!, roots = await repo.cards().find({}).toArray(), versions = await repo.cardVersions().find({}).toArray();
  const calculation = resolveAdoptedCardCalculation("alice", "fork", roots, versions, user.cardsData);
  assert.equal(calculation.state, "complete"); if (calculation.state === "complete") assert.equal(calculation.adoptedVersion, 1);
  const eligibility = collectPersonalEligibility("alice", user.decksData, [deck.root], [deck.version]);
  const graph = await readCanonicalAncestry(repo, frameworkFixtures(), eligibility.cardTemplateIds);
  const result = calculateMappedProgress(frameworkFixtures()[0], { itemId: "practice-control" }, graph, eligibility, new Map([["fork", calculation]]));
  assert.equal(result.completion, 0); assert.equal(JSON.stringify(result).includes("creator-private-test"), false);
  assert.equal(resolveAdoptedCardCalculation("bob", "original", roots, versions, [cards[0].data]).state, "incomplete");
  await repo.cardVersions().deleteOne({ cardTemplateId: "fork", version: 1 });
  assert.equal(resolveAdoptedCardCalculation("alice", "fork", roots, await repo.cardVersions().find({}).toArray(), user.cardsData).state, "incomplete");
});
