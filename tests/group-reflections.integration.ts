import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { createGroupReflectionIndexes } from "../src/lib/reflections/indexes";
import { GroupReflectionRepository } from "../src/lib/reflections/groupRepository";
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri(), { monitorCommands: true }).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function fixture() {
  const f = await groupFixture(client); await createGroupReflectionIndexes(f.cards.db);
  const reflections = new GroupReflectionRepository(f.repo);
  const command = (text: string, expectedRevision = 0) => ({ operationId: randomUUID(), accessEpoch: 0, expectedRevision, text });
  return { ...f, reflections, command };
}
test("Group reflection ownership is per author and current context, including Admin without Follower role", async () => {
  const f = await fixture(), privateBefore = JSON.stringify(await f.cards.users().find({}).toArray());
  const own = await f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Our Galway group practised defensive footwork together today."));
  const admin = await f.reflections.save("alice", f.experienceId, f.ids[0], f.command("Our group communicated better throughout the defensive drills today."));
  assert.notEqual(own.reflectionId, admin.reflectionId);
  const rows = await f.reflections.rows().find({}).toArray(); assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.reflectionId === own.reflectionId)!.authorUserId, "bob");
  assert.equal(rows.find(r => r.reflectionId === admin.reflectionId)!.authorUserId, "alice");
  assert.equal(JSON.stringify(await f.cards.users().find({}).toArray()), privateBefore);
});
test("revision conflicts and exact retries cannot overwrite text or revive deleted state", async () => {
  const f = await fixture(), cmd = f.command("I contributed well to our Galway group practice today.");
  const saved = await f.reflections.save("bob", f.experienceId, f.ids[0], cmd);
  assert.equal((await f.reflections.save("bob", f.experienceId, f.ids[0], cmd)).revision, saved.revision);
  await assert.rejects(f.reflections.save("bob", f.experienceId, f.ids[0], { ...cmd, text: "Different command" }));
  const results = await Promise.allSettled([f.reflections.save("bob", f.experienceId, f.ids[0], f.command("One edit", saved.revision)), f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Competing edit", saved.revision))]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const row = (await f.reflections.rows().findOne({ reflectionId: saved.reflectionId! }))!;
  await f.reflections.deleteOwn("bob", saved.reflectionId!, { operationId: randomUUID(), expectedRevision: row.revision });
  await assert.rejects(f.reflections.save("bob", f.experienceId, f.ids[0], cmd));
  assert.equal((await f.reflections.rows().findOne({ reflectionId: saved.reflectionId! }))!.deleted, true);
});
test("Admin hiding preserves author text and ownership; edits do not unhide", async () => {
  const f = await fixture(), saved = await f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Teammates helped me improve during our group practice today."));
  await assert.rejects(f.reflections.hide("carol", f.experienceId, saved.reflectionId!, { operationId: randomUUID(), expectedRevision: saved.revision, accessEpoch: 0 }));
  await assert.rejects(f.reflections.deleteOwn("alice", saved.reflectionId!, { operationId: randomUUID(), expectedRevision: saved.revision }));
  const before = (await f.reflections.rows().findOne({ reflectionId: saved.reflectionId! }))!;
  const hidden = await f.reflections.hide("alice", f.experienceId, saved.reflectionId!, { operationId: randomUUID(), expectedRevision: saved.revision, accessEpoch: 0 });
  const edited = await f.reflections.save("bob", f.experienceId, f.ids[0], f.command("My corrected group reflection", hidden.revision));
  const row = (await f.reflections.rows().findOne({ reflectionId: edited.reflectionId! }))!;
  assert.equal(row.groupVisible, false); assert.equal(row.authorUserId, "bob"); assert.equal(row.text, "My corrected group reflection"); assert.deepEqual(row.createdAt, before.createdAt);
});
test("creator deletion survives leaving; stale membership edits cannot change retained content", async () => {
  const f = await fixture(), saved = await f.reflections.save("bob", f.experienceId, f.ids[0], f.command("I enjoyed our Galway training session with teammates today."));
  const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  await f.repo.changeMember("alice", f.experienceId, { kind: "remove-follower", targetUserId: "bob", operationId: randomUUID(), expectedStructureRevision: e.structureRevision });
  await assert.rejects(f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Forbidden edit", saved.revision)));
  const cmd = { operationId: randomUUID(), expectedRevision: saved.revision };
  const removed = await f.reflections.deleteOwn("bob", saved.reflectionId!, cmd);
  assert.equal((await f.reflections.deleteOwn("bob", saved.reflectionId!, cmd)).revision, removed.revision);
  assert.equal((await f.reflections.rows().findOne({ reflectionId: saved.reflectionId! }))!.text, "");
});
test("wrong sources, stale epochs and missing indexes cannot commit a reflection", async () => {
  const f = await fixture();
  await assert.rejects(f.reflections.save("outsider", f.experienceId, f.ids[0], f.command("Not a member")));
  await assert.rejects(f.reflections.save("bob", f.experienceId, "forged-card", f.command("Not in scope")));
  await assert.rejects(f.reflections.save("bob", f.experienceId, f.ids[0], { ...f.command("Old access"), accessEpoch: 7 }));
  assert.equal(await f.reflections.rows().countDocuments(), 0);
  await f.reflections.rows().dropIndexes();
  await assert.rejects(new GroupReflectionRepository(f.repo).save("bob", f.experienceId, f.ids[0], f.command("No indexes")));
  assert.equal(await f.reflections.rows().countDocuments(), 0);
});

test("failed transaction rolls back reflection text, operation identity and membership fence", async t => {
  const f = await fixture(), saved = await f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Original group reflection"));
  const collection = f.reflections.rows(), before = await collection.findOne({ reflectionId: saved.reflectionId! });
  const memberBefore = await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" });
  const update = collection.updateOne.bind(collection);
  t.mock.method(f.reflections, "rows", () => collection);
  t.mock.method(collection, "updateOne", async (...args: Parameters<typeof update>) => { await update(...args); throw Error("Injected after reflection update"); });
  await assert.rejects(f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Must roll back", saved.revision)), /Injected/);
  assert.deepEqual(await collection.findOne({ reflectionId: saved.reflectionId! }), before);
  assert.deepEqual(await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }), memberBefore);
});

test("source-aware owner history survives leaving and foreign feeds never retrieve private content", async t => {
  const f = await fixture();
  const { readReflectionFeed } = await import("../src/lib/reflections/reads");
  const own = await f.reflections.save("bob", f.experienceId, f.ids[0], f.command("My group reflection"));
  await f.reflections.save("carol", f.experienceId, f.ids[0], f.command("Visible teammate reflection"));
  const feed = await readReflectionFeed(f.repo, "bob", f.ids[0], { kind: "group", experienceId: f.experienceId, mode: "own", accessEpoch: 0 });
  assert.equal(feed.items[0].entry.source.kind, "group"); assert.equal(feed.items[0].canEdit, true);
  await f.reflections.hide("alice", f.experienceId, own.reflectionId!, { operationId: randomUUID(), expectedRevision: 1, accessEpoch: 0 });
  const users = f.cards.users();
  t.mock.method(users, "findOne", () => { throw Error("Foreign feed must not read personal CardData"); });
  const foreign = await readReflectionFeed(f.repo, "alice", f.ids[0], { kind: "group", experienceId: f.experienceId, mode: "group", accessEpoch: 0 });
  assert.equal(foreign.items.some(i => i.entry.text === "My group reflection"), false);
  assert.equal(foreign.items.filter(i => !i.empty).length, 1);
  const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  await f.repo.changeMember("alice", f.experienceId, { kind: "remove-follower", targetUserId: "bob", operationId: randomUUID(), expectedStructureRevision: e.structureRevision });
  const retained = await readReflectionFeed(f.repo, "bob", f.ids[0], { kind: "personal" });
  const item = retained.items.find(i => i.entry.text === "My group reflection")!;
  assert.equal(item.canDelete, true); assert.equal(item.canEdit, false); assert.match(item.explanation!, /no longer a member/);
});

test("Personal reflection CAS preserves legacy creation uncertainty and supports exact delete retries", async () => {
  const f = await fixture();
  const { initialCardData } = await import("../src/lib/cards/domain");
  const version = (await f.cards.getCardVersion(f.ids[0], 1))!;
  const data = initialCardData(f.ids[0], 1, version.content, new Date());
  delete data.reflectionCreatedAt; data.reflection = "Legacy personal reflection";
  await f.cards.users().updateOne({ _id: "bob" }, { $push: { cardsData: data } });
  const cmd = { operationId: randomUUID(), expectedRevision: 0 };
  const cleared = await f.cards.deletePersonalReflection("bob", f.ids[0], cmd);
  assert.equal(cleared.revision, 1);
  assert.equal((await f.cards.deletePersonalReflection("bob", f.ids[0], cmd)).revision, 1);
  await assert.rejects(f.cards.deletePersonalReflection("bob", f.ids[0], { ...cmd, operationId: randomUUID() }));
  const row = (await f.cards.users().findOne({ _id: "bob" }))!.cardsData[0];
  assert.equal(row.reflectionCreatedAt, undefined); assert.equal(row.reflection, "");
});

test("Personal new creation dates and revisions are independent of scalar learning and immutable through edits", async () => {
  const f = await fixture(); await f.cards.ensureDeckData("bob", f.deckId, 1);
  const cmd = (expectedRevision: number) => ({ expectedRevision, operationId: randomUUID() });
  await f.cards.setReflection("bob", f.deckId, f.ids[0], "My new reflection", cmd(0));
  const first = (await f.cards.getPersonalUser("bob"))!.cardsData.find(c => c.cardTemplateId === f.ids[0])!;
  assert(first.reflectionCreatedAt instanceof Date);
  await f.cards.setSignalReading("bob", f.deckId, f.ids[0], "a0", 7);
  const races = await Promise.allSettled([f.cards.setReflection("bob", f.deckId, f.ids[0], "Edit one", cmd(1)), f.cards.setReflection("bob", f.deckId, f.ids[0], "Edit two", cmd(1))]);
  assert.equal(races.filter(r => r.status === "fulfilled").length, 1);
  const after = (await f.cards.getPersonalUser("bob"))!.cardsData.find(c => c.cardTemplateId === f.ids[0])!;
  assert.deepEqual(after.reflectionCreatedAt, first.reflectionCreatedAt); assert.equal(after.reflectionRevision, 2);
  assert.equal(after.signalReadings.find(r => r.stepId === "a0")!.reading, 7);
});

test("removal released ahead of a captured Group reflection save rejects the old epoch", async t => {
  const f = await fixture(); let release!: () => void, reached!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { reached = resolve; });
  const fence = f.repo.fence.bind(f.repo); let paused = false;
  t.mock.method(f.repo, "fence", async (...args: Parameters<typeof fence>) => { if (!paused) { paused = true; reached(); await gate; } return fence(...args); });
  const save = f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Delayed old membership save"));
  await ready;
  const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  await f.repo.changeMember("alice", f.experienceId, { kind: "remove-follower", targetUserId: "bob", operationId: randomUUID(), expectedStructureRevision: e.structureRevision });
  release(); await assert.rejects(save); assert.equal(await f.reflections.rows().countDocuments({ authorUserId: "bob" }), 0);
});

test("shared feed honours peer policy, current subjects, revisions and leaves private sentinels out", async () => {
  const f = await fixture(); const { readReflectionFeed } = await import("../src/lib/reflections/reads");
  await f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Visible current Group text"));
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { privateSentinel: "DO-NOT-RETRIEVE" } });
  const inspect = { kind: "group" as const, mode: "inspection" as const, experienceId: f.experienceId, subjectUserId: "bob", accessEpoch: 0 };
  await assert.rejects(readReflectionFeed(f.repo, "carol", f.ids[0], inspect));
  const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  await f.repo.saveSettings("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: e.structureRevision, allowFollowerInspection: true });
  const visible = await readReflectionFeed(f.repo, "carol", f.ids[0], inspect);
  assert.equal(visible.items.length, 1); assert.equal(visible.items[0].canEdit, false); assert.equal(visible.items[0].canDelete, false); assert.equal(visible.items[0].canHide, false);
  assert(!JSON.stringify(visible).includes("DO-NOT-RETRIEVE"));
  await assert.rejects(readReflectionFeed(f.repo, "outsider", f.ids[0], inspect));
  await assert.rejects(readReflectionFeed(f.repo, "alice", f.ids[0], { ...inspect, accessEpoch: 999 }));
});

test("foreign reflection reads enforce visibility and private-data allowlists at the database boundary", async () => {
  const f = await fixture(); const { readReflectionFeed } = await import("../src/lib/reflections/reads");
  const visible = await f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Visible reflection"));
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { mediaSentinel: "PRIVATE-MEDIA", reflectionSentinel: "PRIVATE-PERSONAL" } });
  const seen: Record<string, unknown>[] = [];
  const capture = (event: import("mongodb").CommandStartedEvent) => { if (event.databaseName === f.cards.db.databaseName && ["find", "aggregate"].includes(event.commandName)) seen.push(event.command); };
  client.on("commandStarted", capture);
  try { await readReflectionFeed(f.repo, "carol", f.ids[0], { kind: "group", experienceId: f.experienceId, mode: "group", accessEpoch: 0 }); }
  finally { client.off("commandStarted", capture); }
  const users = seen.filter(c => c.find === "users"); assert(users.length > 0);
  for (const q of users) assert.deepEqual(q.projection, { username: 1 });
  assert.equal(seen.some(c => c.aggregate === "users"), false);
  const reflectionQueries = seen.filter(c => c.find === "groupReflections"); assert.equal(reflectionQueries.length, 1);
  assert.equal((reflectionQueries[0].filter as Record<string, unknown>).groupVisible, true);
  assert.equal((reflectionQueries[0].filter as Record<string, unknown>).deleted, false);
  assert.deepEqual(Object.keys(reflectionQueries[0].projection as object).sort(), ["_id", "reflectionId", "experienceId", "cardTemplateId", "authorUserId", "text", "revision", "createdAt", "groupVisible", "deleted"].sort());
  assert.equal((await f.reflections.rows().findOne({ reflectionId: visible.reflectionId! }))!.text, "Visible reflection");
});

test("ordinary owner reflection reads do not require Group collections or provision indexes", async () => {
  const f = await fixture(); const { readReflectionFeed } = await import("../src/lib/reflections/reads");
  await f.repo.experiences().drop(); await f.repo.members().drop(); await f.reflections.rows().drop();
  const feed = await readReflectionFeed(new (await import("../src/lib/groupExperiences/repository")).GroupExperienceRepository(f.cards), "bob", f.ids[0], { kind: "personal" });
  assert.equal(feed.items.length, 1); assert.equal(feed.items[0].empty, true);
  assert.equal(await f.cards.db.listCollections({ name: "groupReflections" }).hasNext(), false);
});

test("an unavailable originating Group never gates creator history or deletion", async () => {
  const f = await fixture(), saved = await f.reflections.save("bob", f.experienceId, f.ids[0], f.command("Retained author history"));
  const { readReflectionFeed } = await import("../src/lib/reflections/reads");
  await f.repo.experiences().deleteOne({ experienceId: f.experienceId });
  const feed = await readReflectionFeed(f.repo, "bob", f.ids[0], { kind: "personal" });
  const retained = feed.items.find(i => i.entry.text === "Retained author history")!;
  assert.equal(retained.canDelete, true); assert.equal(retained.canEdit, false); assert.equal(retained.entry.originName, "Unavailable Group");
  await f.reflections.deleteOwn("bob", saved.reflectionId!, { operationId: randomUUID(), expectedRevision: saved.revision });
  assert.equal((await readReflectionFeed(f.repo, "bob", f.ids[0], { kind: "personal" })).items.length, 1);
});

test("ambiguous duplicate Personal slots cannot be edited or cleared", async () => {
  const f = await fixture(); await f.cards.ensureDeckData("bob", f.deckId, 1);
  const original = (await f.cards.getPersonalUser("bob"))!.cardsData.find(c => c.cardTemplateId === f.ids[0])!;
  await f.cards.users().updateOne({ _id: "bob" }, { $push: { cardsData: { ...original, reflection: "Separate malformed duplicate" } } });
  const command = { expectedRevision: 0, operationId: randomUUID() };
  await assert.rejects(f.cards.setReflection("bob", f.deckId, f.ids[0], "Must not overwrite", command));
  await assert.rejects(f.cards.deletePersonalReflection("bob", f.ids[0], { ...command, operationId: randomUUID() }));
  const texts = (await f.cards.getPersonalUser("bob"))!.cardsData.filter(c => c.cardTemplateId === f.ids[0]).map(c => c.reflection);
  assert.deepEqual(texts, ["", "Separate malformed duplicate"]);
});
