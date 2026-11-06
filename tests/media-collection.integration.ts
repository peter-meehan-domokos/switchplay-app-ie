import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { readOwnerMediaPage } from "../src/lib/mediaCollection/ownerHistory";
import { collectionKey } from "../src/lib/mediaCollection/contracts";
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri(), { monitorCommands: true }).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
const image = (id: string, uploadedAt?: string) => ({ id, mediaType: "image", provider: "cloudflare-r2", assetId: `user-cards/test/${id}.jpg`, src: `https://personal.invalid/${id}.jpg`, description: id, ...(uploadedAt ? { uploadedAt } : {}) });
async function fixture() {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1); return f;
}
async function groupItem(f: Awaited<ReturnType<typeof fixture>>, id: string, date: string, origin = f.experienceId, visible = true) {
  await f.cards.db.collection("groupMediaContributions").insertOne({ contributionId: id, operationId: id, authorUserId: "bob", cardTemplateId: f.ids[0], experienceId: origin,
    state: "attached", groupVisible: visible, revision: 2, kind: "image", uploadedAt: new Date(date), asset: { provider: "r2", assetId: `group-media/${id}.jpg`, bucket: "private" } });
}
test("newest five merge Personal and all owned Group origins with exact identity and no membership requirement", async () => {
  const f = await fixture();
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": [image("same", "2026-10-01T10:00:00.000Z"), image("p2", "2026-10-03T10:00:00.000Z"), image("p3", "2026-10-06T10:00:00.000Z")] } });
  for (const [id, day] of [["same", 2], ["g2", 4], ["g3", 5], ["g4", 7], ["g5", 8]] as const) await groupItem(f, id, `2026-10-${String(day).padStart(2, "0")}T10:00:00.000Z`, id === "g2" ? "left-group" : f.experienceId, id !== "g3");
  await f.repo.members().deleteOne({ experienceId: f.experienceId, userId: "bob" });
  const page = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 5 });
  assert.equal(page.total, 8); assert.equal(page.olderCount, 3);
  assert.deepEqual(page.items.map(i => i.description), ["Group image", "Group image", "p3", "Group image", "Group image"]);
  assert.equal(new Set(page.items.map(collectionKey)).size, 5); assert.equal(page.items[0].source.kind, "group");
  const older = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 5, cursor: page.older! });
  assert.equal(older.items.length, 3); assert.equal(older.older, null);
  assert.ok(older.newer); assert.equal(new Set([...page.items, ...older.items].map(collectionKey)).size, 8);
  assert.deepEqual((await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 5, cursor: older.newer! })).items.map(collectionKey), page.items.map(collectionKey));
});
test("legacy undated ordering, live personal source chain and bounded projection preserve actual history", async () => {
  const f = await fixture();
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": [image("old1"), image("old2"), image("new", "2026-10-01T00:00:00.000Z")], "cardsData.0.historySourceCardTemplateId": "source" } });
  await f.cards.users().updateOne({ _id: "bob" }, { $push: { cardsData: { cardTemplateId: "source", mediaItems: [image("inherited")], reflection: "PRIVATE_SENTINEL", tests: [] } as never } });
  const page = await readOwnerMediaPage(f.cards, "bob", f.ids[0]);
  assert.deepEqual(page.items.map(i => i.description), ["old1", "old2", "inherited", "new"]);
  assert.equal(page.items[2].source.kind, "personal"); assert.ok(!JSON.stringify(page).includes("PRIVATE_SENTINEL"));
  await f.cards.users().updateOne({ _id: "bob" }, { $push: { "cardsData.$[card].mediaItems": image("later-source") } }, { arrayFilters: [{ "card.cardTemplateId": "source" }] });
  assert.equal((await readOwnerMediaPage(f.cards, "bob", f.ids[0])).total, 5);
});
test("context-bound cursors and optional Personal data do not widen foreign Group access", async () => {
  const f = await fixture(); for (let i = 0; i < 6; i++) await groupItem(f, `g${i}`, `2026-10-0${i + 1}T00:00:00.000Z`);
  const page = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 5 });
  await assert.rejects(readOwnerMediaPage(f.cards, "carol", f.ids[0], { cursor: page.older! }), { code: "INVALID_MEDIA_CURSOR" });
  await assert.rejects(readOwnerMediaPage(f.cards, "bob", f.ids[0], { experienceId: "forged-group" }), { code: "GROUP_FORBIDDEN" });
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { cardsData: [] } });
  assert.equal((await readOwnerMediaPage(f.cards, "bob", f.ids[0])).total, 6);
  assert.equal((await readOwnerMediaPage(f.cards, "alice", f.ids[0])).total, 0);
});

test("10,000 Group contributions and 10,000 Personal references return a bounded newest page", async () => {
  const f = await fixture(), date = "2026-10-20T00:00:00.000Z";
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": Array.from({ length: 10000 }, (_, i) => image(`p${String(i).padStart(5, "0")}`, date)) } });
  await f.cards.db.collection("groupMediaContributions").insertMany(Array.from({ length: 10000 }, (_, i) => ({ contributionId: `g${String(i).padStart(5, "0")}`, operationId: `bulk-${i}`, authorUserId: "bob", cardTemplateId: f.ids[0], experienceId: f.experienceId, state: "attached", groupVisible: true, revision: 2, kind: "image", uploadedAt: new Date(date) })));
  const page = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 5 });
  assert.equal(page.total, 20000); assert.equal(page.items.length, 5); assert.equal(page.start, 19995);
  assert.ok(JSON.stringify(page).length < 12000); assert.ok(page.items.every(i => i.source.kind === "personal"));
  const next = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 30, cursor: page.older! });
  assert.equal(next.items.length, 30); assert.equal(next.start, 19965);
});
test("Personal-only deployments need no Group collections; malformed records do not inflate totals", async () => {
  const f = await fixture(); await f.cards.db.collection("groupMediaContributions").drop();
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": [image("valid"), { ...image("bad"), assetId: null }, { ...image("bad2"), provider: null }, image("valid")] } });
  const page = await readOwnerMediaPage(f.cards, "bob", f.ids[0]);
  assert.equal(page.total, 1); assert.equal(page.items[0].description, "valid");
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": image("not-an-array") as never } });
  assert.equal((await readOwnerMediaPage(f.cards, "bob", f.ids[0])).total, 0);
  assert.equal(await f.cards.db.listCollections({ name: "groupMediaContributions" }).hasNext(), false);
});
test("own Group history marks other origins, hidden and Personal items Private without changing ownership", async () => {
  const f = await fixture();
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": [image("personal")] } });
  await groupItem(f, "shared", "2026-10-01T00:00:00.000Z"); await groupItem(f, "hidden", "2026-10-02T00:00:00.000Z", f.experienceId, false); await groupItem(f, "other", "2026-10-03T00:00:00.000Z", "Galway-U14");
  const page = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { experienceId: f.experienceId });
  assert.deepEqual(page.items.map(i => i.private), [true, false, true, true]); assert.ok(page.items.every(i => i.authorUserId === "bob"));
});
test("new Personal timestamps are server owned and immutable through duplicate attachment retries", async () => {
  const f = await fixture(), supplied = image("new", "1999-01-01T00:00:00.000Z");
  const before = Date.now(); const first = await f.cards.mutateMedia("bob", f.deckId, f.ids[0], { append: supplied as never }, v => v as never);
  const timestamp = first[0].uploadedAt!; assert.ok(Date.parse(timestamp) >= before);
  const retried = await f.cards.mutateMedia("bob", f.deckId, f.ids[0], { append: supplied as never }, v => v as never);
  assert.equal(retried[0].uploadedAt, timestamp); assert.equal(retried.length, 1);
});

test("refresh anchors preserve gallery selection across new uploads, with adjacent newer and older pages", async () => {
  const f = await fixture();
  for (let n = 1; n <= 8; n++) await groupItem(f, `photo-${n}`, `2026-10-0${n}T00:00:00.000Z`);
  const first = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 5 });
  await groupItem(f, "new-photo", "2026-10-09T00:00:00.000Z");
  const refresh = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 5, cursor: first.refresh! });
  assert.deepEqual(refresh.items.map(collectionKey), first.items.map(collectionKey)); assert.equal(refresh.total, 9);
  assert.equal((await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 5, cursor: refresh.newer! })).items.length, 1);
  const { GroupMediaRepository } = await import("../src/lib/groupExperiences/media/repository");
  const media = new GroupMediaRepository(f.repo), group = await media.groupFeed("alice", f.experienceId, f.ids[0], { limit: 5 });
  await groupItem(f, "latest-photo", "2026-10-10T00:00:00.000Z");
  const same = await media.groupFeed("alice", f.experienceId, f.ids[0], { limit: 5, after: group.refresh! });
  assert.deepEqual(same.items.map(i => i.contributionId), group.items.map(i => i.contributionId));
  const newer = await media.groupFeed("alice", f.experienceId, f.ids[0], { limit: 5, before: same.previous! });
  assert.deepEqual(newer.items.map(i => i.contributionId), ["latest-photo"]);
});
test("equal-date identifiers use Mongo byte ordering and cursor values remain literal", async () => {
  const f = await fixture(), ids = ["$existing", "a", "\uE000", "😀"];
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": ids.map(id => image(id, "2026-10-01T00:00:00.000Z")) } });
  let p = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 1 }); const seen: string[] = [];
  for (;;) { seen.push(p.items[0].description); if (!p.older) break; p = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 1, cursor: p.older }); }
  assert.deepEqual(seen, [...ids].reverse());
  assert.equal((await readOwnerMediaPage(f.cards, "bob", f.ids[0], { limit: 1, cursor: p.newer! })).items[0].description, "a");
});

test("unified metadata retains original image and video filenames and immutable origins after hiding", async () => {
  const f = await fixture();
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": [
    { ...image("personal-image"), originalFilename: "shooting-drill.jpg" },
    { id: "personal-video", mediaType: "video", provider: "cloudflare-stream", assetId: "stream-id", src: "https://video.invalid", description: "Video", originalFilename: "defensive-positioning.mp4" }, image("legacy"),
  ] } });
  await groupItem(f, "group-original", "2026-10-01T00:00:00.000Z");
  await f.cards.db.collection("groupMediaContributions").updateOne({ contributionId: "group-original" }, { $set: { originalFilename: "footwork-practice.jpg" } });
  const before = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { experienceId: f.experienceId });
  assert.equal(before.items.find(i => i.source.kind === "personal" && i.source.mediaItemId === "personal-image")!.originalFilename, "shooting-drill.jpg");
  assert.equal(before.items.find(i => i.mediaType === "video")!.originalFilename, "defensive-positioning.mp4");
  assert.equal(before.items.find(i => i.description === "legacy")!.originalFilename, undefined);
  await f.cards.db.collection("groupMediaContributions").updateOne({ contributionId: "group-original" }, { $set: { groupVisible: false } });
  const after = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { experienceId: f.experienceId });
  const original = before.items.find(i => i.source.kind === "group")!, hidden = after.items.find(i => i.source.kind === "group")!;
  assert.equal(hidden.originalFilename, "footwork-practice.jpg"); assert.equal(hidden.originName, original.originName); assert.ok(hidden.originName);
  assert.equal(original.private, false); assert.equal(hidden.private, true);
});


test("warm owner history reuses positive Group schema readiness without repeated metadata commands", async () => {
  const f = await fixture(); await readOwnerMediaPage(f.cards, "bob", f.ids[0]);
  const metadata: string[] = [];
  const listener = (event: { commandName: string }) => { if (["listCollections", "listIndexes"].includes(event.commandName)) metadata.push(event.commandName); };
  client.on("commandStarted", listener);
  try { await readOwnerMediaPage(f.cards, "bob", f.ids[0]); }
  finally { client.off("commandStarted", listener); }
  assert.deepEqual(metadata, []);
});
