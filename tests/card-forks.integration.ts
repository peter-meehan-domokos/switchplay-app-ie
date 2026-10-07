import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../src/lib/cards/forks";
import { personalCardHistoryDTO, workingDTO } from "../src/lib/cards/readModels";
import type { CardForkCommand, ForkContext } from "../src/lib/cards/model";

let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
async function setup(personal = false) {
  const repo = new CardRepository(client.db(`switchplay_test_forks_${sequence++}`), client); await createFoundationIndexes(repo.db);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, decksData: [], cardsData: [], sharedDeckData: [{ untouched: true }] })));
  const media = { id: "canonical-video", mediaType: "video" as const, provider: "cloudflare-stream" as const,
    assetId: "trusted-source", src: "https://iframe.videodelivery.net/trusted-source", description: "Source video" };
  const content = { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Bob practice", description: null, mediaItem: media } };
  const card = await repo.createCardDraft("bob", content, "public"); await repo.publishCard("bob", card.cardTemplateId, 0);
  const other = await repo.createCardDraft("bob", { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Unchanged", description: null, mediaItem: null } }, "public");
  await repo.publishCard("bob", other.cardTemplateId, 0);
  const deck = await repo.createDeckDraft("bob", { ...createDefaultDeckContent([]), title: "Bob programme", cards: [card, other].map((root) => ({ cardTemplateId: root.cardTemplateId })) }, "public");
  await repo.publishDeck("bob", deck.deckTemplateId, 0);
  if (personal) {
    await repo.ensureDeckData("alice", deck.deckTemplateId, 1); await repo.openWorkingDeck("alice", deck.deckTemplateId, "2026-10-07");
    await repo.setCompletion("alice", deck.deckTemplateId, card.cardTemplateId, content.steps[0].stepId, "skipped");
    await repo.setSignalReading("alice", deck.deckTemplateId, card.cardTemplateId, content.steps[0].stepId, 1);
    await repo.setTargetDate("alice", deck.deckTemplateId, card.cardTemplateId, "2030-01-01");
    await repo.setReflection("alice", deck.deckTemplateId, card.cardTemplateId, "My current reflection");
    await repo.users().updateOne({ _id: "alice" }, { $set: {
      "cardsData.0.tests": [{ id: "result", date: "2026-10-07", result: true, createdAt: new Date() }],
      "cardsData.0.chats": [{ id: "chat", deckTemplateId: deck.deckTemplateId, comments: [{ id: "comment", creatorId: "alice", createdAt: "2026-10-07", text: "Original context", isRetained: true }] }],
      "cardsData.0.mediaItems": [{ id: "personal-image", mediaType: "image", provider: "cloudflare-r2", assetId: "original-key", src: "https://example.invalid/original", description: "Personal evidence" }],
    } });
  }
  return { repo, card, other, deck, content };
}
async function command(repo: CardRepository, sourceId: string, context: ForkContext = { kind: "library" }, version = 1): Promise<CardForkCommand> {
  const source = (await repo.getCardVersion(sourceId, version))!, sourceRef = { cardTemplateId: sourceId, version }, stepIds = [randomUUID(), randomUUID(), randomUUID()];
  const baseline = forkCardContent(source.content, sourceRef, stepIds);
  return { source: sourceRef, cardTemplateId: randomUUID(), stepIds, context, content: { ...baseline, intro: { ...baseline.intro, title: "Alice edited practice" } } };
}

test("exact viewed Card/Deck versions fork into edited drafts with new lineage and no personal records; retries are exact", async () => {
  const { repo, card, deck, content } = await setup();
  const cmd = await command(repo, card.cardTemplateId);
  await repo.saveCardDraft("bob", card.cardTemplateId, 1, { ...content, intro: { ...content.intro, title: "Bob v2" } }); await repo.publishCard("bob", card.cardTemplateId, 2);
  await repo.saveDeckDraft("bob", deck.deckTemplateId, 1, { ...deck.draft!, title: "Bob Deck v2" }); await repo.publishDeck("bob", deck.deckTemplateId, 2);
  assert.deepEqual(await repo.createCardFork("alice", cmd), await repo.createCardFork("alice", cmd));
  const root = (await repo.cards().findOne({ cardTemplateId: cmd.cardTemplateId }))!;
  assert.equal(root.latestVersion, 0); assert.deepEqual(root.forkedFrom, cmd.source); assert.deepEqual(root.draft!.intro.mediaItem, content.intro.mediaItem);
  assert.deepEqual(root.stepIds, cmd.stepIds);
  assert.deepEqual(root.draft!.steps.map((step) => step.forkedFrom), content.steps.map((step) => ({ ...cmd.source, stepId: step.stepId })));
  const deckCmd = { source: { deckTemplateId: deck.deckTemplateId, version: 1 }, deckTemplateId: randomUUID(), context: { kind: "library" as const }, content: { ...deck.draft!, title: "Alice edited Deck" } };
  assert.deepEqual(await repo.createDeckFork("alice", deckCmd), await repo.createDeckFork("alice", deckCmd));
  const fork = (await repo.decks().findOne({ deckTemplateId: deckCmd.deckTemplateId }))!;
  assert.equal(fork.latestVersion, 0); assert.deepEqual(fork.draft!.cards, deck.draft!.cards); assert.deepEqual(fork.forkedFrom, deckCmd.source);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []); assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []);
  await repo.saveCardDraft("alice", cmd.cardTemplateId, 0, { ...root.draft!, intro: { ...root.draft!.intro, title: "Further edit" } });
  await assert.rejects(repo.createCardFork("alice", cmd), { code: "CARD_FORK_RECOVERY_CONFLICT" });
});

test("combined fork is atomic, replaces only edited reference, and prevents fork-derived Step movement", async () => {
  const { repo, card, other, deck } = await setup(), cardCmd = await command(repo, card.cardTemplateId);
  const cmd = { source: { deckTemplateId: deck.deckTemplateId, version: 1 }, deckTemplateId: randomUUID(), context: cardCmd.context, content: deck.draft!, cardFork: cardCmd };
  await repo.db.command({ collMod: "deckTemplates", validator: { deckTemplateId: { $ne: cmd.deckTemplateId } }, validationLevel: "strict" });
  await assert.rejects(repo.createDeckFork("alice", cmd)); assert.equal(await repo.cards().findOne({ cardTemplateId: cardCmd.cardTemplateId }), null);
  await repo.db.command({ collMod: "deckTemplates", validator: {} });
  assert.deepEqual(await repo.createDeckFork("alice", cmd), await repo.createDeckFork("alice", cmd));
  const root = (await repo.decks().findOne({ deckTemplateId: cmd.deckTemplateId }))!;
  assert.deepEqual(root.draft!.cards, [{ cardTemplateId: cardCmd.cardTemplateId }, { cardTemplateId: other.cardTemplateId }]);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.decksData, []);
  const fresh = await repo.createCardDraft("alice", createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]));
  const construction = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), cards: [cardCmd.cardTemplateId, fresh.cardTemplateId].map((cardTemplateId) => ({ cardTemplateId })) });
  await assert.rejects(repo.moveConstructionStep("alice", construction.deckTemplateId, cardCmd.cardTemplateId, fresh.cardTemplateId, 0, 0, { deck: 0, source: 0, destination: 0 }));
  await assert.rejects(repo.publishDeck("alice", cmd.deckTemplateId, 0, undefined, undefined, { enterMyDecks: false }), { code: "UNPUBLISHED_CARDS_BLOCK_DECK" });
});

test("Card fork attachment is exact/revision guarded and never deletes source or creates personal records", async () => {
  const { repo, card, other } = await setup();
  const own = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Own", cards: [card, other].map((root) => ({ cardTemplateId: root.cardTemplateId })) });
  const cmd = await command(repo, card.cardTemplateId);
  cmd.attachTo = { deckTemplateId: own.deckTemplateId, revision: 0, nextDeckContent: { ...own.draft!, cards: [{ cardTemplateId: cmd.cardTemplateId }, { cardTemplateId: other.cardTemplateId }] } };
  const stale = { ...cmd, attachTo: { ...cmd.attachTo, revision: 9 } };
  await assert.rejects(repo.createCardFork("alice", stale), { code: "STALE_REVISION" });
  assert.equal(await repo.cards().findOne({ cardTemplateId: cmd.cardTemplateId }), null);
  const a = await repo.createCardFork("alice", cmd); assert.deepEqual(await repo.createCardFork("alice", cmd), a);
  assert.deepEqual((await repo.decks().findOne({ deckTemplateId: own.deckTemplateId }))!.draft!.cards, cmd.attachTo.nextDeckContent.cards);
  assert.ok(await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }));
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
});

test("first My Decks Card publication inherits current state and exposes history once without changing source", async () => {
  const { repo, card, deck } = await setup(true), cmd = await command(repo, card.cardTemplateId, { kind: "my-decks", deckTemplateId: deck.deckTemplateId });
  const beforeFork = await repo.getPersonalUser("alice"); await repo.createCardFork("alice", cmd);
  assert.deepEqual(await repo.getPersonalUser("alice"), beforeFork);
  await repo.setReflection("alice", deck.deckTemplateId, card.cardTemplateId, "Reflection at publication");
  const source = (await repo.getPersonalUser("alice"))!.cardsData[0];
  assert.equal(await repo.publishCard("alice", cmd.cardTemplateId, 0), 1);
  const user = (await repo.getPersonalUser("alice"))!, target = user.cardsData.find((data) => data.cardTemplateId === cmd.cardTemplateId)!;
  assert.deepEqual(user.cardsData[0], source); assert.equal(target.cardTemplateVersion, 1);
  assert.equal(target.items[0].completionStatus, "skipped"); assert.equal(target.signalReadings[0].reading, 1);
  assert.equal(target.targetDate, source.targetDate); assert.equal(target.reflection, "Reflection at publication");
  assert.deepEqual([target.tests, target.chats, target.mediaItems], [[], [], []]);
  const history = await personalCardHistoryDTO(repo, "alice", cmd.cardTemplateId);
  assert.deepEqual(history.segments.map((segment) => segment.cardTemplateId), [cmd.cardTemplateId, card.cardTemplateId]);
  assert.equal(history.segments[1].chats[0].deckTemplateId, deck.deckTemplateId); assert.deepEqual(history.segments[1].mediaItems, source.mediaItems);
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.2.reflection": "New target state", "cardsData.0.tests": [], "cardsData.0.mediaItems": [], "cardsData.0.chats.0.comments": [] } });
  const changed = await repo.getPersonalUser("alice");
  assert.equal(await repo.publishCard("alice", cmd.cardTemplateId, 0), 1); assert.deepEqual(await repo.getPersonalUser("alice"), changed);
  assert.equal(await repo.cardVersions().countDocuments({ cardTemplateId: cmd.cardTemplateId }), 1);
  const laterHistory = await personalCardHistoryDTO(repo, "alice", cmd.cardTemplateId);
  assert.deepEqual(laterHistory.segments[1].tests, []); assert.deepEqual(laterHistory.segments[1].mediaItems, []); assert.deepEqual(laterHistory.segments[1].chats[0].comments, []);
  await assert.rejects(repo.publishCard("alice", cmd.cardTemplateId, 0, "Different retry"), { code: "FORK_PUBLICATION_RECOVERY_CONFLICT" });
});

test("Library-origin fork inherits Step state/date from global source data without reflection/history or Deck membership", async () => {
  const { repo, card, deck } = await setup(true);
  await repo.archiveDeckData("alice", deck.deckTemplateId);
  const cmd = await command(repo, card.cardTemplateId); await repo.createCardFork("alice", cmd); await repo.publishCard("alice", cmd.cardTemplateId, 0);
  const user = (await repo.getPersonalUser("alice"))!, target = user.cardsData[2];
  assert.equal(target.items[0].completionStatus, "skipped"); assert.equal(target.signalReadings[0].reading, 1); assert.equal(target.targetDate, "2030-01-01");
  assert.equal(target.reflection, ""); assert.equal(target.historySourceCardTemplateId, undefined);
  assert.equal((await personalCardHistoryDTO(repo, "alice", cmd.cardTemplateId)).segments.length, 1);
  assert.equal(user.decksData.length, 1); assert.ok(user.decksData[0].archivedAt);
});

test("fork publication without source personal state is canonical only; uncertain retry never creates v2", async () => {
  const { repo, card } = await setup(), cmd = await command(repo, card.cardTemplateId);
  await repo.createCardFork("alice", cmd); await repo.publishCard("alice", cmd.cardTemplateId, 0);
  assert.equal(await repo.publishCard("alice", cmd.cardTemplateId, 0), 1);
  assert.deepEqual((await repo.getPersonalUser("alice"))!.cardsData, []);
  const root = (await repo.cards().findOne({ cardTemplateId: cmd.cardTemplateId }))!;
  await repo.saveCardDraft("alice", cmd.cardTemplateId, 1, { ...(root.draft ?? (await repo.getCardVersion(cmd.cardTemplateId, 1))!.content), intro: { ...cmd.content.intro, title: "Later publication" } });
  assert.equal(await repo.publishCard("alice", cmd.cardTemplateId, 2), 2); assert.equal(await repo.publishCard("alice", cmd.cardTemplateId, 0), 1);
  assert.equal(await repo.cardVersions().countDocuments({ cardTemplateId: cmd.cardTemplateId }), 2);
});

test("self-use combined Deck fork creates separate membership, carries cadence/active identity and preserves source", async () => {
  const { repo, card, deck, other } = await setup(true), context = { kind: "my-decks" as const, deckTemplateId: deck.deckTemplateId };
  const cardCmd = await command(repo, card.cardTemplateId, context);
  const cmd = { source: { deckTemplateId: deck.deckTemplateId, version: 1 }, deckTemplateId: randomUUID(), context, content: deck.draft!, cardFork: cardCmd };
  await repo.createDeckFork("alice", cmd); await repo.publishCard("alice", cardCmd.cardTemplateId, 0);
  const before = (await repo.getPersonalUser("alice"))!, source = before.decksData[0];
  await assert.rejects(repo.publishDeck("alice", cmd.deckTemplateId, 0), { code: "FORK_ENTRY_REQUIRED" });
  assert.equal(await repo.publishDeck("alice", cmd.deckTemplateId, 0, undefined, undefined, { enterMyDecks: true }), 1);
  const user = (await repo.getPersonalUser("alice"))!, target = user.decksData.find((data) => data.deckTemplateId === cmd.deckTemplateId)!;
  assert.deepEqual(user.decksData[0], source); assert.equal(target.cadenceAnchorDate, source.cadenceAnchorDate);
  assert.equal(target.activeCardId, cardCmd.cardTemplateId); assert.equal(target.openedAt, null); assert.equal(target.archivedAt, null); assert.deepEqual(target.sharedWithUserIds, []);
  assert.deepEqual(user.cardsData, before.cardsData);
  const working = await workingDTO(repo, "alice", cmd.deckTemplateId);
  assert.deepEqual(working.cards.map((card) => card.cardTemplateId), [cardCmd.cardTemplateId, other.cardTemplateId]);
  assert.equal(working.cards[0].steps[0].completionStatus, "skipped");
  assert.equal(await repo.publishDeck("alice", cmd.deckTemplateId, 0, undefined, undefined, { enterMyDecks: true }), 1);
  assert.deepEqual(await repo.getPersonalUser("alice"), user);
  await assert.rejects(repo.publishDeck("alice", cmd.deckTemplateId, 0, undefined, undefined, { enterMyDecks: false }), { code: "FORK_PUBLICATION_RECOVERY_CONFLICT" });
});

test("Library-only Deck publication retains original identities and creates no membership; later entry reuses existing data", async () => {
  const { repo, card, deck } = await setup(true), cmd = { source: { deckTemplateId: deck.deckTemplateId, version: 1 }, deckTemplateId: randomUUID(),
    context: { kind: "library" as const }, content: { ...deck.draft!, title: "Library fork" } };
  const before = await repo.getPersonalUser("alice");
  await repo.createDeckFork("alice", cmd); await repo.publishDeck("alice", cmd.deckTemplateId, 0, undefined, undefined, { enterMyDecks: false });
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.ensureDeckData("alice", cmd.deckTemplateId, 1);
  const user = (await repo.getPersonalUser("alice"))!; assert.equal(user.decksData.length, 2); assert.deepEqual(user.cardsData, before!.cardsData);
  assert.equal(user.cardsData.filter((data) => data.cardTemplateId === card.cardTemplateId).length, 1);
});

test("publication inheritance is one coherent current source snapshot under concurrent learning updates", async () => {
  const { repo, card, deck } = await setup(true), cmd = await command(repo, card.cardTemplateId, { kind: "my-decks", deckTemplateId: deck.deckTemplateId });
  await repo.createCardFork("alice", cmd);
  let reached!: () => void, resume!: () => void, paused = false;
  const read = new Promise<void>((resolve) => { reached = resolve; }), release = new Promise<void>((resolve) => { resume = resolve; });
  const getVersion = repo.getCardVersion.bind(repo);
  repo.getCardVersion = async (...args) => { const result = await getVersion(...args);
    if (!paused && args[0] === card.cardTemplateId && args[2]) { paused = true; reached(); await release; } return result; };
  const publishing = repo.publishCard("alice", cmd.cardTemplateId, 0); await read;
  try { await repo.transaction(async (session) => { await repo.users().updateOne({ _id: "alice" }, { $set: {
    "cardsData.0.items.0.completionStatus": "done", "cardsData.0.signalReadings.0.reading": 9, "cardsData.0.reflection": "Concurrent committed reflection",
  } }, { session }); }); } finally { resume(); }
  await publishing;
  const target = (await repo.getPersonalUser("alice"))!.cardsData.find((data) => data.cardTemplateId === cmd.cardTemplateId)!;
  assert.equal(target.items[0].completionStatus, "done"); assert.equal(target.signalReadings[0].reading, 9); assert.equal(target.reflection, "Concurrent committed reflection");
  assert.equal(await repo.cardVersions().countDocuments({ cardTemplateId: cmd.cardTemplateId }), 1);
});

test("global Step reservation/permissions and immutable lineage reject invalid fork writes", async () => {
  const { repo, card, deck } = await setup(), cmd = await command(repo, card.cardTemplateId);
  const used = await repo.createCardDraft("alice", createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]));
  const collision = { ...cmd, stepIds: used.stepIds, content: { ...cmd.content, steps: cmd.content.steps.map((step, i) => ({ ...step, stepId: used.stepIds[i] })) } };
  await assert.rejects(repo.createCardFork("alice", collision), { code: "STEP_RESERVATION_CONFLICT" }); assert.equal(await repo.cards().findOne({ cardTemplateId: cmd.cardTemplateId }), null);
  const privateCard = await repo.createCardDraft("bob", createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]));
  await assert.rejects(repo.createCardFork("alice", { ...cmd, source: { cardTemplateId: privateCard.cardTemplateId, version: 1 } }), { code: "CARD_FORBIDDEN" });
  await assert.rejects(repo.createCardFork("alice", { ...cmd, context: { kind: "my-decks", deckTemplateId: deck.deckTemplateId } }), { code: "FORK_OUTSIDE_PERSONAL_CONTEXT" });
  await repo.createCardFork("alice", cmd);
  const root = (await repo.cards().findOne({ cardTemplateId: cmd.cardTemplateId }))!;
  await assert.rejects(repo.saveCardDraft("alice", cmd.cardTemplateId, 0, { ...root.draft!, steps: root.draft!.steps.map((step) => ({ ...step, forkedFrom: undefined })) }), { code: "STEP_LINEAGE_IMMUTABLE" });
  await assert.rejects(repo.publishCard("bob", cmd.cardTemplateId, 0), { code: "CARD_FORBIDDEN" });
});

test("older adopted Step identities transfer defensively into a newer viewed canonical source", async () => {
  const { repo, card, content } = await setup(true);
  const changed = { ...content, steps: content.steps.map((step, index) => index === 2 ? { ...step, stepId: randomUUID() } : step) };
  // Defensive fixture discrepancy, not a new Step-add/remove product flow.
  await repo.saveCardDraft("bob", card.cardTemplateId, 1, changed); await repo.publishCard("bob", card.cardTemplateId, 2);
  const cmd = await command(repo, card.cardTemplateId, { kind: "library" }, 2);
  await repo.createCardFork("alice", cmd); await repo.publishCard("alice", cmd.cardTemplateId, 0);
  const target = (await repo.getPersonalUser("alice"))!.cardsData[2];
  assert.equal(target.items[0].completionStatus, "skipped"); assert.equal(target.signalReadings[0].reading, 1);
  assert.equal(target.items[2].completionStatus, "todo"); assert.equal(target.signalReadings[2].reading, null);
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].cardTemplateVersion, 1);
  assert.equal((await repo.cards().findOne({ cardTemplateId: cmd.cardTemplateId }))!.forkedFrom!.version, 2);
});

test("continuity chains use immediate lineage and never duplicate events or repeat inheritance on later owner publication", async () => {
  const { repo, card, deck } = await setup(true), context = { kind: "my-decks" as const, deckTemplateId: deck.deckTemplateId };
  const first = await command(repo, card.cardTemplateId, context), deckId = randomUUID();
  await repo.createDeckFork("alice", { source: { deckTemplateId: deck.deckTemplateId, version: 1 }, deckTemplateId: deckId, context, content: deck.draft!, cardFork: first });
  await repo.publishCard("alice", first.cardTemplateId, 0); await repo.publishDeck("alice", deckId, 0, undefined, undefined, { enterMyDecks: true });
  const second = await command(repo, first.cardTemplateId, { kind: "my-decks", deckTemplateId: deckId });
  second.content.intro.description = "A further meaningful continuation edit";
  await repo.createCardFork("alice", second); await repo.publishCard("alice", second.cardTemplateId, 0);
  const segments = (await personalCardHistoryDTO(repo, "alice", second.cardTemplateId)).segments;
  assert.deepEqual(segments.map((segment) => segment.cardTemplateId), [second.cardTemplateId, first.cardTemplateId, card.cardTemplateId]);
  assert.equal(segments.flatMap((segment) => segment.tests).length, 1);
  const secondVersion = (await repo.getCardVersion(second.cardTemplateId, 1))!;
  assert.deepEqual(secondVersion.content.steps.map((step) => step.forkedFrom!.cardTemplateId), [first.cardTemplateId, first.cardTemplateId, first.cardTemplateId]);
  const before = (await repo.getPersonalUser("alice"))!.cardsData.find((data) => data.cardTemplateId === second.cardTemplateId)!;
  await repo.setReflection("alice", deck.deckTemplateId, card.cardTemplateId, "Changed ancestor reflection");
  await repo.saveCardDraft("alice", second.cardTemplateId, 1, { ...secondVersion.content, steps: [...secondVersion.content.steps].reverse() });
  await repo.publishCard("alice", second.cardTemplateId, 2);
  const after = (await repo.getPersonalUser("alice"))!.cardsData.find((data) => data.cardTemplateId === second.cardTemplateId)!;
  assert.deepEqual({ ...after, cardTemplateVersion: before.cardTemplateVersion, updatedAt: before.updatedAt }, before);
});

test("personal carryover failure rolls back fork v1/root, and Deck entry failure leaves prior Card publication intact", async () => {
  const { repo, card, deck } = await setup(true), context = { kind: "my-decks" as const, deckTemplateId: deck.deckTemplateId };
  const cardCmd = await command(repo, card.cardTemplateId, context), deckId = randomUUID();
  await repo.createDeckFork("alice", { source: { deckTemplateId: deck.deckTemplateId, version: 1 }, deckTemplateId: deckId, context, content: deck.draft!, cardFork: cardCmd });
  const before = await repo.getPersonalUser("alice");
  await repo.db.command({ collMod: "users", validator: { "cardsData.cardTemplateId": { $ne: cardCmd.cardTemplateId } }, validationLevel: "strict" });
  await assert.rejects(repo.publishCard("alice", cardCmd.cardTemplateId, 0));
  assert.equal(await repo.getCardVersion(cardCmd.cardTemplateId, 1), null);
  assert.equal((await repo.cards().findOne({ cardTemplateId: cardCmd.cardTemplateId }))!.latestVersion, 0);
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.db.command({ collMod: "users", validator: {} }); await repo.publishCard("alice", cardCmd.cardTemplateId, 0);
  const afterCard = await repo.getPersonalUser("alice");
  await repo.db.command({ collMod: "users", validator: { "decksData.1": { $exists: false } }, validationLevel: "strict" });
  await assert.rejects(repo.publishDeck("alice", deckId, 0, undefined, undefined, { enterMyDecks: true }));
  assert.equal(await repo.getDeckVersion(deckId, 1), null); assert.ok(await repo.getCardVersion(cardCmd.cardTemplateId, 1));
  assert.deepEqual(await repo.getPersonalUser("alice"), afterCard);
  await repo.db.command({ collMod: "users", validator: {} }); await repo.publishDeck("alice", deckId, 0, undefined, undefined, { enterMyDecks: true });
});
