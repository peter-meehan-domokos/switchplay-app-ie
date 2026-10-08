import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { libraryCollection, libraryDetail, libraryViewerStatus } from "../src/lib/cards/libraryReadModels";
import { forkCardContent } from "../src/lib/cards/forks";
import { deckDraftContent } from "../src/lib/cards/publicationRules";
import type { LibraryEntry } from "../src/lib/cards/libraryProjection";
import type { Visibility } from "../src/lib/cards/model";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri(), { monitorCommands: true }).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_library_${sequence++}`), client); await createFoundationIndexes(repo.db);
  await repo.users().insertMany(["alice", "bob", "carol"].map((_id) => ({ _id, username: _id, decksData: [], cardsData: [] })));
  return repo;
}
async function card(repo: CardRepository, owner = "bob", visibility: Visibility = "public", title = "Published Card") {
  const root = await repo.createCardDraft(owner, { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title, description: "Published instruction", mediaItem: null } }, visibility);
  await repo.publishCard(owner, root.cardTemplateId, 0); return root.cardTemplateId;
}
async function deck(repo: CardRepository, cards: string[] = [], owner = "bob", visibility: Visibility = "public", title = "Published Deck") {
  const root = await repo.createDeckDraft(owner, { ...createDefaultDeckContent([]), title, cards: cards.map((cardTemplateId) => ({ cardTemplateId })) }, visibility);
  await repo.publishDeck(owner, root.deckTemplateId, 0); return root.deckTemplateId;
}
function available(entry: LibraryEntry) {
  assert.equal(entry.availability, "available");
  if (entry.availability !== "available") throw new Error("Fixture unavailable");
  return entry;
}

test("Library is public-only even for owners, excludes unpublished public intent and makes no personal records", async () => {
  const repo = await setup(), x = await card(repo), d = await deck(repo, [x]);
  const privateDeck = await deck(repo, [], "bob", "private", "Private title");
  const draft = await repo.createDeckDraft("bob", { ...createDefaultDeckContent([]), title: "Unpublished public intent" }, "public");
  const before = await repo.users().find({}).toArray();
  assert.deepEqual((await libraryCollection(repo, "bob")).entries.map((entry) => entry.deckTemplateId), [d]);
  for (const actor of ["alice", "bob"]) {
    await assert.rejects(libraryDetail(repo, actor, privateDeck), { code: "LIBRARY_DECK_FORBIDDEN" });
    await assert.rejects(libraryDetail(repo, actor, draft.deckTemplateId), { code: "LIBRARY_DECK_FORBIDDEN" });
    await assert.rejects(libraryDetail(repo, actor, "missing"), { code: "LIBRARY_DECK_FORBIDDEN" });
    assert.equal(available(await libraryDetail(repo, actor, d)).deck.cards[0].intro.title, "Published Card");
  }
  assert.deepEqual(await repo.users().find({}).toArray(), before);
});

test("latest public Card preview differs from historical Deck provenance and older personal adoption without updating either", async () => {
  const repo = await setup(), x = await card(repo), d = await deck(repo, [x]);
  await repo.ensureDeckData("alice", d, 1);
  const immutable = await repo.getDeckVersion(d, 1), original = (await repo.getCardVersion(x, 1))!.content;
  await repo.saveCardDraft("bob", x, 1, { ...original, intro: { ...original.intro, title: "Card v2" } }); await repo.publishCard("bob", x, 2);
  await repo.saveCardDraft("bob", x, 3, { ...original, intro: { ...original.intro, title: "SECRET CARD DRAFT" } });
  const privateCard = await card(repo, "bob", "private", "SECRET PRIVATE CARD");
  await repo.saveDeckDraft("bob", d, 1, { ...deckDraftContent(immutable!.content), title: "SECRET DECK DRAFT",
    cards: [{ cardTemplateId: x }, { cardTemplateId: privateCard }] });
  const personal = await repo.getPersonalUser("alice");
  const preview = available(await libraryDetail(repo, "alice", d));
  assert.deepEqual(preview.manifest, { deckTemplateId: d, deckVersion: 1, cards: [{ cardTemplateId: x, version: 2 }] });
  assert.equal(preview.deck.title, "Published Deck"); assert.equal(preview.deck.cards[0].intro.title, "Card v2");
  assert.equal(JSON.stringify(preview).includes("SECRET"), false);
  assert.deepEqual(await repo.getPersonalUser("alice"), personal); assert.deepEqual(await repo.getDeckVersion(d, 1), immutable);
  await repo.ensureDeckData("carol", d, 1);
  assert.equal((await repo.getPersonalUser("carol"))!.cardsData[0].cardTemplateVersion, 2);
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].cardTemplateVersion, 1);
});

test("private-era/missing visibility versions fail closed for Library even when current roots are public and viewer is owner", async () => {
  const repo = await setup(), x = await card(repo, "bob", "private", "PRIVATE ERA"), d = await deck(repo, [x], "bob", "private", "PRIVATE DECK ERA");
  await repo.promoteCard("bob", x, 1); await repo.publishCard("bob", x, 2);
  await repo.saveDeckDraft("bob", d, 1, { ...deckDraftContent((await repo.getDeckVersion(d, 1))!.content), title: "Now public" }, "public"); await repo.publishDeck("bob", d, 2);
  assert.equal(available(await libraryDetail(repo, "alice", d)).manifest.deckVersion, 2);
  await repo.decks().updateOne({ deckTemplateId: d }, { $set: { latestVersion: 1 } });
  for (const actor of ["alice", "bob"]) assert.equal((await libraryDetail(repo, actor, d)).availability, "unavailable");
  assert.equal(JSON.stringify((await libraryCollection(repo, "bob")).entries).includes("PRIVATE ERA"), false);
  await repo.decks().updateOne({ deckTemplateId: d }, { $set: { latestVersion: 2 } });
  await repo.cards().updateOne({ cardTemplateId: x }, { $set: { latestVersion: 1 } });
  for (const actor of ["alice", "bob"]) assert.equal((await libraryDetail(repo, actor, d)).availability, "unavailable");
  await repo.cards().updateOne({ cardTemplateId: x }, { $set: { latestVersion: 2 } });
  await repo.cardVersions().updateOne({ cardTemplateId: x, version: 2 }, { $unset: { visibility: "" } });
  assert.equal((await libraryDetail(repo, "bob", d)).availability, "unavailable");
  await repo.cardVersions().updateOne({ cardTemplateId: x, version: 2 }, { $set: { visibility: "public" } });
  await repo.deckVersions().updateOne({ deckTemplateId: d, version: 2 }, { $unset: { visibility: "" } });
  assert.equal((await libraryDetail(repo, "bob", d)).availability, "unavailable");
});

test("one broken public Deck retains a safe entry; missing/private Card metadata never leaks and valid/empty Decks survive", async () => {
  const repo = await setup(), x = await card(repo), broken = await deck(repo, [x]), empty = await deck(repo, [], "bob", "public", "Empty public Deck");
  await repo.cards().deleteOne({ cardTemplateId: x });
  const list = await libraryCollection(repo, "alice");
  assert.equal(list.entries.length, 2);
  assert.equal(list.entries.find((entry) => entry.deckTemplateId === broken)!.availability, "unavailable");
  assert.deepEqual(available(list.entries.find((entry) => entry.deckTemplateId === empty)!).manifest.cards, []);
  assert.equal(JSON.stringify(list).includes(x), false);
  await repo.deckVersions().updateOne({ deckTemplateId: broken, version: 1 }, { $set: { content: null as never } });
  assert.equal((await libraryDetail(repo, "bob", broken)).availability, "unavailable");
  await repo.deckVersions().deleteOne({ deckTemplateId: broken, version: 1 });
  const missing = (await libraryCollection(repo, "alice")).entries.find((entry) => entry.deckTemplateId === broken)!;
  assert.equal(missing.availability, "unavailable"); assert.equal(missing.publishedAt, null);
});

test("publication ordering and tied timestamp cursors are stable; draft edits do not move Decks", async () => {
  const repo = await setup(), a = await deck(repo, [], "bob", "public", "A"), b = await deck(repo, [], "bob", "public", "B"), c = await deck(repo, [], "bob", "public", "C");
  const date = new Date("2026-10-08T10:00:00Z");
  await repo.deckVersions().updateMany({}, { $set: { publishedAt: date } });
  await repo.saveDeckDraft("bob", a, 1, { ...createDefaultDeckContent([]), title: "Unpublished newest" });
  const ids: string[] = []; let cursor: string | undefined;
  do { const page = await libraryCollection(repo, "alice", { limit: 1, cursor }); ids.push(...page.entries.map((entry) => entry.deckTemplateId)); cursor = page.nextCursor ?? undefined; } while (cursor);
  assert.deepEqual(ids, [a, b, c].sort());
  await repo.publishDeck("bob", a, 2);
  assert.equal((await libraryCollection(repo, "alice")).entries[0].deckTemplateId, a);
});

test("batched attribution identifies only the immediate source owner and uses a neutral missing-account fallback", async () => {
  const repo = await setup(), x = await card(repo);
  const fork = async (owner: string, sourceId: string) => {
    const source = { cardTemplateId: sourceId, version: 1 }, stepIds = [randomUUID(), randomUUID(), randomUUID()];
    const content = forkCardContent((await repo.getCardVersion(sourceId, 1))!.content, source, stepIds), id = randomUUID();
    await repo.createCardFork(owner, { source, cardTemplateId: id, stepIds, context: { kind: "library" }, content: { ...content, intro: { ...content.intro, title: `${owner}'s fork` } } });
    await repo.promoteCard(owner, id, 0); await repo.publishCard(owner, id, 1); return id;
  };
  const b = await fork("alice", x), c = await fork("carol", b), d = await deck(repo, [c], "carol");
  assert.deepEqual(available(await libraryDetail(repo, "bob", d)).deck.cards[0].creator, { username: "carol", immediateSourceUsername: "alice" });
  await repo.users().deleteOne({ _id: "alice" as never });
  const projected = available(await libraryDetail(repo, "bob", d));
  assert.equal(projected.deck.cards[0].creator.immediateSourceUsername, "Unknown creator");
  assert.equal(JSON.stringify(projected).includes(b), false); // No internal source identity.
});

test("viewer status is actor-scoped, canonical response is identical across users, and source-stored personal history never overlays Library", async () => {
  const repo = await setup(), x = await card(repo), d = await deck(repo, [x]); await repo.ensureDeckData("alice", d, 1);
  await repo.users().updateOne({ _id: "alice" as never }, { $set: { "cardsData.0.reflection": "PRIVATE REFLECTION", "cardsData.0.targetDate": "2027-01-01",
    "cardsData.0.chats": [{ id: "private-chat", deckTemplateId: d, comments: [] }], "cardsData.0.tests": [{ private: true }],
    "cardsData.0.items.0.completionStatus": "skipped", "cardsData.0.signalReadings.0.reading": 8 } });
  const before = await repo.getPersonalUser("alice");
  assert.deepEqual(await libraryDetail(repo, "alice", d), await libraryDetail(repo, "bob", d));
  const requested = { deckTemplateIds: [d], cardTemplateIds: [x] };
  const alice = await libraryViewerStatus(repo, "alice", requested), bob = await libraryViewerStatus(repo, "bob", requested);
  assert.equal(alice.viewerUserId, "alice"); assert.equal(alice.decks[0].state, "active"); assert.equal(alice.cards[0].activeDecks.length, 1);
  assert.equal(bob.decks[0].state, "not-added"); assert.equal(bob.cards[0].hasPersonalData, false); assert.deepEqual(bob.cards[0].activeDecks, []);
  for (const json of [JSON.stringify(alice), JSON.stringify(bob), JSON.stringify(await libraryDetail(repo, "alice", d))]) {
    assert.equal(/PRIVATE REFLECTION|private-chat|2027-01-01|skipped|signalReadings/.test(json), false);
  }
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
});

test("Open Card destinations use exact adopted active composition, not ownership, draft references, latest Deck composition or archived membership", async () => {
  const repo = await setup(), x = await card(repo), y = await card(repo, "bob", "public", "Other Card");
  const a = await deck(repo, [x], "bob", "public", "Same title"), b = await deck(repo, [x], "bob", "public", "Same title"), other = await deck(repo, [y]);
  await repo.ensureDeckData("alice", a, 1); await repo.ensureDeckData("alice", b, 1); await repo.ensureDeckData("alice", other, 1);
  await deck(repo, [x], "alice", "public", "Owned but not adopted");
  await repo.saveDeckDraft("bob", other, 1, { ...deckDraftContent((await repo.getDeckVersion(other, 1))!.content), cards: [{ cardTemplateId: x }] });
  await repo.publishDeck("bob", other, 2);
  const request = { deckTemplateIds: [a, b, other], cardTemplateIds: [x] };
  assert.deepEqual((await libraryViewerStatus(repo, "alice", request)).cards[0].activeDecks.map((d) => d.deckTemplateId).sort(), [a, b].sort());
  await repo.archiveDeckData("alice", b);
  const one = await libraryViewerStatus(repo, "alice", request);
  assert.equal(one.cards[0].activeDecks.length, 1); assert.equal(one.cards[0].activeDecks[0].deckTemplateId, a);
  assert.equal(one.decks.find((d) => d.deckTemplateId === b)!.state, "archived");
  await repo.archiveDeckData("alice", a);
  assert.deepEqual((await libraryViewerStatus(repo, "alice", request)).cards[0].activeDecks, []);
  assert.ok((await repo.getPersonalUser("alice"))!.cardsData.some((data) => data.cardTemplateId === x));
});

test("unavailable retained Deck/Card versions do not authorize Open Card; status reads do not restore or initialize first-open state", async () => {
  const repo = await setup(), x = await card(repo), d = await deck(repo, [x]); await repo.ensureDeckData("alice", d, 1);
  const request = { deckTemplateIds: [d], cardTemplateIds: [x] }, before = await repo.getPersonalUser("alice");
  await libraryViewerStatus(repo, "alice", request);
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.cardVersions().updateOne({ cardTemplateId: x, version: 1 }, { $unset: { visibility: "" } });
  assert.deepEqual((await libraryViewerStatus(repo, "alice", request)).cards[0].activeDecks, []);
  await repo.cardVersions().updateOne({ cardTemplateId: x, version: 1 }, { $set: { visibility: "public" } });
  await repo.deckVersions().deleteOne({ deckTemplateId: d, version: 1 });
  const broken = await libraryViewerStatus(repo, "alice", request);
  assert.equal(broken.decks[0].state, "active"); assert.equal(broken.decks[0].retainedDeckVersionAvailable, false); assert.deepEqual(broken.cards[0].activeDecks, []);
});

test("read-only snapshot captures a coherent old manifest when Card publication commits during preview", async () => {
  const repo = await setup(), x = await card(repo), d = await deck(repo, [x]);
  const collection = repo.cards(), find = collection.find.bind(collection);
  let resume!: () => void, captured!: () => void;
  const held = new Promise<void>((resolve) => { resume = resolve; }), seen = new Promise<void>((resolve) => { captured = resolve; });
  const originalCards = repo.cards.bind(repo);
  repo.cards = () => collection;
  let intercepted = false;
  collection.find = ((...args: Parameters<typeof find>) => {
    const cursor = find(...args), toArray = cursor.toArray.bind(cursor);
    cursor.toArray = async () => { const result = await toArray(); if (!intercepted) { intercepted = true; captured(); await held; } return result; };
    return cursor;
  }) as typeof collection.find;
  try {
    const pending = libraryDetail(repo, "alice", d); await seen;
    const content = (await repo.getCardVersion(x, 1))!.content;
    await repo.saveCardDraft("bob", x, 1, { ...content, intro: { ...content.intro, title: "Newly published" } }); await repo.publishCard("bob", x, 2);
    resume(); const preview = available(await pending);
    assert.equal(preview.manifest.cards[0].version, 1); assert.equal(preview.deck.cards[0].version, 1);
    repo.cards = originalCards;
    assert.equal(available(await libraryDetail(repo, "alice", d)).manifest.cards[0].version, 2);
  } finally { resume(); repo.cards = originalCards; }
});

test("collection work is batched, personal values are not queried, and Library performs no canonical or personal writes", async () => {
  const repo = await setup(), x = await card(repo); await deck(repo, [x]); await deck(repo, [x]);
  const commands: { commandName: string; command: Record<string, unknown> }[] = [];
  const listener = (event: { commandName: string; command: Record<string, unknown> }) => { if (event.command.$db === repo.db.databaseName) commands.push(event); };
  client.on("commandStarted", listener);
  try { await libraryCollection(repo, "alice"); await libraryViewerStatus(repo, "alice", { deckTemplateIds: [], cardTemplateIds: [x] }); }
  finally { client.off("commandStarted", listener); }
  assert.equal(commands.some((event) => ["insert", "update", "delete", "findAndModify"].includes(event.commandName)), false);
  // Two shared Cards do not cause per-Deck/per-Card repository reads.
  assert.ok(commands.filter((event) => event.commandName === "find" || event.commandName === "aggregate").length <= 10);
  for (const event of commands.filter((event) => event.command.find === "users")) {
    assert.ok(event.command.projection); assert.equal(JSON.stringify(event.command.projection).includes("reflection"), false);
  }
});
