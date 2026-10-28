import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { InfoCardRepository, createInfoCardIndexes } from "../src/lib/infoCards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { sameContent } from "../src/lib/cards/publicationRules";
import { assertCardContent } from "../src/lib/cards/domain";
import { forkCardContent } from "../src/lib/cards/forks";
import { deckContentHash } from "../src/lib/cards/cardReuse";
import { workingDTO } from "../src/lib/cards/readModels";
import { cardContentPresentation } from "../src/lib/cards/libraryProjection";
import { creatorBoard, privateGraph } from "../src/components/creator/cardArchitectureAdapter";
import { creatorBoardToDeckTemplate, createCreatorBoardFromTemplate } from "../src/components/creator/creatorBoardState";
import type { CardContent } from "../src/lib/cards/model";
import { mainInfoConsultation, publicationSnapshotEntries, publishedSnapshot } from "../src/lib/infoCards/queries";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(mongo.getUri()).connect();
});
after(async () => { await client?.close(); await mongo?.stop(); });
async function setup() {
  const main = new CardRepository(client.db(`switchplay_test_info_attachments_${sequence++}`), client);
  await createFoundationIndexes(main.db); await createInfoCardIndexes(main.db);
  await main.users().insertMany(["alice", "bob"].map(_id => ({ _id, username: _id, cardsData: [], decksData: [] })));
  const info = new InfoCardRepository(main.db, client);
  await info.createSeries("alice", "series", "Basics");
  for (const [id, visibility] of [["a", "public"], ["b", "public"], ["private", "private"]] as const) {
    await info.create("alice", id);
    await info.save("alice", id, 0, { title: "Signs", body: "Keep the sign with the number.", seriesId: "series", mediaItem: null }, visibility);
    await info.publish("alice", id, 1);
  }
  return { main, info };
}
function content(ids?: string[]): CardContent {
  return { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]),
    intro: { title: "Practice", description: "Keep this introduction", mediaItem: null },
    ...(ids !== undefined ? { infoCardIds: ids } : {}) };
}
const deck = (ids: string[]) => ({ ...createDefaultDeckContent([]), title: "Practice Deck", cards: ids.map(cardTemplateId => ({ cardTemplateId })) });
function barrier() {
  let release!: () => void, entered!: () => void;
  return { gate: new Promise<void>(resolve => { release = resolve; }), reached: new Promise<void>(resolve => { entered = resolve; }),
    release: () => release(), entered: () => entered() };
}

test("main attachment validation/equality preserves order and only treats absent/empty lists alike", () => {
  const base = content();
  assertCardContent({ ...base, infoCardIds: [] });
  assert.equal(sameContent(base, { ...base, infoCardIds: [] }), true);
  assert.equal(sameContent({ infoCardIds: [] }, {}), false);
  assert.equal(sameContent({ ...base, infoCardIds: ["a", "b"] }, { ...base, infoCardIds: ["b", "a"] }), false);
  assert.equal(sameContent(base, { ...base, mediaItem: null }), false);
  for (const ids of [null, ["a", "a"], ["a", { $ne: null }]]) assert.throws(() => assertCardContent({ ...base, infoCardIds: ids }));
});

test("graph/create/save guard all references and preserve title, board and projection round trips", async () => {
  const { main, info } = await setup(); const c = content(["b", "a"]), d = deck(["main"]);
  await main.createPrivateGraph("alice", "graph", d, [{ cardTemplateId: "main", content: c }]);
  await main.createPrivateGraph("alice", "graph", d, [{ cardTemplateId: "main", content: c }]);
  assert.equal((await info.owner("alice", "a")).referenceRevision, 1);
  const dto = { root: { deckTemplateId: "graph" }, content: d, cards: [{ root: { cardTemplateId: "main" }, content: c, publishedContent: null }] };
  const board = creatorBoard(dto);
  assert.deepEqual(privateGraph(board, dto).cards[0].content.infoCardIds, ["b", "a"]);
  const template = creatorBoardToDeckTemplate(board);
  assert.deepEqual(creatorBoardToDeckTemplate(createCreatorBoardFromTemplate(template)).cards[0].infoCardIds, ["b", "a"]);
  await main.saveCardDraft("alice", "main", 0, { ...c, intro: { ...c.intro, title: "Changed" } });
  await assert.rejects(main.saveCardDraft("alice", "main", 0, c), { code: "STALE_REVISION" });
  await main.publishCard("alice", "main", 1);
  await main.publishDeck("alice", "graph", 0);
  assert.deepEqual((await workingDTO(main, "alice", "graph")).cards[0].infoCardIds, ["b", "a"]);
  const version = (await main.getCardVersion("main", 1))!;
  assert.deepEqual(cardContentPresentation(version, "Card 1", { username: "alice", immediateSourceUsername: null }).infoCardIds, ["b", "a"]);
  assert.equal(version.content.intro.description, "Keep this introduction");
  assert.equal((await info.owner("alice", "a")).revision, 2);
});

test("selection permissions and public publication restriction roll back without losing the draft", async () => {
  const { main, info } = await setup();
  for (const ids of [["private"], ["missing"]]) await assert.rejects(main.createCardDraft("bob", content(ids)), { code: "INFO_REFERENCE_FORBIDDEN" });
  await info.create("alice", "unpublished");
  await assert.rejects(main.createCardDraft("alice", content(["unpublished"])), { code: "INFO_REFERENCE_FORBIDDEN" });
  const c = content(["private"]); await main.createCardDraft("alice", c, "public", "main");
  const before = await main.cards().findOne({ cardTemplateId: "main" });
  await assert.rejects(main.publishCard("alice", "main", 0), { code: "PRIVATE_INFO_BLOCKS_PUBLICATION" });
  assert.deepEqual(await main.cards().findOne({ cardTemplateId: "main" }), before);
  assert.equal(await main.cardVersions().countDocuments(), 0);
  await main.saveCardDraft("alice", "main", 0, c, "private");
  await main.publishCard("alice", "main", 1);
  assert.equal((await main.getCardVersion("main", 1))!.visibility, "private");
});

test("legacy empty attachments do not create spurious drafts/publications or meaningful forks", async () => {
  const { main } = await setup(); const c = content();
  await main.createCardDraft("alice", c, "public", "main");
  await main.createCardDraft("alice", { ...c, infoCardIds: [] }, "public", "main");
  await main.publishCard("alice", "main", 0);
  await main.saveCardDraft("alice", "main", 1, { ...c, infoCardIds: [] });
  assert.equal((await main.cards().findOne({ cardTemplateId: "main" }))!.draft, null);
  assert.equal(Object.hasOwn((await main.getCardVersion("main", 1))!.content, "infoCardIds"), false);
  await assert.rejects(main.publishCard("alice", "main", 2), { code: "NO_UNPUBLISHED_CHANGES" });
  const source = { cardTemplateId: "main", version: 1 }, stepIds = [randomUUID(), randomUUID(), randomUUID()];
  await assert.rejects(main.createCardFork("bob", { source, stepIds, cardTemplateId: "fork", context: { kind: "library" },
    content: { ...forkCardContent(c, source, stepIds), infoCardIds: [] } }), { code: "NO_MEANINGFUL_FORK_EDIT" });
});

test("standalone and combined forks preserve attachments; reference-only Copy retains main identity", async () => {
  const { main } = await setup(); const c = content(["a", "b"]);
  await main.createCardDraft("alice", c, "public", "main"); await main.publishCard("alice", "main", 0);
  const d = deck(["main"]); const sourceDeck = await main.createDeckDraft("alice", d, "public"); await main.publishDeck("alice", sourceDeck.deckTemplateId, 0);
  for (const combined of [false, true]) {
    const source = { cardTemplateId: "main", version: 1 }, stepIds = [randomUUID(), randomUUID(), randomUUID()];
    const command = { source, stepIds, cardTemplateId: combined ? "combined-card" : "fork-card", context: { kind: "library" as const },
      content: { ...forkCardContent(c, source, stepIds), infoCardIds: ["b", "a"] } };
    if (combined) await main.createDeckFork("bob", { source: { deckTemplateId: sourceDeck.deckTemplateId, version: 1 }, deckTemplateId: "fork-deck",
      context: { kind: "library" }, content: d, cardFork: command });
    else { await main.createCardFork("bob", command); await main.createCardFork("bob", command); }
    assert.deepEqual((await main.cards().findOne({ cardTemplateId: command.cardTemplateId }))!.draft!.infoCardIds, ["b", "a"]);
  }
  const destination = deck([]); const target = await main.createDeckDraft("alice", destination, "private");
  await main.copyOwnedCard("alice", "main", { deckTemplateId: target.deckTemplateId, revision: 0, contentHash: deckContentHash(destination) });
  assert.equal((await main.decks().findOne({ deckTemplateId: target.deckTemplateId }))!.draft!.cards[0].cardTemplateId, "main");
  assert.deepEqual((await main.getCardVersion("main", 1))!.content.infoCardIds, ["a", "b"]);
});

test("historical references still block deletion after attachment removal and republication", async () => {
  const { main, info } = await setup(); const c = content(["a"]);
  await main.createCardDraft("alice", c, "private", "main"); await main.publishCard("alice", "main", 0);
  await main.saveCardDraft("alice", "main", 1, { ...c, infoCardIds: [] }); await main.publishCard("alice", "main", 2);
  await assert.rejects(info.delete("alice", "a", 2), (error: unknown) => {
    assert.deepEqual((error as { blockers: unknown }).blockers, { draft: false, historical: true }); return true;
  });
});

test("invalid newer main drafts do not change public Deck pins, and Info public intent alone cannot unblock publication", async () => {
  const { main, info } = await setup(), c = content(["a"]);
  await main.createCardDraft("alice", c, "public", "main"); await main.publishCard("alice", "main", 0);
  const d = await main.createDeckDraft("alice", deck(["main"]), "public"); await main.publishDeck("alice", d.deckTemplateId, 0);
  await main.saveCardDraft("alice", "main", 1, { ...c, infoCardIds: ["private"] });
  await main.saveDeckDraft("alice", d.deckTemplateId, 1, { ...d.draft!, title: "Updated public programme" });
  await main.publishDeck("alice", d.deckTemplateId, 2);
  assert.equal((await main.getDeckVersion(d.deckTemplateId, 2))!.content.cards[0].cardVersionAtPublish, 1);
  assert.deepEqual((await main.getCardVersion("main", 1))!.content.infoCardIds, ["a"]);
  await assert.rejects(main.publishCard("alice", "main", 2), { code: "PRIVATE_INFO_BLOCKS_PUBLICATION" });
  const publication = (await info.versions().findOne({ infoCardId: "private", version: 1 }))!;
  await info.save("alice", "private", 2, publication.content, "public");
  assert.equal((await info.owner("alice", "private")).visibility, "private");
  await assert.rejects(main.publishCard("alice", "main", 2), { code: "PRIVATE_INFO_BLOCKS_PUBLICATION" });
  assert.deepEqual((await main.cards().findOne({ cardTemplateId: "main" }))!.draft!.infoCardIds, ["private"]);
  await info.publish("alice", "private", 3); await main.publishCard("alice", "main", 2);
  assert.deepEqual((await main.getCardVersion("main", 2))!.content.infoCardIds, ["private"]);
  assert.equal((await main.getDeckVersion(d.deckTemplateId, 2))!.content.cards[0].cardVersionAtPublish, 1);
});

test("real canonical create wins a concurrent delete through the shared guard", async () => {
  const { main, info } = await setup(), hold = barrier(); const transaction = main.transaction.bind(main);
  main.transaction = run => transaction(async session => { const result = await run(session); hold.entered(); await hold.gate; return result; });
  const creation = main.createCardDraft("bob", content(["a"]), "private", "main"); await hold.reached;
  const deletion = info.delete("alice", "a", 2); hold.release(); await creation;
  await assert.rejects(deletion, { code: "INFO_REFERENCED_CONFLICT" });
});

test("deletion wins a concurrent canonical create, leaving no dangling draft", async () => {
  const { main, info } = await setup(), hold = barrier(); const transaction = info.transaction.bind(info);
  info.transaction = run => transaction(async session => { const result = await run(session); hold.entered(); await hold.gate; return result; });
  const deletion = info.delete("alice", "a", 2); await hold.reached;
  const creation = main.createCardDraft("bob", content(["a"]), "private", "main"); hold.release(); await deletion;
  await assert.rejects(creation, { code: "INFO_REFERENCE_FORBIDDEN" });
  assert.equal(await main.cards().countDocuments({ cardTemplateId: "main" }), 0);
});

test("transaction failure rolls back canonical content and reference guard together", async () => {
  const { main, info } = await setup(); const transaction = main.transaction.bind(main);
  main.transaction = run => transaction(async session => { await run(session); throw new Error("injected canonical rollback"); });
  await assert.rejects(main.createCardDraft("alice", content(["a"]), "private", "main"), /injected canonical rollback/);
  assert.equal(await main.cards().countDocuments(), 0);
  assert.equal((await info.owner("alice", "a")).referenceRevision, 0);
});

test("nonempty canonical writes require deployed reference indexes; empty old cards remain usable", async () => {
  const { main } = await setup(); await main.db.collection("cardTemplates").dropIndex("draft.infoCardIds_1");
  await assert.rejects(main.createCardDraft("alice", content(["a"])), { code: "INFO_INDEX_SETUP_REQUIRED" });
  await main.createCardDraft("alice", content());
});

test("construction step moves retain each main card's references, not the moved step's", async () => {
  const { main } = await setup(), a = content(["a"]), b = content(["b"]);
  await main.createPrivateGraph("alice", "construction", deck(["left", "right"]), [
    { cardTemplateId: "left", content: a }, { cardTemplateId: "right", content: b },
  ]);
  await main.moveConstructionStep("alice", "construction", "left", "right", 0, 1, { deck: 0, source: 0, destination: 0 });
  const left = (await main.cards().findOne({ cardTemplateId: "left" }))!.draft!;
  assert.equal(left.steps[0].stepId, b.steps[1].stepId); assert.deepEqual(left.infoCardIds, ["a"]);
  assert.deepEqual((await main.cards().findOne({ cardTemplateId: "right" }))!.draft!.infoCardIds, ["b"]);
});

test("ordered partial snapshots hide private/missing/corrupt publications without changing strict reads", async () => {
  const { info } = await setup();
  await info.versions().updateOne({ infoCardId: "b", version: 1 }, { $set: { "content.title": null } } as never);
  const entries = await publicationSnapshotEntries(info, "bob", ["private", "a", "missing", "b"]);
  assert.deepEqual(entries.map(entry => entry.status), ["unavailable", "available", "unavailable", "unavailable"]);
  for (const index of [0, 2, 3]) assert.deepEqual(entries[index], { status: "unavailable" });
  assert.equal(JSON.stringify(entries).includes("Private tip"), false);
  await assert.rejects(publishedSnapshot(info, "bob", ["a", "b"]), { code: "INFO_PUBLICATION_FORBIDDEN" });
  assert.deepEqual(await publicationSnapshotEntries(info, "bob", []), []);
  assert.deepEqual(await publicationSnapshotEntries(info, "bob", ["missing"]), [{ status: "unavailable" }]);
  await info.versions().deleteOne({ infoCardId: "b", version: 1 });
  assert.deepEqual(await publicationSnapshotEntries(info, "bob", ["b"]), [{ status: "unavailable" }]);
});

test("consultation uses adopted main versus displayed canonical version, independently of deck publication pins", async () => {
  const { main, info } = await setup(), c = content(["a"]);
  await main.createCardDraft("alice", c, "public", "main"); await main.publishCard("alice", "main", 0);
  const d = await main.createDeckDraft("alice", deck(["main"]), "public"); await main.publishDeck("alice", d.deckTemplateId, 0);
  await main.ensureDeckData("bob", d.deckTemplateId, 1); await main.ensureCardData("bob", "main", 1);
  const before = await main.getPersonalUser("bob");
  await main.saveCardDraft("alice", "main", 1, { ...c, infoCardIds: ["b"] }); await main.publishCard("alice", "main", 2);
  const working = await mainInfoConsultation(info, "bob", "main", { mode: "working", version: 1, deckTemplateId: d.deckTemplateId });
  assert.equal(working.mainCardVersion, 1); assert.equal(working.entries[0].status === "available" && working.entries[0].info.infoCardId, "a");
  const canonical = await mainInfoConsultation(info, "bob", "main", { mode: "canonical", version: 2 });
  assert.equal(canonical.entries[0].status === "available" && canonical.entries[0].info.infoCardId, "b");
  assert.equal((await main.getDeckVersion(d.deckTemplateId, 1))!.content.cards[0].cardVersionAtPublish, 1);
  assert.deepEqual(await mainInfoConsultation(info, "bob", "main", { mode: "canonical", version: 1 }), working);
  await assert.rejects(mainInfoConsultation(info, "bob", "main", { mode: "working", version: 2, deckTemplateId: d.deckTemplateId }), { code: "INFO_MAIN_VERSION_CONFLICT" });
  const outside = await main.createDeckDraft("alice", deck([]), "public"); await main.publishDeck("alice", outside.deckTemplateId, 0);
  await main.ensureDeckData("bob", outside.deckTemplateId, 1);
  await assert.rejects(mainInfoConsultation(info, "bob", "main", { mode: "working", version: 1, deckTemplateId: outside.deckTemplateId }), { code: "CARD_OUTSIDE_WORKING_CONTEXT" });
  const after = await main.getPersonalUser("bob"); assert.deepEqual(after!.cardsData, before!.cardsData);
  const review = await main.reviewUpdate("bob", "card", "main");
  assert.ok(review.review);
  await main.adoptUpdate("bob", review.review.command);
  const adopted = await mainInfoConsultation(info, "bob", "main", { mode: "working", version: 2, deckTemplateId: d.deckTemplateId });
  assert.equal(adopted.entries[0].status === "available" && adopted.entries[0].info.infoCardId, "b");
  const personal = (await main.getPersonalUser("bob"))!.cardsData[0];
  assert.deepEqual(personal.items, before!.cardsData[0].items);
  assert.deepEqual(personal.signalReadings, before!.cardsData[0].signalReadings);
  const infoRoot = await info.owner("alice", "b");
  await info.save("alice", "b", infoRoot.revision, { title: "Updated tip", body: "Updated published explanation.", seriesId: "series", mediaItem: null }, "public");
  await info.publish("alice", "b", infoRoot.revision + 1);
  const refreshed = await mainInfoConsultation(info, "bob", "main", { mode: "working", version: 2, deckTemplateId: d.deckTemplateId });
  assert.equal(refreshed.entries[0].status === "available" && refreshed.entries[0].info.version, 2);
  assert.equal(adopted.entries[0].status === "available" && adopted.entries[0].info.version, 1);
  assert.equal((await main.cards().findOne({ cardTemplateId: "main" }))!.latestVersion, 2);
  assert.deepEqual((await main.getPersonalUser("bob"))!.cardsData[0], personal);
});

test("main-context and info resolution share one snapshot during concurrent republication", async t => {
  const { main, info } = await setup(), c = content(["a", "b"]);
  await main.createCardDraft("alice", c, "public", "main"); await main.publishCard("alice", "main", 0);
  const hold = barrier(), original = CardRepository.prototype.consultationCardVersion;
  t.mock.method(CardRepository.prototype, "consultationCardVersion", async function (this: CardRepository, ...args: Parameters<typeof original>) {
    const result = await original.apply(this, args); hold.entered(); await hold.gate; return result;
  });
  const pending = mainInfoConsultation(info, "bob", "main", { mode: "canonical", version: 1 }); await hold.reached;
  await info.save("alice", "a", 2, { title: "New signs", body: "New information.", seriesId: "series", mediaItem: null }, "public");
  await info.publish("alice", "a", 3);
  await main.saveCardDraft("alice", "main", 1, { ...c, infoCardIds: ["b", "a"] }); await main.publishCard("alice", "main", 2);
  hold.release(); const first = await pending;
  assert.deepEqual(first.entries.map(entry => entry.status === "available" && [entry.info.infoCardId, entry.info.version]), [["a", 1], ["b", 1]]);
  const next = await mainInfoConsultation(info, "bob", "main", { mode: "canonical", version: 2 });
  assert.deepEqual(next.entries.map(entry => entry.status === "available" && [entry.info.infoCardId, entry.info.version]), [["b", 1], ["a", 2]]);
  assert.equal(first.entries[0].status === "available" && first.entries[0].info.content.title, "Signs");
});

test("private main context is owner-only and legacy versions without attachments resolve empty", async () => {
  const { main, info } = await setup(); await main.createCardDraft("alice", content(), "private", "main"); await main.publishCard("alice", "main", 0);
  const d = await main.createDeckDraft("alice", deck(["main"])); await main.publishDeck("alice", d.deckTemplateId, 0);
  assert.deepEqual((await mainInfoConsultation(info, "alice", "main", { mode: "working", version: 1, deckTemplateId: d.deckTemplateId })).entries, []);
  await assert.rejects(mainInfoConsultation(info, "alice", "main", { mode: "canonical", version: 1 }), { code: "CARD_VERSION_FORBIDDEN" });
  await assert.rejects(mainInfoConsultation(info, "bob", "main", { mode: "working", version: 1, deckTemplateId: d.deckTemplateId }), { code: "WORKING_DECK_REQUIRED" });
});

test("infrastructure failures propagate instead of masquerading as unavailable attachments", async t => {
  const { info } = await setup(); t.mock.method(info, "roots", () => { throw new Error("database unavailable"); });
  await assert.rejects(publicationSnapshotEntries(info, "bob", ["a"]), /database unavailable/);
});
