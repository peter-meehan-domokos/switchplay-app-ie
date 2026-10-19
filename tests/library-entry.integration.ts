import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { libraryDetail, libraryViewerStatus } from "../src/lib/cards/libraryReadModels";
import { deckDraftContent } from "../src/lib/cards/publicationRules";
import { deckContentHash } from "../src/lib/cards/cardReuse";
import { membershipDTO } from "../src/lib/cards/readModels";
import type { LibraryPreviewManifest } from "../src/lib/cards/libraryProjection";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function fixture(count = 2) {
  const repo = new CardRepository(client.db(`switchplay_test_entry_${sequence++}`), client); await createFoundationIndexes(repo.db);
  await repo.users().insertMany(["alice", "bob", "carol"].map((_id) => ({ _id, decksData: [], cardsData: [] })));
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const root = await repo.createCardDraft("bob", { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: `Instruction ${index}`, description: "", mediaItem: null } }, "public");
    await repo.publishCard("bob", root.cardTemplateId, 0); ids.push(root.cardTemplateId);
  }
  const d = await repo.createDeckDraft("bob", { ...createDefaultDeckContent([]), title: "Public programme", cards: ids.map((cardTemplateId) => ({ cardTemplateId })) }, "public");
  await repo.publishDeck("bob", d.deckTemplateId, 0);
  return { repo, id: d.deckTemplateId, ids, manifest: await manifest(repo, d.deckTemplateId) };
}
async function manifest(repo: CardRepository, id: string): Promise<LibraryPreviewManifest> {
  const entry = await libraryDetail(repo, "alice", id); assert.equal(entry.availability, "available");
  if (entry.availability !== "available") throw new Error("Unavailable fixture"); return entry.manifest;
}
async function newerCard(repo: CardRepository, id: string) {
  const root = (await repo.cards().findOne({ cardTemplateId: id }))!, content = (await repo.getCardVersion(id, root.latestVersion))!.content;
  await repo.saveCardDraft("bob", id, root.revision, { ...content, intro: { ...content.intro, title: "New published instruction" } });
  await repo.publishCard("bob", id, root.revision + 1);
}
async function newerDeck(repo: CardRepository, id: string) {
  const root = (await repo.decks().findOne({ deckTemplateId: id }))!, content = (await repo.getDeckVersion(id, root.latestVersion))!.content;
  await repo.saveDeckDraft("bob", id, root.revision, { ...deckDraftContent(content), title: "New published composition" });
  await repo.publishDeck("bob", id, root.revision + 1);
}

test("Add pins current Cards, leaves Deck unopened and cadence dates unset, and does not clone or alter authoring revisions", async () => {
  const { repo, id, ids, manifest } = await fixture();
  const cardRoots = await repo.cards().find({}).toArray(), deckRoot = (await repo.decks().findOne({ deckTemplateId: id }))!;
  const result = await repo.addLibraryDeck("alice", manifest); assert.equal(result.outcome, "added"); assert.deepEqual(result.adoptedCards, manifest.cards);
  assert.equal(result.viewerUserId, "alice");
  const user = (await repo.getPersonalUser("alice"))!, data = user.decksData[0];
  assert.equal(data.openedAt, null); assert.equal(data.activeCardId, null); assert.equal(data.cadenceAnchorDate, null);
  assert.deepEqual(user.cardsData.map((card) => card.targetDate), [null, null]);
  assert.equal(await repo.cards().countDocuments(), 2); assert.equal(await repo.decks().countDocuments(), 1);
  assert.deepEqual((await repo.cards().find({}).toArray()).map((root) => root.revision), cardRoots.map((root) => root.revision));
  const guarded = (await repo.decks().findOne({ deckTemplateId: id }))!;
  assert.equal(guarded.revision, deckRoot.revision); assert.deepEqual(guarded.updatedAt, deckRoot.updatedAt);
  assert.equal(guarded.publicationGuard, 1); assert.equal(user.cardsData.every((card) => ids.includes(card.cardTemplateId)), true);
  assert.deepEqual((await repo.getPersonalUser("bob"))!.cardsData, []);
});

test("new entrants adopt latest Card, historical Deck pins stay immutable and existing older personal data is preserved entirely", async () => {
  const { repo, id, ids } = await fixture(); await repo.ensureCardData("alice", ids[0], 1);
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.reflection": "Keep reflection", "cardsData.0.items.0.completionStatus": "skipped",
    "cardsData.0.signalReadings.0.reading": 7, "cardsData.0.targetDate": "2027-02-02",
    "cardsData.0.mediaItems": [{ id: "personal", description: "Retained evidence", mediaType: "image", src: "https://example.test/evidence.png" }],
    "cardsData.0.chats": [{ id: "retained-chat", deckTemplateId: "original-deck-context", comments: [] }], "cardsData.0.tests": [{ id: "retained", date: "2026-01-01", result: true, createdAt: new Date() }] } });
  const source = (await repo.getPersonalUser("alice"))!.cardsData[0], immutable = await repo.getDeckVersion(id, 1);
  await newerCard(repo, ids[0]); const current = await manifest(repo, id);
  const result = await repo.addLibraryDeck("alice", current);
  assert.equal(result.adoptedCards[0].version, 1); assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData[0], source);
  await repo.addLibraryDeck("carol", current); assert.equal((await repo.getPersonalUser("carol"))!.cardsData[0].cardTemplateVersion, 2);
  assert.deepEqual(await repo.getDeckVersion(id, 1), immutable);
});

test("stale Deck or any Card preview rejects atomically with a safe refreshed manifest; local drafts are not stale previews", async () => {
  for (const entity of ["card", "deck"]) {
    const { repo, id, ids, manifest: displayed } = await fixture();
    if (entity === "card") await newerCard(repo, ids[1]); else await newerDeck(repo, id);
    const expected = await manifest(repo, id);
    await assert.rejects(repo.addLibraryDeck("alice", displayed), (error: unknown) => {
      assert.equal((error as { code: string }).code, "LIBRARY_PREVIEW_CONFLICT");
      assert.deepEqual((error as { latestManifest: unknown }).latestManifest, expected); return true;
    });
    assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []); assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
    await repo.addLibraryDeck("alice", expected);
  }
  const { repo, ids, manifest: displayed } = await fixture();
  const original = (await repo.getCardVersion(ids[0], 1))!.content;
  await repo.saveCardDraft("bob", ids[0], 1, { ...original, intro: { ...original.intro, title: "Unpublished" } });
  await repo.addLibraryDeck("alice", displayed); assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].cardTemplateVersion, 1);
});

test("concurrent Add creates one Deck membership and one global CardData per identity across several Decks", async () => {
  const { repo, id, ids, manifest: displayed } = await fixture();
  const other = await repo.createDeckDraft("bob", { ...createDefaultDeckContent([]), title: "Shared Cards", cards: ids.map((cardTemplateId) => ({ cardTemplateId })) }, "public");
  await repo.publishDeck("bob", other.deckTemplateId, 0); const second = await manifest(repo, other.deckTemplateId);
  const results = await Promise.all([repo.addLibraryDeck("alice", displayed), repo.addLibraryDeck("alice", displayed), repo.addLibraryDeck("alice", second)]);
  assert.equal(results.filter((result) => result.outcome === "added").length, 2);
  const user = (await repo.getPersonalUser("alice"))!; assert.equal(user.decksData.length, 2); assert.equal(user.cardsData.length, 2);
  assert.equal(user.decksData.filter((data) => data.deckTemplateId === id).length, 1);
});

test("lost Add response/retry after Archive never restores or upgrades; fresh Restore preserves versions and retry cannot reverse later Archive", async () => {
  const { repo, id, ids, manifest: displayed } = await fixture(); await repo.addLibraryDeck("alice", displayed);
  await repo.archiveDeckData("alice", id); await newerCard(repo, ids[0]); await newerDeck(repo, id);
  const before = (await repo.getPersonalUser("alice"))!;
  const retry = await repo.addLibraryDeck("alice", displayed); assert.equal(retry.outcome, "archived");
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  const status = await libraryViewerStatus(repo, "alice", { deckTemplateIds: [id], cardTemplateIds: [] });
  assert.equal(status.decks[0].membershipRevision, 1);
  const restored = await repo.restoreLibraryDeck("alice", id, 1); assert.equal(restored.outcome, "restored"); assert.equal(restored.adoptedDeckVersion, 1);
  assert.equal(restored.adoptedCards[0].version, 1);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].openedAt, null);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].cadenceAnchorDate, null);
  assert.equal((await repo.restoreLibraryDeck("alice", id, 1)).outcome, "already-active");
  await repo.archiveDeckData("alice", id); const archived = await repo.getPersonalUser("alice");
  await assert.rejects(repo.restoreLibraryDeck("alice", id, 1), { code: "MEMBERSHIP_REVISION_CONFLICT" });
  assert.deepEqual(await repo.getPersonalUser("alice"), archived);
  await repo.restoreLibraryDeck("alice", id, 3);
  assert.equal((await membershipDTO(repo, "alice"))[0].membershipRevision, 4);
});

test("concurrent Restore acknowledges one transition; other users cannot restore or open the membership", async () => {
  const { repo, id, ids, manifest } = await fixture(); await repo.addLibraryDeck("alice", manifest); await repo.archiveDeckData("alice", id);
  const results = await Promise.all([repo.restoreLibraryDeck("alice", id, 1), repo.restoreLibraryDeck("alice", id, 1)]);
  assert.deepEqual(results.map((result) => result.outcome).sort(), ["already-active", "restored"]);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].membershipRevision, 2);
  await assert.rejects(repo.restoreLibraryDeck("carol", id, 1), { code: "MISSING_MEMBERSHIP" });
  await assert.rejects(repo.openWorkingDeck("carol", id, "2026-10-08", ids[0]), { code: "WORKING_DECK_REQUIRED" });
});

test("unavailable retained Deck/Card versions block Restore without partial writes or silent latest-version adoption", async () => {
  for (const missing of ["deck", "card"]) {
    const { repo, id, ids, manifest } = await fixture(); await repo.addLibraryDeck("alice", manifest); await repo.archiveDeckData("alice", id);
    if (missing === "deck") await repo.deckVersions().deleteOne({ deckTemplateId: id, version: 1 });
    else await repo.cardVersions().deleteOne({ cardTemplateId: ids[0], version: 1 });
    const before = await repo.getPersonalUser("alice");
    await assert.rejects(repo.restoreLibraryDeck("alice", id, 1), { code: missing === "deck" ? "MISSING_DECK_VERSION" : "MISSING_CARD_VERSION" });
    assert.deepEqual(await repo.getPersonalUser("alice"), before);
  }
});

test("targeted first open initializes all dates and cadence, retains prior dates/adoption, and revalidates adopted composition", async () => {
  const { repo, id, ids, manifest } = await fixture(); await repo.addLibraryDeck("alice", manifest);
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.targetDate": "2027-01-01" } });
  const before = await repo.getPersonalUser("alice");
  await assert.rejects(repo.openWorkingDeck("alice", id, "2026-10-08", "unrelated"), { code: "TARGET_CARD_CONTEXT_UNAVAILABLE" });
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.openWorkingDeck("alice", id, "2026-10-08", ids[1]);
  let user = (await repo.getPersonalUser("alice"))!;
  assert.equal(user.decksData[0].activeCardId, ids[1]); assert.equal(user.decksData[0].cadenceAnchorDate, "2026-10-08"); assert.ok(user.decksData[0].openedAt);
  assert.equal(user.cardsData[0].targetDate, "2027-01-01"); assert.equal(user.cardsData[1].targetDate, "2026-10-22");
  await newerCard(repo, ids[1]); await repo.openWorkingDeck("alice", id, "2027-01-01", ids[0]); user = (await repo.getPersonalUser("alice"))!;
  assert.equal(user.decksData[0].cadenceAnchorDate, "2026-10-08"); assert.equal(user.cardsData[1].cardTemplateVersion, 1);
  await repo.archiveDeckData("alice", id);
  await assert.rejects(repo.openWorkingDeck("alice", id, "2027-01-01", ids[0]), { code: "WORKING_DECK_REQUIRED" });
});

test("empty public Deck Add/Restore/open establishes the anchor only on open, with a null active Card", async () => {
  const { repo, id, manifest } = await fixture(0); await repo.addLibraryDeck("alice", manifest);
  await repo.archiveDeckData("alice", id); await repo.restoreLibraryDeck("alice", id, 1);
  assert.equal((await repo.getPersonalUser("alice"))!.decksData[0].cadenceAnchorDate, null);
  await repo.openWorkingDeck("alice", id, "2026-10-08"); const user = (await repo.getPersonalUser("alice"))!;
  assert.equal(user.decksData[0].activeCardId, null); assert.equal(user.decksData[0].cadenceAnchorDate, "2026-10-08"); assert.deepEqual(user.cardsData, []);
});

// Pause a real Add after its snapshot reads but BEFORE the first guarded write.
// Publication commits in the gap; Mongo retries the transaction and the immutable
// manifest must then be rejected. No sleep/timing assumption is involved.
for (const entity of ["card", "deck"] as const) test(`competing ${entity} publication cannot slip between Add freshness reads and commit`, async () => {
  const { repo, id, ids, manifest } = await fixture(); const adding = new CardRepository(repo.db, client);
  const collection = adding.cards(), update = collection.updateOne.bind(collection);
  let entered!: () => void, release!: () => void;
  const paused = new Promise<void>((resolve) => { entered = resolve; }), resumed = new Promise<void>((resolve) => { release = resolve; });
  let once = true;
  collection.updateOne = async (...args: Parameters<typeof update>) => {
    if (once && !Array.isArray(args[1]) && args[1].$inc?.referenceRevision) { once = false; entered(); await resumed; }
    return update(...args);
  };
  adding.cards = () => collection;
  const pending = adding.addLibraryDeck("alice", manifest);
  const rejected = assert.rejects(pending, { code: "LIBRARY_PREVIEW_CONFLICT" });
  await paused;
  try { if (entity === "card") await newerCard(repo, ids[0]); else await newerDeck(repo, id); } finally { release(); }
  await rejected;
  assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []); assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
});

test("transaction rollback after CardData creation leaves no half-import and retry can finish normally", async () => {
  const { repo, manifest } = await fixture(); const adding = new CardRepository(repo.db, client), collection = adding.users(), update = collection.updateOne.bind(collection);
  collection.updateOne = async (...args: Parameters<typeof update>) => {
    if (!Array.isArray(args[1]) && args[1].$push?.decksData) throw new Error("Injected entry failure"); return update(...args);
  };
  adding.users = () => collection;
  await assert.rejects(adding.addLibraryDeck("alice", manifest), /Injected entry failure/);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []); assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []);
  assert.equal((await repo.addLibraryDeck("alice", manifest)).outcome, "added");
});

test("Library Add fails closed for private/unpublished and private-era immutable versions, including owner requests", async () => {
  const { repo, id, ids, manifest } = await fixture();
  await repo.cardVersions().updateOne({ cardTemplateId: ids[0], version: 1 }, { $set: { visibility: "private" } });
  for (const actor of ["alice", "bob"]) await assert.rejects(repo.addLibraryDeck(actor, manifest), { code: "LIBRARY_CARD_FORBIDDEN" });
  await repo.cardVersions().updateOne({ cardTemplateId: ids[0], version: 1 }, { $set: { visibility: "public" } });
  await repo.deckVersions().updateOne({ deckTemplateId: id, version: 1 }, { $unset: { visibility: "" } });
  await assert.rejects(repo.addLibraryDeck("bob", manifest), { code: "LIBRARY_DECK_FORBIDDEN" });
  assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []);
});

test("ordered guards serialize Add with Copy auto-publication, without changing authoring revisions or publishing extra versions", async () => {
  const { repo, id, ids, manifest } = await fixture();
  const extra = await repo.createCardDraft("bob", { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Copied public Card", description: "", mediaItem: null } }, "public");
  await repo.publishCard("bob", extra.cardTemplateId, 0);
  const adding = new CardRepository(repo.db, client), collection = adding.cards(), update = collection.updateOne.bind(collection);
  let enter!: () => void, resume!: () => void, once = true;
  const paused = new Promise<void>((resolve) => { enter = resolve; }), release = new Promise<void>((resolve) => { resume = resolve; });
  collection.updateOne = async (...args: Parameters<typeof update>) => {
    if (once && !Array.isArray(args[1]) && args[1].$inc?.referenceRevision) { once = false; enter(); await release; }
    return update(...args);
  };
  adding.cards = () => collection;
  const result = adding.addLibraryDeck("alice", manifest), rejected = assert.rejects(result, { code: "LIBRARY_PREVIEW_CONFLICT" });
  await paused;
  try {
    const copy = await repo.copyOwnedCard("bob", extra.cardTemplateId, { deckTemplateId: id, revision: 1, contentHash: deckContentHash(deckDraftContent((await repo.getDeckVersion(id, 1))!.content)) });
    assert.equal(copy.outcome, "published");
  } finally { resume(); }
  await rejected; assert.equal(await repo.deckVersions().countDocuments({ deckTemplateId: id }), 2);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
  for (const cardTemplateId of ids) assert.equal((await repo.cards().findOne({ cardTemplateId }))!.revision, 1);
});

test("Add acquires Card guards by stable identity before its Deck guard", async () => {
  const { repo, id, ids, manifest } = await fixture(), adding = new CardRepository(repo.db, client);
  const cards = adding.cards(), decks = adding.decks(), cardUpdate = cards.updateOne.bind(cards), deckUpdate = decks.updateOne.bind(decks), order: string[] = [];
  cards.updateOne = async (...args: Parameters<typeof cardUpdate>) => { order.push(`card:${args[0].cardTemplateId}`); return cardUpdate(...args); };
  decks.updateOne = async (...args: Parameters<typeof deckUpdate>) => { order.push(`deck:${args[0].deckTemplateId}`); return deckUpdate(...args); };
  adding.cards = () => cards; adding.decks = () => decks;
  await adding.addLibraryDeck("alice", manifest);
  assert.deepEqual(order, [...ids.sort().map((cardTemplateId) => `card:${cardTemplateId}`), `deck:${id}`]);
});

test("a concurrent personal edit survives Add retry without a mixed or overwritten personal projection", async () => {
  const { repo, ids, manifest } = await fixture(); await repo.ensureCardData("alice", ids[0], 1);
  const adding = new CardRepository(repo.db, client), collection = adding.cards(), update = collection.updateOne.bind(collection);
  let enter!: () => void, resume!: () => void, once = true;
  const paused = new Promise<void>((resolve) => { enter = resolve; }), release = new Promise<void>((resolve) => { resume = resolve; });
  collection.updateOne = async (...args: Parameters<typeof update>) => {
    if (once && !Array.isArray(args[1]) && args[1].$inc?.referenceRevision) { once = false; enter(); await release; }
    return update(...args);
  };
  adding.cards = () => collection;
  const result = adding.addLibraryDeck("alice", manifest); await paused;
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.reflection": "Concurrent reflection", "cardsData.0.targetDate": "2027-01-01",
    "cardsData.0.items.0.completionStatus": "skipped", "cardsData.0.signalReadings.0.reading": 6 } });
  const expected = (await repo.getPersonalUser("alice"))!.cardsData[0]; resume(); await result;
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData[0], expected);
});

test("reconciliation initializes only missing CardData, and broken-reference removal remains possible", async () => {
  const { repo, id, ids, manifest } = await fixture(); await repo.addLibraryDeck("alice", manifest);
  await repo.users().updateOne({ _id: "alice" }, { $pull: { cardsData: { cardTemplateId: ids[1] } } });
  const retained = (await repo.getPersonalUser("alice"))!.cardsData[0]; await newerCard(repo, ids[1]);
  const result = await repo.addLibraryDeck("alice", manifest); assert.equal(result.outcome, "already-active");
  assert.equal(result.adoptedCards[1].version, 2); assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData[0], retained);
  await repo.cards().deleteOne({ cardTemplateId: ids[1] });
  await repo.saveDeckDraft("bob", id, 1, { ...deckDraftContent((await repo.getDeckVersion(id, 1))!.content), cards: [{ cardTemplateId: ids[0] }] });
  assert.equal((await repo.decks().findOne({ deckTemplateId: id }))!.draft!.cards.length, 1);
});

test("working open batches four adopted Card reads without changing dates, adoption or access checks", async () => {
  const { repo, id, ids, manifest: reviewed } = await fixture(4);
  await repo.addLibraryDeck("alice", reviewed);
  const monitored = await new MongoClient(mongo.getUri(), { monitorCommands: true }).connect();
  const reads: string[] = [];
  monitored.on("commandStarted", event => {
    if (event.commandName === "find" && ["cardTemplates", "cardTemplateVersions"].includes(event.command.find)) reads.push(event.command.find);
  });
  try {
    const opening = new CardRepository(monitored.db(repo.db.databaseName), monitored);
    await opening.openWorkingDeck("alice", id, "2026-10-19", ids[2], 1);
    assert.deepEqual(reads, ["cardTemplates", "cardTemplateVersions"]);
    const first = (await repo.getPersonalUser("alice"))!;
    assert.equal(first.decksData[0].activeCardId, ids[2]);
    assert.deepEqual(first.cardsData.map(card => card.targetDate), ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"]);
    reads.length = 0;
    await opening.openWorkingDeck("alice", id, "2026-12-01");
    assert.deepEqual(reads, ["cardTemplates", "cardTemplateVersions"]);
    const reopened = (await repo.getPersonalUser("alice"))!;
    assert.equal(reopened.decksData[0].activeCardId, ids[2]);
    assert.equal(reopened.decksData[0].cadenceAnchorDate, "2026-10-19");
    assert.deepEqual(reopened.cardsData, first.cardsData);
    await repo.cardVersions().updateOne({ cardTemplateId: ids[3], version: 1 }, { $set: { visibility: "private" } });
    const beforeDenied = await repo.getPersonalUser("alice");
    await assert.rejects(opening.openWorkingDeck("alice", id, "2026-12-01"), /CARD_VERSION_FORBIDDEN/);
    assert.deepEqual(await repo.getPersonalUser("alice"), beforeDenied);
  } finally { await monitored.close(); }
});
