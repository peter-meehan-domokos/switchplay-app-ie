import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { ownerPreviewPages, sharedPreviewPages } from "../src/lib/mediaCollection/preparation";
import { readOwnerMediaPage } from "../src/lib/mediaCollection/ownerHistory";
import { readReflectionFeed, readReflectionFeedsInSession, type ReflectionView } from "../src/lib/reflections/reads";
import { createGroupReflectionIndexes } from "../src/lib/reflections/indexes";
import { createGroupMediaIndexes } from "../src/lib/groupExperiences/media/indexes";
import { GroupMediaRepository } from "../src/lib/groupExperiences/media/repository";
import { readMediaPage } from "../src/lib/groupExperiences/media/reads";
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri(), { monitorCommands: true }).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
const image = (id: string, uploadedAt?: string) => ({ id, mediaType: "image", provider: "cloudflare-r2", assetId: `user-cards/test/${id}.jpg`, src: `https://personal.invalid/${id}.jpg`, description: id, ...(uploadedAt ? { uploadedAt } : {}) });
async function fixture() {
 const f = await groupFixture(client, { cardCount: 6 }); await createGroupMediaIndexes(f.cards.db); await createGroupReflectionIndexes(f.cards.db); await f.cards.ensureDeckData("bob", f.deckId, 1);
 for (const [i, card] of f.ids.entries()) {
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.$[c].mediaItems": [image(`legacy-${i}`), ...Array.from({ length: 7 }, (_, j) => image(`image-${i}-${j}`, `2026-10-${String(j + 1).padStart(2, "0")}T00:00:00.000Z`))], "cardsData.$[c].reflection": `Personal note ${i}` } }, { arrayFilters: [{ "c.cardTemplateId": card }] });
  await f.cards.db.collection("groupMediaContributions").insertMany(Array.from({ length: 8 }, (_, j) => ({ contributionId: `group-${i}-${j}`, operationId: `op-${i}-${j}`, authorUserId: j % 2 ? "bob" : "carol", cardTemplateId: card, experienceId: f.experienceId, state: "attached", groupVisible: j !== 7, revision: 2, kind: "image", uploadedAt: new Date(`2026-10-${String(j+1).padStart(2,"0")}T00:00:00.000Z`) })));
  await f.cards.db.collection("groupReflections").insertOne({ reflectionId: `reflection-${i}`, authorUserId: "bob", cardTemplateId: card, experienceId: f.experienceId, text: `Group note ${i}`, revision: 1, groupVisible: true, deleted: false, createdAt: new Date() });
 }
 return f;
}
test("batched owner windows exactly match existing history pages for every Card and context", async () => {
 const f = await fixture();
 for (const inGroup of [false, true]) {
  const pages = await f.repo.transaction(async session => ownerPreviewPages(f.cards, "bob", f.ids, session, true, inGroup ? await f.repo.access("bob", f.experienceId, "member", session) : undefined));
  for (const card of f.ids) assert.deepEqual(pages[card], await readOwnerMediaPage(f.cards, "bob", card, { limit: 5, ...(inGroup ? { experienceId: f.experienceId } : {}) }));
 }
});
test("batched foreign media windows match authorised shared ordering, counts, cursors and capabilities", async () => {
 const f = await fixture();
 const pages = await f.repo.transaction(async session => sharedPreviewPages(f.cards, "alice", f.ids, session, await f.repo.access("alice", f.experienceId, "member", session)));
 // The existing feed returns descending items; the Card preview displays chronological order.
 for (const card of f.ids) {
  const old = await readMediaPage(new GroupMediaRepository(f.repo), "alice", card, { kind: "group", experienceId: f.experienceId }, { limit: 5 });
  assert.equal(pages[card].total, old.total); assert.equal(pages[card].start, old.start);
  assert.deepEqual(pages[card].items.map(i => i.source.kind === "group" && i.source.contributionId), old.items.map(i => i.contributionId).reverse());
  assert.deepEqual(pages[card].capabilities, old.capabilities);
  assert.equal(pages[card].older, JSON.stringify({ after: old.next }));
 }
});
test("batched reflection feeds retain exact current-context and unified owner history semantics", async () => {
 const f = await fixture();
 for (const [actor, view] of [["bob", { kind: "personal" }], ["bob", { kind: "group", mode: "own", experienceId: f.experienceId, accessEpoch: 0 }], ["alice", { kind: "group", mode: "group", experienceId: f.experienceId, accessEpoch: 0 }]] as [string, ReflectionView][]) {
  const feeds = await f.repo.transaction(session => readReflectionFeedsInSession(f.repo, actor, f.ids, view, session));
  for (const card of f.ids) assert.deepEqual(feeds[card], await readReflectionFeed(f.repo, actor, card, view));
 }
});

test("complete composed reads are read-only, selected-scope complete and contain no foreign private history", async () => {
 const f = await fixture();
 const { preparePersonalDeck } = await import("../src/lib/cards/preparation"); const { prepareGroup } = await import("../src/lib/groupExperiences/preparation");
 const before = JSON.stringify(await f.cards.users().find({}).toArray()), members = JSON.stringify(await f.repo.members().find({}).toArray());
 const personal = await preparePersonalDeck(f.cards, "bob", f.deckId);
 assert.equal(personal.deck.cards.length, 6); assert.equal(Object.keys(personal.contributions.media).length, 6); assert.equal(Object.keys(personal.contributions.reflections).length, 6);
 assert.equal(Object.keys(personal.deck.preparedAssessments!).length, 6);
 const me = await prepareGroup(f.repo, "bob", f.experienceId, { perspective: "self" });
 const group = await prepareGroup(f.repo, "alice", f.experienceId, { perspective: "group" });
 for (const read of [me, group]) for (const card of f.ids) { assert.ok(read.contributions.media[card]); assert.ok(read.contributions.reflections[card]); }
 assert.ok(!JSON.stringify(group).includes("Personal note"));
 assert.ok(me.contributions.media[f.ids[5]].items.some(item => item.source.kind === "personal"));
 assert.equal(JSON.stringify(await f.cards.users().find({}).toArray()), before); assert.equal(JSON.stringify(await f.repo.members().find({}).toArray()), members);
 await assert.rejects(prepareGroup(f.repo, "outsider", f.experienceId));
 const deniedSelection = await prepareGroup(f.repo, "bob", f.experienceId, { perspective: "follower", subjectUserId: "carol" });
 assert.equal(deniedSelection.bootstrap.selection.perspective, "self");
 assert.ok(Object.values(deniedSelection.contributions.reflections).every(feed => feed.items.every(item => item.entry.authorUserId === "bob")));
});

test("early six-Card complete reader measurements including heavy owner histories", async () => {
 const f = await fixture(); const { preparePersonalDeck } = await import("../src/lib/cards/preparation"); const { prepareGroup } = await import("../src/lib/groupExperiences/preparation");
 const extra = Array.from({ length: 14 }, (_, i) => `player-${i}`);
 await f.cards.users().insertMany(extra.map(_id => ({ _id, username: _id, email: `${_id}@example.test`, decksData: [], cardsData: [] })));
 for (const [i, actor] of [...extra, "dave", "creator"].entries()) {
  const experience = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  await f.repo.changeMember("alice", f.experienceId, { kind: i < extra.length ? "add-follower" : "set-admin", ...(i < extra.length ? {} : { isAdmin: true }), operationId: `benchmark-member-${i}`, targetUserId: actor, expectedStructureRevision: experience.structureRevision });
 }

 const measure = async (name: string, read: () => Promise<unknown>) => {
  await read(); const samples = [];
  for (let i = 0; i < 5; i++) { let commands = 0, metadata = 0; const count = (event: { commandName: string }) => { commands++; if (["listCollections", "listIndexes"].includes(event.commandName)) metadata++; };
   client.on("commandStarted", count); const start = performance.now(); const result = await read(); const ms = performance.now() - start; client.off("commandStarted", count);
   const json = JSON.stringify(result), parseStart = performance.now(); JSON.parse(json); samples.push({ ms: +ms.toFixed(2), commands, metadata, bytes: Buffer.byteLength(json), parseMs: +(performance.now() - parseStart).toFixed(2) });
  }
  console.log("CP2_MEASUREMENT", name, JSON.stringify(samples));
 };
 await measure("Personal six Cards", () => preparePersonalDeck(f.cards, "bob", f.deckId));
 await measure("Follower Me six Cards", () => prepareGroup(f.repo, "bob", f.experienceId, { perspective: "self" }));
 await measure("Admin Group six Cards", () => prepareGroup(f.repo, "alice", f.experienceId, { perspective: "group" }));
 for (const card of f.ids) await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.$[c].mediaItems": Array.from({ length: 1500 }, (_, j) => image(`heavy-${j}`, "2026-10-15T00:00:00.000Z")), "cardsData.$[c].reflection": "Long reflection. ".repeat(1200) } }, { arrayFilters: [{ "c.cardTemplateId": card }] });
 await measure("Heavy Personal 9000 attachments and long reflections", () => preparePersonalDeck(f.cards, "bob", f.deckId));
 await measure("Heavy Me 9000 attachments and long reflections", () => prepareGroup(f.repo, "bob", f.experienceId, { perspective: "self" }));
 await measure("Group excludes heavy owner history", () => prepareGroup(f.repo, "alice", f.experienceId, { perspective: "group" }));
 await f.repo.members().updateOne({ experienceId: f.experienceId, userId: "bob" }, { $set: { isAdmin: true } });
 await measure("Dual-role Group with heavy owner history excluded", () => prepareGroup(f.repo, "bob", f.experienceId, { perspective: "group" }));
 await measure("Dual-role marginal complete Me projection with heavy history", () => f.repo.transaction(async session => {
  const authority = await f.repo.access("bob", f.experienceId, "member", session);
  const media = await ownerPreviewPages(f.cards, "bob", f.ids, session, true, authority);
  const reflections = await readReflectionFeedsInSession(f.repo, "bob", f.ids, { kind: "group", experienceId: f.experienceId, mode: "own", accessEpoch: 0 }, session, authority);
  return { media, reflections };
 }));
 // A contribution-heavy Group still returns top-five/counts rather than histories.
 const currentCount = await f.cards.db.collection("groupMediaContributions").countDocuments({ experienceId: f.experienceId });
 await f.cards.db.collection("groupMediaContributions").insertMany(Array.from({ length: 600 - currentCount }, (_, i) => ({ contributionId: `capacity-${i}`, operationId: `capacity-op-${i}`, authorUserId: ["bob", "carol", ...extra][i % 16], cardTemplateId: f.ids[i % 6], experienceId: f.experienceId, state: "attached", groupVisible: true, revision: 2, kind: "image", uploadedAt: new Date("2026-11-01T00:00:00.000Z") })));
 await measure("19-member Group with 600 contributions", () => prepareGroup(f.repo, "alice", f.experienceId, { perspective: "group" }));
 for (const cardTemplateId of f.ids) for (const authorUserId of ["bob", "carol", ...extra]) await f.cards.db.collection("groupReflections").updateOne({ experienceId: f.experienceId, cardTemplateId, authorUserId }, { $set: { text: "Long shared reflection. ".repeat(800), revision: 2, groupVisible: true, deleted: false }, $setOnInsert: { reflectionId: `capacity-note-${cardTemplateId}-${authorUserId}`, createdAt: new Date() } }, { upsert: true });
 await measure("19-member Group with 600 media and 96 long reflections", () => prepareGroup(f.repo, "alice", f.experienceId, { perspective: "group" }));
 const larger = Array.from({ length: 81 }, (_, i) => `larger-player-${i}`);
 await f.cards.users().insertMany(larger.map(_id => ({ _id, username: _id, email: `${_id}@example.test`, decksData: [], cardsData: [] })));
 await f.repo.members().insertMany(larger.map(actor => f.repo.newMember(f.experienceId, actor, false, true, f.ids.map(cardTemplateId => ({ cardTemplateId, version: 1 })), new Date())));
 await measure("100-member Group with 600 media and retained long notes", () => prepareGroup(f.repo, "alice", f.experienceId, { perspective: "group" }));

});

test("batched owner preview preserves reused lineage, legacy order, duplicate IDs and genuine known emptiness", async () => {
 const f = await fixture();
 await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": [image("legacy-own"), image("same"), image("same"), image("dated", "2026-10-01T00:00:00.000Z")], "cardsData.0.historySourceCardTemplateId": "ancestor", "cardsData.1.historySourceCardTemplateId": "ancestor", "cardsData.5.mediaItems": [] } });
 await f.cards.users().updateOne({ _id: "bob" }, { $push: { cardsData: { cardTemplateId: "ancestor", mediaItems: [image("legacy-inherited"), image("dated-inherited", "2026-10-01T00:00:00.000Z")], tests: [], reflection: "Unrelated private ancestor note" } as never } });
 await f.cards.db.collection("groupMediaContributions").deleteMany({ cardTemplateId: f.ids[5] });
 const pages = await f.cards.transaction(session => ownerPreviewPages(f.cards, "bob", f.ids, session, true));
 for (const card of [f.ids[0], f.ids[1], f.ids[5]]) assert.deepEqual(pages[card], await readOwnerMediaPage(f.cards, "bob", card, { limit: 5 }));
 assert.equal(pages[f.ids[5]].total, 0); assert.deepEqual(pages[f.ids[5]].items, []);
});

test("actual Group entry reuses opening semantics while ordinary preparation has no writes", async () => {
 const f = await fixture(); const { prepareGroup } = await import("../src/lib/groupExperiences/preparation");
 const before = await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" });
 const beforeDate = (await f.cards.users().findOne({ _id: "bob" }))!.cardsData[4].targetDate;
 assert.equal(before!.openedAt, null);
 await prepareGroup(f.repo, "bob", f.experienceId, { perspective: "self" });
 assert.deepEqual(await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }), before);
 const opened = await prepareGroup(f.repo, "bob", f.experienceId, { perspective: "self" }, { cardTemplateId: f.ids[4] });
 assert.equal(opened.bootstrap.activeCardId, f.ids[4]);
 const after = await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }); assert.ok(after!.openedAt instanceof Date);
 assert.equal((await f.cards.users().findOne({ _id: "bob" }))!.cardsData[4].targetDate, beforeDate);
});

test("actual Personal entry prepares every face in its opening snapshot and preserves date initialisation", async () => {
 const f = await fixture(); const { preparePersonalDeck, openPreparedPersonalDeck } = await import("../src/lib/cards/preparation");
 await preparePersonalDeck(f.cards, "bob", f.deckId);
 assert.equal((await f.cards.users().findOne({ _id: "bob" }))!.decksData[0].openedAt, null);
 const prepared = await openPreparedPersonalDeck(f.cards, "bob", f.deckId, "2026-11-08", f.ids[5], 1);
 assert.equal(prepared.deck.activeCardId, f.ids[5]); assert.ok(prepared.deck.openedAt);
 assert.ok(prepared.deck.cards.every(card => card.targetDate === "2027-06-01"));
 const user = (await f.cards.users().findOne({ _id: "bob" }))!;
 for (const card of prepared.deck.cards) { assert.equal(card.targetDate, user.cardsData.find(row => row.cardTemplateId === card.id)!.targetDate); assert.ok(prepared.contributions.media[card.id]); assert.ok(prepared.contributions.reflections[card.id]); }
 await assert.rejects(openPreparedPersonalDeck(f.cards, "bob", f.deckId, "2026-11-08", f.ids[5], 2));
});

test("heavy owner history command attribution without hosted latency claims", async () => {
 const f = await fixture(); const { preparePersonalDeck } = await import("../src/lib/cards/preparation"); const { prepareGroup } = await import("../src/lib/groupExperiences/preparation");
 for (const card of f.ids) await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.$[c].mediaItems": Array.from({ length: 1500 }, (_, j) => image(`heavy-${j}`, "2026-10-15T00:00:00.000Z")) } }, { arrayFilters: [{ "c.cardTemplateId": card }] });
 for (const [name, read] of [["Personal", () => preparePersonalDeck(f.cards, "bob", f.deckId)], ["Me", () => prepareGroup(f.repo, "bob", f.experienceId, { perspective: "self" })]] as const) {
  await read(); const pending = new Map<number, string>(), durations = new Map<string, number>();
  const started = (event: { requestId: number; commandName: string; command: Record<string, unknown> }) => {
   const collection = event.command.find ?? event.command.aggregate ?? "snapshot";
   pending.set(event.requestId, `${event.commandName}:${collection}${JSON.stringify(event.command.pipeline ?? []).includes("$firstN") ? ":preview-window" : ""}`);
  };
  const succeeded = (event: { requestId: number; duration: number }) => { const key = pending.get(event.requestId)!; durations.set(key, (durations.get(key) ?? 0) + event.duration); };
  client.on("commandStarted", started); client.on("commandSucceeded", succeeded);
  const start = performance.now(); await read(); const totalMs = performance.now() - start;
  client.off("commandStarted", started); client.off("commandSucceeded", succeeded);
  console.log("CP2_COMMAND_ATTRIBUTION", JSON.stringify({ name, totalMs: +totalMs.toFixed(2), localDriverRoundTripMs: Object.fromEntries([...durations].map(([key, value]) => [key, +value.toFixed(2)])) }));
 }
});

test("initial owner reflection previews exclude unrelated history without changing full-history retrieval", async () => {
 const f = await fixture(); const { preparePersonalDeck } = await import("../src/lib/cards/preparation"); const { prepareGroup } = await import("../src/lib/groupExperiences/preparation");
 const personal = await preparePersonalDeck(f.cards, "bob", f.deckId), me = await prepareGroup(f.repo, "bob", f.experienceId, { perspective: "self" });
 for (const card of f.ids) {
  assert.equal(personal.contributions.reflections[card].items.length, 1); assert.equal(personal.contributions.reflections[card].items[0].entry.source.kind, "personal");
  assert.equal(me.contributions.reflections[card].items.length, 1); assert.equal(me.contributions.reflections[card].items[0].entry.source.kind, "group");
  assert.ok((await readReflectionFeed(f.repo, "bob", card, { kind: "personal" })).items.length > 1);
 }
});

test("final narrow six-Card preparation query and payload measurements", async () => {
 const f = await fixture(), now = new Date();
 const { preparePersonalDeck } = await import("../src/lib/cards/preparation"); const { prepareGroup } = await import("../src/lib/groupExperiences/preparation");
 const extra = Array.from({ length: 14 }, (_, i) => `final-player-${i}`);
 await f.cards.users().insertMany(extra.map(_id => ({ _id, username: _id, email: `${_id}@example.test`, decksData: [], cardsData: [] })));
 const refs = f.ids.map(cardTemplateId => ({ cardTemplateId, version: 1 }));
 await f.repo.members().insertMany([...extra.map(actor => f.repo.newMember(f.experienceId, actor, false, true, refs, now)), ...["dave", "creator"].map(actor => f.repo.newMember(f.experienceId, actor, true, false, refs, now))]);
 for (const [name, read] of [["Personal", () => preparePersonalDeck(f.cards, "bob", f.deckId)], ["Me", () => prepareGroup(f.repo, "bob", f.experienceId, { perspective: "self" })], ["Group", () => prepareGroup(f.repo, "alice", f.experienceId, { perspective: "group" })]] as const) {
  await read(); const samples = [];
  for (let i = 0; i < 5; i++) { let commands = 0, metadata = 0; const count = (e: { commandName: string }) => { commands++; if (["listIndexes", "listCollections"].includes(e.commandName)) metadata++; };
   client.on("commandStarted", count); const start = performance.now(), result = await read(), ms = performance.now() - start; client.off("commandStarted", count);
   const json = JSON.stringify(result), parse = performance.now(); JSON.parse(json); samples.push({ ms: +ms.toFixed(2), commands, metadata, bytes: Buffer.byteLength(json), nodeParseMs: +(performance.now() - parse).toFixed(2) });
  }
  console.log("CP2_FINAL_READER", name, JSON.stringify(samples));
 }
});
