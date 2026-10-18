import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { copyDestinations, deckContentHash } from "../src/lib/cards/cardReuse";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { creatorDTO } from "../src/lib/cards/readModels";

let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
async function setup() {
  const db = client.db(`switchplay_test_reuse_${sequence++}`); await createFoundationIndexes(db);
  const repo = new CardRepository(db, client);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, decksData: [], cardsData: [], sharedDeckData: [{ raw: true }] })));
  const card = await repo.createCardDraft("alice", { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Practice", description: null, mediaItem: null } });
  const second = await repo.createCardDraft("alice", createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]));
  const source = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Source", cards: [card, second].map((root) => ({ cardTemplateId: root.cardTemplateId })) });
  const target = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Destination" });
  return { repo, card, second, source, target };
}
async function command(repo: CardRepository, cardId: string, source: string, target: string) {
  const row = (await copyDestinations(repo, "alice", cardId, source)).find((row) => row.deckTemplateId === target)!;
  return { deckTemplateId: target, revision: row.revision, contentHash: row.contentHash };
}

test("Copy appends the same identity, preserves canonical/personal state, and recognizes exact lost-response retries", async () => {
  const { repo, card, source, target } = await setup(), user = await repo.getPersonalUser("alice");
  const cmd = await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId);
  const a = await repo.copyOwnedCard("alice", card.cardTemplateId, cmd), b = await repo.copyOwnedCard("alice", card.cardTemplateId, cmd);
  assert.deepEqual(a, b); assert.equal(await repo.cards().countDocuments(), 2); assert.equal(await repo.cardVersions().countDocuments(), 0);
  assert.deepEqual((await creatorDTO(repo, "alice", target.deckTemplateId)).content.cards, [{ cardTemplateId: card.cardTemplateId }]);
  const stored = (await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!;
  assert.deepEqual(stored.draft, card.draft); assert.equal(stored.revision, card.revision); assert.deepEqual(stored.stepIds, card.stepIds);
  assert.ok(stored.firstReusedAt instanceof Date); assert.deepEqual(await repo.getPersonalUser("alice"), user);
  const duplicate = await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId);
  await assert.rejects(repo.copyOwnedCard("alice", card.cardTemplateId, duplicate), { code: "COPY_CARD_RECOVERY_CONFLICT" });
});

test("owned destination list includes unpublished, published and archived; excludes current/foreign and disables duplicates", async () => {
  const { repo, card, source, target } = await setup();
  const published = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Published" });
  await repo.publishDeck("alice", published.deckTemplateId, 0); await repo.archiveDeckData("alice", published.deckTemplateId);
  const foreign = await repo.createDeckDraft("bob", { ...createDefaultDeckContent([]), title: "Foreign" });
  for (const id of [target.deckTemplateId, published.deckTemplateId]) await repo.copyOwnedCard("alice", card.cardTemplateId, await command(repo, card.cardTemplateId, source.deckTemplateId, id));
  const rows = await copyDestinations(repo, "alice", card.cardTemplateId, source.deckTemplateId);
  assert.deepEqual(new Set(rows.map((row) => row.deckTemplateId)), new Set([target.deckTemplateId, published.deckTemplateId]));
  assert.ok(rows.every((row) => row.alreadyContains)); assert.ok(!rows.some((row) => row.deckTemplateId === foreign.deckTemplateId));
  const user = (await repo.getPersonalUser("alice"))!; assert.ok(user.decksData[0].archivedAt); assert.equal(user.cardsData.length, 0);
  assert.equal((await repo.decks().findOne({ deckTemplateId: published.deckTemplateId }))!.latestVersion, 1);
  assert.deepEqual((await repo.getDeckVersion(published.deckTemplateId, 1))!.content.cards, []);
});

test("removal never deletes Card state/history or restores cross-Card movement; within-Card reorder remains valid", async () => {
  const { repo, card, second, source, target } = await setup();
  await repo.copyOwnedCard("alice", card.cardTemplateId, await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId));
  await repo.saveDeckDraft("alice", target.deckTemplateId, 1, target.draft!);
  await assert.rejects(repo.moveConstructionStep("alice", source.deckTemplateId, card.cardTemplateId, second.cardTemplateId, 0, 0, { deck: 0, source: 0, destination: 0 }), { code: "CROSS_CARD_MOVE_AFTER_REUSE" });
  const reordered = { ...card.draft!, steps: [...card.draft!.steps].reverse() };
  await repo.saveCardDraft("alice", card.cardTemplateId, 0, reordered); await repo.publishCard("alice", card.cardTemplateId, 1);
  await repo.ensureCardData("alice", card.cardTemplateId, 1);
  const before = await repo.getPersonalUser("alice"), version = await repo.getCardVersion(card.cardTemplateId, 1);
  await repo.saveDeckDraft("alice", source.deckTemplateId, 0, { ...source.draft!, cards: [{ cardTemplateId: second.cardTemplateId }] });
  assert.deepEqual(await repo.getPersonalUser("alice"), before); assert.deepEqual(await repo.getCardVersion(card.cardTemplateId, 1), version);
  assert.ok((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.firstReusedAt);
});

test("revision conflict and transaction failure leave no half-copy or permanent marker", async () => {
  const { repo, card, source, target } = await setup();
  const cmd = await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId);
  await assert.rejects(repo.copyOwnedCard("bob", card.cardTemplateId, cmd), { code: "CARD_FORBIDDEN" });
  await assert.rejects(repo.copyOwnedCard("alice", card.cardTemplateId, { ...cmd, revision: 5 }), { code: "STALE_REVISION" });
  await repo.db.command({ collMod: "deckTemplates", validator: { revision: { $ne: 1 } }, validationLevel: "strict" });
  await assert.rejects(repo.copyOwnedCard("alice", card.cardTemplateId, cmd));
  assert.equal((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.firstReusedAt, undefined);
  assert.deepEqual((await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!.draft, target.draft);
  await repo.db.command({ collMod: "deckTemplates", validator: {} });
  await repo.copyOwnedCard("alice", card.cardTemplateId, cmd);
  await repo.saveDeckDraft("alice", target.deckTemplateId, 1, target.draft!);
  await assert.rejects(repo.copyOwnedCard("alice", card.cardTemplateId, cmd), { code: "STALE_REVISION" });
  assert.deepEqual((await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!.draft!.cards, []);
});

test("Copy and Step transfer serialize through the Card root, never transfer an already reused Step", async () => {
  for (let i = 0; i < 4; i++) {
    const { repo, card, second, source, target } = await setup();
    const cmd = await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId);
    const [copy, move] = await Promise.allSettled([
      repo.copyOwnedCard("alice", card.cardTemplateId, cmd),
      repo.moveConstructionStep("alice", source.deckTemplateId, card.cardTemplateId, second.cardTemplateId, 0, 0, { deck: 0, source: 0, destination: 0 }),
    ]);
    assert.equal(copy.status, "fulfilled");
    if (move.status === "rejected") assert.equal(move.reason.code, "CROSS_CARD_MOVE_AFTER_REUSE");
    const dto = await creatorDTO(repo, "alice", target.deckTemplateId);
    assert.equal(dto.cards[0].content.steps[0].stepId, move.status === "fulfilled" ? second.draft!.steps[0].stepId : card.draft!.steps[0].stepId);
    const current = (await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!;
    await assert.rejects(repo.moveConstructionStep("alice", source.deckTemplateId, card.cardTemplateId, second.cardTemplateId, 0, 0,
      { deck: move.status === "fulfilled" ? 1 : 0, source: current.revision, destination: move.status === "fulfilled" ? 1 : 0 }), { code: "CROSS_CARD_MOVE_AFTER_REUSE" });
  }
});

test("concurrent generic attachments also record permanent reuse and cannot bypass Copy protection", async () => {
  const { repo, card, source, target } = await setup();
  const other = await repo.createDeckDraft("alice", createDefaultDeckContent([]));
  const standalone = await repo.createCardDraft("alice", createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]));
  await Promise.all([target, other].map((root) => repo.saveDeckDraft("alice", root.deckTemplateId, 0, { ...root.draft!, cards: [{ cardTemplateId: standalone.cardTemplateId }] })));
  const reused = (await repo.cards().findOne({ cardTemplateId: standalone.cardTemplateId }))!;
  assert.ok(reused.firstReusedAt);
  const hash = deckContentHash(source.draft!); assert.equal(hash.length, 64);
  await assert.rejects(copyDestinations(repo, "bob", card.cardTemplateId, source.deckTemplateId), { code: "CARD_FORBIDDEN" });
});

async function publishedTarget(repo: CardRepository, archived = false) {
  const target = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Published destination" });
  await repo.publishDeck("alice", target.deckTemplateId, 0);
  if (archived) await repo.archiveDeckData("alice", target.deckTemplateId);
  return (await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!;
}

test("clean published destinations auto-publish Copy atomically, including archived adoption and exact retry", async () => {
  for (const archived of [false, true]) {
    const { repo, card, source } = await setup();
    await repo.publishCard("alice", card.cardTemplateId, 0);
    const target = await publishedTarget(repo, archived);
    const before = (await repo.getPersonalUser("alice"))!;
    const cmd = await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId);
    const [result, retry] = await Promise.all([repo.copyOwnedCard("alice", card.cardTemplateId, cmd), repo.copyOwnedCard("alice", card.cardTemplateId, cmd)]);
    assert.deepEqual(retry, result); assert.equal(result.outcome, "published"); assert.equal(result.publishedVersion, 2);
    assert.equal(result.revision, target.revision + 2);
    const stored = (await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!;
    assert.equal(stored.draft, null); assert.equal(stored.latestVersion, 2);
    assert.equal(await repo.deckVersions().countDocuments({ deckTemplateId: target.deckTemplateId }), 2);
    const version = (await repo.getDeckVersion(target.deckTemplateId, 2))!;
    assert.deepEqual(version.content.cards, [{ cardTemplateId: card.cardTemplateId, cardVersionAtPublish: 1 }]);
    assert.deepEqual(version.copyReceipt, { cardTemplateId: card.cardTemplateId, revision: cmd.revision, contentHash: cmd.contentHash });
    assert.deepEqual((await repo.getDeckVersion(target.deckTemplateId, 1))!.content.cards, []);
    const user = (await repo.getPersonalUser("alice"))!, membership = user.decksData.find((data) => data.deckTemplateId === target.deckTemplateId)!;
    assert.deepEqual(membership.archivedAt, before.decksData[0].archivedAt); assert.equal(membership.deckTemplateVersion, 2);
    assert.deepEqual(membership.sharedWithUserIds, before.decksData[0].sharedWithUserIds);
    assert.equal(user.cardsData.filter((data) => data.cardTemplateId === card.cardTemplateId).length, 1);
    assert.ok((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.firstReusedAt);
    await assert.rejects(repo.copyOwnedCard("alice", card.cardTemplateId, await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId)), { code: "COPY_CARD_RECOVERY_CONFLICT" });
    await repo.saveDeckDraft("alice", target.deckTemplateId, result.revision, { ...createDefaultDeckContent([]), title: "Later unrelated work", cards: [{ cardTemplateId: card.cardTemplateId }] });
    await assert.rejects(repo.copyOwnedCard("alice", card.cardTemplateId, cmd), { code: "COPY_CARD_RECOVERY_CONFLICT" });
    assert.equal(await repo.deckVersions().countDocuments({ deckTemplateId: target.deckTemplateId }), 2);
  }
});

test("dirty published and never-published destinations keep all Deck work in draft", async () => {
  for (const published of [false, true]) {
    const { repo, card, source, target: initial } = await setup();
    await repo.publishCard("alice", card.cardTemplateId, 0);
    const target = published ? await publishedTarget(repo) : initial;
    if (published) await repo.saveDeckDraft("alice", target.deckTemplateId, target.revision, { ...initial.draft!, title: "Unpublished title and themes", themes: [{ id: "custom", title: "Unrelated edit" }] });
    const before = (await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!;
    const cmd = await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId);
    const result = await repo.copyOwnedCard("alice", card.cardTemplateId, cmd);
    assert.equal(result.outcome, "draft"); assert.equal(result.publishedVersion, null);
    const after = (await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!;
    assert.equal(after.latestVersion, before.latestVersion);
    assert.deepEqual(after.draft, { ...before.draft!, cards: [{ cardTemplateId: card.cardTemplateId }] });
    assert.deepEqual(await repo.copyOwnedCard("alice", card.cardTemplateId, cmd), result);
  }
});

test("unpublished Card copies stay draft-only even if Card later publishes; later Deck publication is not misidentified on retry", async () => {
  const { repo, card, source } = await setup(), target = await publishedTarget(repo);
  const cmd = await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId);
  const result = await repo.copyOwnedCard("alice", card.cardTemplateId, cmd);
  assert.equal(result.outcome, "draft");
  await repo.publishCard("alice", card.cardTemplateId, 0);
  assert.deepEqual(await repo.copyOwnedCard("alice", card.cardTemplateId, cmd), result);
  assert.equal((await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!.latestVersion, 1);
  await repo.publishDeck("alice", target.deckTemplateId, result.revision);
  await assert.rejects(repo.copyOwnedCard("alice", card.cardTemplateId, cmd), { code: "COPY_CARD_RECOVERY_CONFLICT" });
  assert.equal((await repo.getDeckVersion(target.deckTemplateId, 2))!.copyReceipt, undefined);
  assert.equal(await repo.deckVersions().countDocuments({ deckTemplateId: target.deckTemplateId }), 2);
});

test("auto-publication pins the Card's published version without publishing or erasing its newer draft", async () => {
  const { repo, card, source } = await setup();
  await repo.publishCard("alice", card.cardTemplateId, 0);
  await repo.saveCardDraft("alice", card.cardTemplateId, 1, { ...card.draft!, intro: { ...card.draft!.intro, title: "Unpublished Card edit" } });
  const before = await repo.cards().findOne({ cardTemplateId: card.cardTemplateId });
  const target = await publishedTarget(repo);
  const result = await repo.copyOwnedCard("alice", card.cardTemplateId, await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId));
  assert.equal(result.outcome, "published");
  const after = (await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!;
  assert.deepEqual(after.draft, before!.draft); assert.equal(after.revision, before!.revision); assert.equal(after.latestVersion, 1);
  assert.equal(await repo.cardVersions().countDocuments({ cardTemplateId: card.cardTemplateId }), 1);
  assert.deepEqual((await repo.getDeckVersion(target.deckTemplateId, 2))!.content.cards, [{ cardTemplateId: card.cardTemplateId, cardVersionAtPublish: 1 }]);
});

test("normal publication prerequisites prevent auto-publish but retain the appended draft", async () => {
  const { repo, card, source } = await setup(); await repo.publishCard("alice", card.cardTemplateId, 0);
  const target = await publishedTarget(repo);
  // Represent missing canonical version corruption without fetching any assets.
  await repo.cardVersions().deleteOne({ cardTemplateId: card.cardTemplateId, version: 1 });
  const result = await repo.copyOwnedCard("alice", card.cardTemplateId, await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId));
  assert.equal(result.outcome, "draft"); assert.equal((await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!.latestVersion, 1);
});

test("destination edit committed after the clean snapshot cannot be swept into Copy auto-publication", async () => {
  const { repo, card, source } = await setup(); await repo.publishCard("alice", card.cardTemplateId, 0);
  const target = await publishedTarget(repo), cmd = await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId);
  let reached!: () => void, resume!: () => void;
  const snapshotRead = new Promise<void>((resolve) => { reached = resolve; }), release = new Promise<void>((resolve) => { resume = resolve; });
  const getVersion = repo.getDeckVersion.bind(repo); let paused = false;
  repo.getDeckVersion = async (...args) => {
    const result = await getVersion(...args);
    if (!paused && args[0] === target.deckTemplateId && args[2]) { paused = true; reached(); await release; }
    return result;
  };
  const copying = repo.copyOwnedCard("alice", card.cardTemplateId, cmd);
  const rejected = assert.rejects(copying, { code: "STALE_REVISION" });
  await snapshotRead;
  try { await repo.saveDeckDraft("alice", target.deckTemplateId, target.revision, { ...createDefaultDeckContent([]), title: "Concurrent unrelated title" }); }
  finally { resume(); }
  await rejected;
  const after = (await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!;
  assert.equal(after.latestVersion, 1); assert.equal(after.draft!.title, "Concurrent unrelated title"); assert.deepEqual(after.draft!.cards, []);
  assert.equal((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.firstReusedAt, undefined);
  const result = await repo.copyOwnedCard("alice", card.cardTemplateId, await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId));
  assert.equal(result.outcome, "draft"); assert.equal((await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }))!.latestVersion, 1);
});

test("publication failure rolls back append, reuse, immutable version and personal adoption together", async () => {
  const { repo, card, source } = await setup(); await repo.publishCard("alice", card.cardTemplateId, 0);
  const target = await publishedTarget(repo), user = await repo.getPersonalUser("alice");
  const cmd = await command(repo, card.cardTemplateId, source.deckTemplateId, target.deckTemplateId);
  await repo.db.command({ collMod: "deckTemplateVersions", validator: { version: { $ne: 2 } }, validationLevel: "strict" });
  await assert.rejects(repo.copyOwnedCard("alice", card.cardTemplateId, cmd));
  assert.deepEqual(await repo.decks().findOne({ deckTemplateId: target.deckTemplateId }), target);
  assert.deepEqual(await repo.getPersonalUser("alice"), user);
  assert.equal((await repo.cards().findOne({ cardTemplateId: card.cardTemplateId }))!.firstReusedAt, undefined);
  assert.equal(await repo.getDeckVersion(target.deckTemplateId, 2), null);
  await repo.db.command({ collMod: "deckTemplateVersions", validator: {} });
  assert.equal((await repo.copyOwnedCard("alice", card.cardTemplateId, cmd)).outcome, "published");
});
