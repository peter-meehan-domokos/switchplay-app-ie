import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { readAreaDestinations } from "../src/lib/frameworks/destinations";
import { libraryCollection, libraryDetail, libraryViewerStatus } from "../src/lib/cards/libraryReadModels";
import { cardFixture, deckFixture } from "./fixtures/frameworks";
import type { Framework } from "../src/lib/frameworks/configuration";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_area_library_${sequence++}`), client);
  await createFoundationIndexes(repo.db);
  const original = cardFixture("original"), fork = cardFixture("fork", "original"), nested = cardFixture("nested", "fork"),
    second = cardFixture("second"), unrelated = cardFixture("unrelated");
  const cards = [original, fork, nested, second, unrelated];
  for (const card of cards) { card.root.visibility = card.version.visibility = "public"; card.root.ownerUserId = "bob"; }
  original.data.items[0].completionStatus = "done"; original.data.signalReadings[0].reading = 8;
  original.data.tests = [{ id: "alice-personal-secret", date: "2026-10-12", result: true, createdAt: new Date() }];
  const shared = deckFixture("shared", ["original", "fork"]), archived = deckFixture("archive", ["nested"], true),
    fresh = deckFixture("fresh", ["original", "fork", "nested", "second"]);
  const decks = [shared, archived, fresh];
  for (const deck of decks) { deck.root.visibility = deck.version.visibility = "public"; deck.root.ownerUserId = "bob"; }
  shared.version.content.title = "Adopted shared Path";
  const current = structuredClone(shared.version); current.version = 2; current.content.title = "Public shared Path";
  current.content.cards = ["original", "fork", "second"].map((cardTemplateId) => ({ cardTemplateId, cardVersionAtPublish: 1 }));
  shared.root.latestVersion = 2;
  const cardV2 = structuredClone(original.version); cardV2.version = 2; cardV2.content.intro.title = "Public Card v2"; original.root.latestVersion = 2;
  await repo.cards().insertMany(cards.map((card) => card.root));
  await repo.cardVersions().insertMany([...cards.map((card) => card.version), cardV2]);
  await repo.decks().insertMany(decks.map((deck) => deck.root));
  await repo.deckVersions().insertMany([...decks.map((deck) => deck.version), current]);
  const users = [{ _id: "alice", username: "alice", decksData: [shared.data, archived.data], cardsData: cards.map((card) => card.data) },
    { _id: "bob", username: "bob", decksData: [], cardsData: [{ ...structuredClone(original.data), tests: [{ id: "bob-secret", date: "2026-10-12", result: false, createdAt: new Date() }] }] }];
  await repo.users().insertMany(users);
  const frameworks: Framework[] = [{ id: "maths", title: "Maths", areas: [{ id: "algebra", title: "Algebra", items: [
    { id: "equations", title: "Equations", cardTemplateIds: ["original", "second"] },
  ] }, { id: "empty", title: "Empty", items: [] }] }];
  const read = (actor = "alice") => readAreaDestinations(repo, actor, "maths", "algebra", frameworks);
  return { repo, frameworks, read, shared, original, fresh };
}

test("Library Area discovery matches the full published set before ranking, including more than one scan batch and the ordinary first page", async () => {
  const f = await setup();
  const filler = Array.from({ length: 55 }, (_, index) => {
    const deck = deckFixture(`filler-${String(index).padStart(2, "0")}`, ["unrelated"]);
    deck.root.visibility = deck.version.visibility = "public"; deck.root.ownerUserId = "bob";
    deck.version.publishedAt = new Date("2026-10-12T12:00:00Z"); return deck;
  });
  await f.repo.decks().insertMany(filler.map((deck) => deck.root));
  await f.repo.deckVersions().insertMany(filler.map((deck) => deck.version));
  const before = await f.repo.users().find({}).toArray();
  const ordinary = await libraryCollection(f.repo, "alice");
  assert.equal(ordinary.entries.length, 20);
  assert.ok(ordinary.entries.every((entry) => entry.deckTemplateId.startsWith("filler-")));
  const result = await f.read();
  assert.equal(result.library.state, "complete"); assert.equal(result.library.count, 1);
  assert.deepEqual(result.library.entries.map((entry) => [entry.deckTemplateId, entry.matchingCardCount]), [["fresh", 4]]);
  assert.deepEqual(await f.repo.users().find({}).toArray(), before);
});

test("personal and public fronts remain separate, use their own versions and never expose personal history or metrics across users", async () => {
  const f = await setup(), before = await f.repo.users().find({}).toArray();
  const result = await f.read(), personal = result.myDecks.entries[0];
  // Another learner without membership can discover the same public identity.
  const published = (await f.read("bob")).library.entries.find((deck) => deck.deckTemplateId === "shared")!;
  assert.equal(personal.adoptedDeckVersion, 1); assert.equal(personal.front.title, "Adopted shared Path");
  assert.equal(personal.front.context, "personal");
  assert.equal(personal.front.context === "personal" && personal.front.confidence, 8);
  assert.equal(published.front.context, "canonical"); assert.equal(published.front.title, "Public shared Path");
  assert.equal("confidence" in published.front, false); assert.equal("completion" in published.front, false);
  assert.equal(published.manifest.deckVersion, 2); assert.equal(published.manifest.cards[0].version, 2);
  assert.equal(personal.matchingCardCount, 2); assert.equal(published.matchingCardCount, 3);
  assert.deepEqual(result.library.entries.map((entry) => entry.deckTemplateId), ["fresh"]);
  const mainLibrary = await libraryDetail(f.repo, "alice", "shared");
  assert.equal(mainLibrary.availability, "available");
  if (mainLibrary.availability === "available") assert.deepEqual(mainLibrary.manifest, published.manifest);
  assert.equal(JSON.stringify(result).includes("personal-secret"), false); assert.equal(JSON.stringify(result).includes("bob-secret"), false);
  assert.deepEqual(await f.repo.users().find({}).toArray(), before);
});

test("private/unpublished Decks are excluded; unavailable public content and unresolved ancestry preserve valid results and an unknown total", async () => {
  const f = await setup();
  const privateDeck = deckFixture("private", ["original"]), draft = deckFixture("draft", ["original"]);
  draft.root.visibility = "public"; draft.root.latestVersion = 0;
  await f.repo.decks().insertMany([privateDeck.root, draft.root]); await f.repo.deckVersions().insertOne(privateDeck.version);
  assert.equal((await f.read()).library.count, 1);
  const broken = deckFixture("broken", ["nonexistent-private-card"]); broken.root.visibility = broken.version.visibility = "public";
  broken.version.content.title = "DO NOT EXPOSE unavailable content";
  await f.repo.decks().insertOne(broken.root); await f.repo.deckVersions().insertOne(broken.version);
  let result = await f.read();
  assert.equal(result.library.state, "incomplete"); assert.equal(result.library.count, null);
  assert.equal(result.library.entries.length, 1);
  assert.ok(result.library.issues.some((issue) => issue.code === "PUBLIC_CONTENT_UNAVAILABLE" && issue.deckTemplateId === "broken"));
  assert.equal(JSON.stringify(result.library).includes("nonexistent-private-card"), false);
  assert.equal(JSON.stringify(result.library).includes("DO NOT EXPOSE"), false);
  await f.repo.cards().updateOne({ cardTemplateId: "nested" }, { $set: { forkedFrom: { cardTemplateId: "missing-ancestor", version: 1 } } });
  result = await f.read();
  assert.ok(result.library.issues.some((issue) => issue.code === "UNRESOLVED_CARD_MAPPING"));
  assert.deepEqual(result.library.entries, []);
});

test("immutable public visibility, duplicate references and missing versions fail closed; genuine empty discovery remains distinct", async () => {
  const f = await setup();
  await f.repo.decks().updateMany({}, { $set: { visibility: "private" } });
  assert.equal((await f.read()).library.state, "empty");
  await f.repo.decks().updateOne({ deckTemplateId: "fresh" }, { $set: { visibility: "public" } });
  await f.repo.deckVersions().updateOne({ deckTemplateId: "fresh" }, { $set: { visibility: "private" } });
  assert.equal((await f.read()).library.state, "incomplete");
  await f.repo.deckVersions().updateOne({ deckTemplateId: "fresh" }, { $set: { visibility: "public" }, $push: { "content.cards": { cardTemplateId: "original", cardVersionAtPublish: 1 } } });
  // Duplicate published references are invalid canonical content, never extra rank credit.
  assert.equal((await f.read()).library.entries.length, 0);
  await f.repo.deckVersions().deleteOne({ deckTemplateId: "fresh" });
  assert.equal((await f.read()).library.state, "incomplete");
  const empty = await readAreaDestinations(f.repo, "alice", "maths", "empty", f.frameworks);
  assert.equal(empty.library.state, "empty"); assert.equal(empty.library.count, 0);
});

test("Library actions preserve manifest consent, stale revisions and adopted versions, including retries without duplicates", async () => {
  const f = await setup(), manifest = (await f.read()).library.entries.find((entry) => entry.deckTemplateId === "fresh")!.manifest;
  const next = structuredClone(f.fresh.version); next.version = 2; next.content.title = "Changed public publication";
  await f.repo.deckVersions().insertOne(next); await f.repo.decks().updateOne({ deckTemplateId: "fresh" }, { $set: { latestVersion: 2 } });
  await assert.rejects(f.repo.addLibraryDeck("alice", manifest), /LIBRARY_PREVIEW_CONFLICT/);
  const current = await libraryDetail(f.repo, "alice", "fresh"); assert.equal(current.availability, "available");
  if (current.availability !== "available") throw new Error("Fixture unavailable");
  await f.repo.addLibraryDeck("alice", current.manifest); await f.repo.addLibraryDeck("alice", current.manifest);
  const user = (await f.repo.getPersonalUser("alice"))!;
  assert.equal(user.decksData.filter((deck) => deck.deckTemplateId === "fresh").length, 1);
  assert.equal(user.cardsData.find((card) => card.cardTemplateId === "original")!.cardTemplateVersion, 1);
  const status = await libraryViewerStatus(f.repo, "alice", { deckTemplateIds: ["shared", "archive"], cardTemplateIds: [] });
  assert.equal(status.decks.find((deck) => deck.deckTemplateId === "shared")!.adoptedVersion, 1);
  await assert.rejects(f.repo.restoreLibraryDeck("alice", "archive", 3), /MEMBERSHIP_REVISION_CONFLICT/);
  await f.repo.restoreLibraryDeck("alice", "archive", 0);
  const reopened = await f.read();
  assert.equal(reopened.archived.count, 0); assert.equal(reopened.myDecks.count, 3); assert.equal(reopened.library.count, 0);
  f.repo.cards = () => { throw new Error("Database unavailable"); };
  await assert.rejects(f.read(), /Database unavailable/);
});

test("Progress alone excludes adopted identities across Add/archive/restore while main Library retains every publication and distinct Deck forks", async () => {
  const f = await setup();
  const fork = deckFixture("shared-fork", ["original", "fork"]);
  fork.root.ownerUserId = "bob"; fork.root.visibility = fork.version.visibility = "public";
  fork.root.forkedFrom = { deckTemplateId: "shared", version: 1 };
  fork.version.content.title = "Public shared Path";
  await f.repo.decks().insertOne(fork.root); await f.repo.deckVersions().insertOne(fork.version);
  const assertPlacement = async (section: "library" | "myDecks" | "archived") => {
    const before = await f.repo.getPersonalUser("alice"), result = await f.read();
    for (const key of ["library", "myDecks", "archived"] as const)
      assert.equal(result[key].entries.some((entry) => entry.deckTemplateId === "fresh"), key === section);
    assert.deepEqual([result.myDecks.count, result.archived.count, result.library.count],
      section === "library" ? [1, 1, 2] : section === "myDecks" ? [2, 1, 1] : [1, 2, 1]);
    assert.deepEqual(result.library.entries.map((entry) => entry.deckTemplateId), section === "library" ? ["fresh", "shared-fork"] : ["shared-fork"]);
    const ordinary = await libraryCollection(f.repo, "alice");
    assert.deepEqual(new Set(ordinary.entries.map((entry) => entry.deckTemplateId)), new Set(["shared", "archive", "fresh", "shared-fork"]));
    assert.deepEqual(await f.repo.getPersonalUser("alice"), before);
    return result;
  };
  const initial = await assertPlacement("library");
  await f.repo.addLibraryDeck("alice", initial.library.entries.find((entry) => entry.deckTemplateId === "fresh")!.manifest);
  await assertPlacement("myDecks");
  await f.repo.archiveDeckData("alice", "fresh");
  await assertPlacement("archived");
  const membership = (await f.repo.getPersonalUser("alice"))!.decksData.find((deck) => deck.deckTemplateId === "fresh")!;
  await f.repo.restoreLibraryDeck("alice", "fresh", membership.membershipRevision ?? 0);
  await assertPlacement("myDecks");
});

test("membership exclusion uses every retained Deck identity, even with unavailable or nonmatching adopted composition", async () => {
  const f = await setup();
  // Public v2 matches Algebra, while adopted v1 now contains only an unmapped Card.
  await f.repo.deckVersions().updateOne({ deckTemplateId: "shared", version: 1 }, {
    $set: { "content.cards": [{ cardTemplateId: "unrelated", cardVersionAtPublish: 1 }] },
  });
  let result = await f.read();
  assert.equal(result.myDecks.count, 0);
  assert.deepEqual(result.library.entries.map((entry) => entry.deckTemplateId), ["fresh"]);
  await f.repo.deckVersions().deleteOne({ deckTemplateId: "shared", version: 1 });
  result = await f.read();
  assert.equal(result.myDecks.state, "incomplete");
  assert.equal(result.library.count, 1);
  assert.equal(result.library.entries.some((entry) => entry.deckTemplateId === "shared"), false);
  assert.equal((await libraryDetail(f.repo, "alice", "shared")).availability, "available");
});
