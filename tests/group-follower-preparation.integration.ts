import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { createGroupMediaIndexes } from "../src/lib/groupExperiences/media/indexes";
import { createGroupReflectionIndexes } from "../src/lib/reflections/indexes";
import { prepareFollowers, type FollowerPreparationHeader, type FollowerPreparationCard } from "../src/lib/groupExperiences/followerPreparation";
import { PreparationAssembly } from "../src/lib/groupExperiences/preparationPages";
import { readMediaPage } from "../src/lib/groupExperiences/media/reads";
import { GroupMediaRepository } from "../src/lib/groupExperiences/media/repository";
import { readReflectionFeed } from "../src/lib/reflections/reads";
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri(), { monitorCommands: true }).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function fixture() {
 const f = await groupFixture(client, { cardCount: 6 }); await createGroupMediaIndexes(f.cards.db); await createGroupReflectionIndexes(f.cards.db);
 for (const user of ["bob", "carol"]) for (const [i, card] of f.ids.entries()) {
  await f.cards.db.collection("groupMediaContributions").insertMany(Array.from({ length: 7 }, (_, j) => ({ contributionId: `${user}-${i}-${j}`, operationId: `${user}-${i}-${j}`, experienceId: f.experienceId, cardTemplateId: card,
   authorUserId: user, state: "attached", groupVisible: j !== 6, kind: "image", revision: 1, uploadedAt: new Date(1760000000000 + j) })));
  await f.cards.db.collection("groupReflections").insertOne({ reflectionId: `${user}-${i}`, authorUserId: user, cardTemplateId: card, experienceId: f.experienceId,
   text: `${user} Group note ${i}`, revision: 1, groupVisible: i !== 5, deleted: false, createdAt: new Date() });
 }
 return f;
}
test("follower batch equals authorised single-subject feeds, has exact windows and does not open Cards", async () => {
 const f = await fixture(), before = await f.repo.members().find({ experienceId: f.experienceId }).toArray(), assembly = new PreparationAssembly();
 const page = await prepareFollowers(f.repo, "alice", f.experienceId); assembly.accept(page); assert.equal(page.next, null);
 const header = assembly.values.get(0) as FollowerPreparationHeader; assert.equal(header.cards.length, 6); assert.equal(header.followers.length, 2);
 for (const row of [...assembly.values.values()].slice(1) as FollowerPreparationCard[]) {
  const old = await readMediaPage(new GroupMediaRepository(f.repo), "alice", row.cardTemplateId, { kind: "group", experienceId: f.experienceId, subjectUserId: row.subjectUserId }, { limit: 5 });
  assert.equal(row.media.total, old.total); assert.deepEqual(row.media.items.map(item => item.source.kind === "group" && item.source.contributionId), old.items.map(item => item.contributionId).reverse());
  assert.deepEqual(row.media.capabilities, old.capabilities); assert.equal(row.media.older, JSON.stringify({ after: old.next }));
  assert.deepEqual(row.reflection, await readReflectionFeed(f.repo, "alice", row.cardTemplateId, { kind: "group", experienceId: f.experienceId, accessEpoch: 0, mode: "inspection", subjectUserId: row.subjectUserId }));
  assert.equal(row.media.total, 6); assert.equal(row.media.items.length, 5);
  assert.ok(!("ownerDate" in row) && !JSON.stringify(row).includes("PRIVATE-"));
 }
 assert.deepEqual(await f.repo.members().find({ experienceId: f.experienceId }).toArray(), before);
 await assert.rejects(() => prepareFollowers(f.repo, "bob", f.experienceId), /FORBIDDEN/);
 await f.repo.saveSettings("alice", f.experienceId, { operationId: "sharing", expectedStructureRevision: 0, allowFollowerInspection: true });
 const shared = new PreparationAssembly(); shared.accept(await prepareFollowers(f.repo, "bob", f.experienceId));
 assert.equal([...shared.values.values()].slice(1).some(value => (value as FollowerPreparationCard).subjectUserId === "bob"), false);
});

test("normal and 100-member preparation is batched, bounded and read-only with exact 600-attachment windows", async () => {
 for (const followerCount of [16, 20, 97]) {
  const f = await groupFixture(client, { cardCount: 6, admins: ["carol", "dave"], followers: ["bob"] });
  await createGroupMediaIndexes(f.cards.db); await createGroupReflectionIndexes(f.cards.db);
  const template = (await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }))!;
  const additional = Array.from({ length: followerCount - 1 }, (_, i) => `player-${i.toString().padStart(3, "0")}`);
  await f.cards.users().insertMany(additional.map(_id => ({ _id, username: _id, cardsData: [], decksData: [] })));
  await f.repo.members().insertMany(additional.map(userId => ({ ...template, _id: undefined, userId })));
  const subjects = ["bob", ...additional];
  await f.cards.db.collection("groupMediaContributions").insertMany(subjects.flatMap(user => f.ids.flatMap((cardTemplateId, i) => Array.from({ length: 5 }, (_, j) => ({
   contributionId: `${user}-${i}-${j}`, operationId: `${user}-${i}-${j}`, experienceId: f.experienceId, cardTemplateId, authorUserId: user, state: "attached", groupVisible: true,
   kind: j === 4 ? "video" : "image", originalFilename: `${user}-${i}-${j}.jpg`, revision: 1, uploadedAt: new Date(1760000000000 + j) })))));
  await f.cards.db.collection("groupReflections").insertMany(subjects.flatMap(user => f.ids.map((cardTemplateId, i) => ({ reflectionId: `${user}-${i}`, authorUserId: user,
   cardTemplateId, experienceId: f.experienceId, text: "Player reflection. ".repeat(100), revision: 1, groupVisible: true, deleted: false, createdAt: new Date() }))));
  const samples = [];
  for (let sample = -1; sample < 3; sample++) {
   const commands: string[] = [], listener = (event: { commandName: string }) => { commands.push(event.commandName); };
   client.on("commandStarted", listener);
   const start = performance.now(), assembly = new PreparationAssembly(); let after: string | undefined, requests = 0, bytes = 0, parseMs = 0;
   try {
    do { const page = await prepareFollowers(f.repo, "alice", f.experienceId, after); const json = JSON.stringify(page); bytes += Buffer.byteLength(json);
     const parseStart = performance.now(); assembly.accept(JSON.parse(json)); parseMs += performance.now() - parseStart;
     after = page.next ?? undefined; requests++;
    } while (after);
   } finally { client.off("commandStarted", listener); }
   const elapsedMs = performance.now() - start;
   assert.equal(assembly.values.size, 1 + followerCount * 6);
   for (const row of [...assembly.values.values()].slice(1) as FollowerPreparationCard[]) { assert.equal(row.media.total, 5); assert.equal(row.media.items.length, 5); assert.equal(row.reflection.items.length, 1); }
   assert.equal(commands.some(command => ["insert", "update", "delete"].includes(command)), false);
   if (sample >= 0) assert.equal(commands.some(command => ["listCollections", "listIndexes"].includes(command)), false);
   assert.ok(requests <= Math.ceil(followerCount * 6 / 128));
   if (sample >= 0) samples.push({ elapsedMs: +elapsedMs.toFixed(2), commands: commands.length, requests, bytes, parseAndAssembleMs: +parseMs.toFixed(2) });
  }
  console.log("CP3_LOCAL_FOLLOWERS", JSON.stringify({ members: followerCount + 3, followers: followerCount, cards: 6, attachments: followerCount * 30, samples }));
 }
});

test("a single oversized reflection spans bounded pages without truncation and changed fragments cannot be combined", async () => {
 const f = await fixture(), text = "🏀\"\nPlayer learning ".repeat(200_000);
 await f.cards.db.collection("groupReflections").updateOne({ authorUserId: "bob", cardTemplateId: f.ids[0] }, { $set: { text } });
 let page = await prepareFollowers(f.repo, "alice", f.experienceId); const assembly = new PreparationAssembly(); assembly.accept(page);
 assert.ok(page.next); assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 2_500_000);
 let fragmentCursor: string | undefined;
 while (page.next) { page = await prepareFollowers(f.repo, "alice", f.experienceId, page.next); assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 2_500_000); assembly.accept(page); if (page.parts.some(part => "text" in part && !part.last)) fragmentCursor = page.next!; }
 assert.ok(fragmentCursor);
 assert.equal((assembly.values.get(1) as FollowerPreparationCard).reflection.items[0].entry.text, text);
 await f.cards.db.collection("groupReflections").updateOne({ authorUserId: "bob", cardTemplateId: f.ids[0] }, { $set: { text: text + " changed" } });
 await assert.rejects(() => prepareFollowers(f.repo, "alice", f.experienceId, fragmentCursor), /GROUP_PREPARATION_CONTENT_CHANGED/);
 await f.repo.changeMember("alice", f.experienceId, { kind: "remove-follower", targetUserId: "carol", operationId: "remove-during-preparation", expectedStructureRevision: 0 });
 await assert.rejects(() => prepareFollowers(f.repo, "alice", f.experienceId, fragmentCursor), /GROUP_SCOPE_CONFLICT/);
});
