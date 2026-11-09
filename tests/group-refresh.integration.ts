import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoClient, type CommandStartedEvent } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, signal } from "./helpers/groupExperiences";
import { createGroupMediaIndexes } from "../src/lib/groupExperiences/media/indexes";
import { createGroupReflectionIndexes } from "../src/lib/reflections/indexes";
import { prepareGroup } from "../src/lib/groupExperiences/preparation";
import { refreshGroup, pageGroupRefresh } from "../src/lib/groupExperiences/refresh";
import { preparePersonalDeck, openPreparedPersonalDeck } from "../src/lib/cards/preparation";
import { personalPreparationIdentity } from "../src/lib/cards/preparationIdentity";
import { PreparationAssembly } from "../src/lib/groupExperiences/preparationPages";
import { assembledRefresh } from "../src/lib/groupExperiences/refreshAssembly";
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri(), { monitorCommands: true }).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function fixture() {
  const f = await groupFixture(client, { cardCount: 6 });
  await createGroupMediaIndexes(f.cards.db); await createGroupReflectionIndexes(f.cards.db); await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.repo.experiences().updateOne({ experienceId: f.experienceId }, { $set: { allowFollowerInspection: true } });
  for (const [i, cardTemplateId] of f.ids.entries()) {
    await f.cards.db.collection("groupReflections").insertOne({ reflectionId: `note-${i}`, authorUserId: "bob", cardTemplateId, experienceId: f.experienceId,
      text: `Player ${i}`, revision: 1, groupVisible: true, deleted: false, createdAt: new Date() });
    await f.cards.db.collection("groupMediaContributions").insertMany(Array.from({ length: 100 }, (_, j) => ({ contributionId: `image-${i}-${j}`, operationId: `op-${i}-${j}`, authorUserId: j % 2 ? "bob" : "carol", cardTemplateId,
      experienceId: f.experienceId, state: "attached", groupVisible: j !== 99, revision: 2, kind: "image", uploadedAt: new Date(1_700_000_000_000 + j) })));
  }
  return f;
}
const scope = { accessEpoch: 0, structureRevision: 0, adoptionRevision: 0 };
test("mutable reads preserve exact composed preview and learning semantics without canonical bodies or writes", async () => {
  const f = await fixture();
  for (const [actor, selection] of [["alice", { perspective: "group" }], ["bob", { perspective: "self" }], ["alice", { perspective: "follower", subjectUserId: "bob" }]] as const) {
    const prepared = await prepareGroup(f.repo, actor, f.experienceId, selection);
    const commands: CommandStartedEvent[] = [], observe = (e: CommandStartedEvent) => commands.push(e);
    client.on("commandStarted", observe); const start = performance.now();
    const value = await refreshGroup(f.repo, actor, f.experienceId, selection, scope);
    const ms = performance.now() - start; client.off("commandStarted", observe);
    assert.deepEqual(value.contributions, prepared.contributions); assert.deepEqual(value.group, prepared.bootstrap.group);
    assert.deepEqual(value.aggregates, selection.perspective === "group" ? prepared.aggregates : null);
    assert.deepEqual(value.learning, selection.perspective === "self" ? prepared.bootstrap.own : selection.perspective === "follower" ? prepared.followers.find(row => row.userId === "bob")!.learning : null);
    assert.ok(!("deck" in value)); assert.ok(!("followers" in value));
    assert.ok(!commands.some(e => ["insert", "update", "delete", "listIndexes", "listCollections"].includes(e.commandName)));
    const versions = commands.filter(e => e.commandName === "find" && e.command.find === "cardTemplateVersions");
    assert.ok(versions.every(e => e.command.projection?.["content.steps.stepId"] === 1));
    console.log("CP4_MUTABLE_READ", JSON.stringify({ perspective: selection.perspective, localMs: ms, commands: commands.length, bytes: Buffer.byteLength(JSON.stringify(value)), attachments: 600 }));
  }
});
test("Group refresh rechecks inspection, membership, publication and exact composition on every read", async () => {
  const f = await fixture();
  await assert.rejects(refreshGroup(f.repo, "outsider", f.experienceId, { perspective: "group" }, scope));
  await assert.rejects(refreshGroup(f.repo, "alice", f.experienceId, { perspective: "group" }, { ...scope, structureRevision: 1 }));
  await f.repo.experiences().updateOne({ experienceId: f.experienceId }, { $set: { allowFollowerInspection: false } });
  await assert.rejects(refreshGroup(f.repo, "bob", f.experienceId, { perspective: "follower", subjectUserId: "carol" }, scope));
  await f.cards.cards().updateOne({ cardTemplateId: f.ids[0] }, { $set: { visibility: "private" } });
  await assert.rejects(refreshGroup(f.repo, "alice", f.experienceId, { perspective: "group" }, scope));
});
test("player updates change F, collective updates change G, and narrow aggregation can be omitted when already pending", async () => {
  const f = await fixture();
  await f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", signal("a0", 8));
  let value = await refreshGroup(f.repo, "alice", f.experienceId, { perspective: "group" }, scope);
  assert.equal(value.aggregates![0].followers.confidence, 8); assert.equal(value.aggregates![0].group.confidence, null);
  await f.repo.writeLearning("alice", f.experienceId, f.ids[0], "group", signal("a0", 3));
  value = await refreshGroup(f.repo, "alice", f.experienceId, { perspective: "group" }, scope);
  assert.equal(value.aggregates![0].followers.confidence, 8); assert.equal(value.aggregates![0].group.confidence, 3);
  assert.equal((await refreshGroup(f.repo, "alice", f.experienceId, { perspective: "group" }, scope, false)).aggregates, null);
});
test("read-only introduction preparation has no opening effects, while reuse still performs genuine date initialisation", async () => {
  const f = await fixture();
  const before = JSON.stringify(await f.cards.users().find({ _id: "bob" }).toArray()), member = JSON.stringify(await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }));
  const personal = await preparePersonalDeck(f.cards, "bob", f.deckId);
  await prepareGroup(f.repo, "bob", f.experienceId, { perspective: "default" });
  assert.equal(JSON.stringify(await f.cards.users().find({ _id: "bob" }).toArray()), before);
  assert.equal(JSON.stringify(await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" })), member);
  const opened = await openPreparedPersonalDeck(f.cards, "bob", f.deckId, "2026-11-09", undefined, undefined, personalPreparationIdentity(personal.deck));
  assert.ok("reusePrepared" in opened && opened.reusePrepared); assert.ok(opened.deck.cards.every(card => card.targetDate)); assert.ok(opened.deck.openedAt);
  const full = await openPreparedPersonalDeck(f.cards, "bob", f.deckId, "2026-11-09", undefined, undefined, "obsolete");
  assert.ok(!("reusePrepared" in full)); assert.equal(Object.keys(full.contributions.media).length, 6);
  const group = await f.repo.open("bob", f.experienceId, 0, undefined, { perspective: "default" });
  assert.equal(group.selection?.perspective, "self"); assert.ok((await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }))?.openedAt);
});
test("oversized mutable notes use the existing bounded transport without truncating content", async () => {
  const f = await fixture(), text = "Long 🏀 reflection ".repeat(150000);
  await f.cards.db.collection("groupReflections").updateOne({ reflectionId: "note-0" }, { $set: { text } });
  const value = await refreshGroup(f.repo, "alice", f.experienceId, { perspective: "group" }, scope);
  const assembly = new PreparationAssembly(); let next: string | undefined, pages = 0;
  do { const page = pageGroupRefresh(value, next); assert.ok("paged" in page); if (!("paged" in page)) throw Error("Expected bounded pages");
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 2_500_000); assembly.accept(page); next = page.next ?? undefined; pages++;
  } while (next);
  const restored = assembledRefresh(assembly).contributions.reflections[f.ids[0]].items.find(item => item.entry.authorUserId === "bob")!.entry.text;
  assert.ok(pages > 1); assert.equal(restored.length, text.length); assert.ok(restored === text);
});
