import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient, type Filter, type FindOptions } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, publishGroupDeck, reviewedUpdate } from "./helpers/groupExperiences";
import { GroupMediaRepository } from "../src/lib/groupExperiences/media/repository";
import { createGroupMediaIndexes } from "../src/lib/groupExperiences/media/indexes";
import type { GroupMediaProvider, GroupMediaRecord } from "../src/lib/groupExperiences/media/model";
import { authorizeProtectedMedia, authorizeCardPlayback } from "../src/lib/cards/protectedMedia";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { assertNotInfoMedia } from "../src/lib/infoCards/mediaRegistry";
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { process.env.SESSION_SECRET = "disposable-phase6-test-secret"; mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
async function fixture() {
  const f = await groupFixture(client); await createGroupMediaIndexes(f.cards.db);
  const calls = { allocate: 0, status: 0, delete: 0, deliver: 0 };
  const provider: GroupMediaProvider = {
    checkConfiguration() {},
    async allocate(row) { calls.allocate++; return { asset: row.kind === "image" ? { provider: "r2", assetId: `group-media/${row.contributionId}.jpg`, bucket: "path-user-data" } : { provider: "stream", assetId: randomUUID().replaceAll("-", "") }, uploadURL: "https://upload.example.test/only", headers: {} }; },
    async status() { calls.status++; return { status: "ready" }; },
    async remove() { calls.delete++; },
    async deliver() { calls.deliver++; return Response.json({ grant: "signed-only" }); },
  };
  const media = new GroupMediaRepository(f.repo, provider);
  const mediaCommand = (changes = {}) => ({ operationId: randomUUID(), accessEpoch: 0, version: 1, kind: "image", contentType: "image/jpeg", size: 100, creationContext: "self", ...changes });
  // alice is the Group admin (not a follower), so her uploads are made from the Group perspective.
  const allocate = (actor = "bob", changes = {}, experienceId = f.experienceId) => media.allocate(actor, experienceId, f.ids[0], mediaCommand({ creationContext: actor === "alice" ? "group" : "self", ...changes }));
  const attach = async (actor = "bob", changes = {}, experienceId = f.experienceId) => {
    const allocation = await allocate(actor, changes, experienceId);
    return media.commit(actor, experienceId, f.ids[0], allocation.contributionId, { expectedRevision: allocation.revision, proof: allocation.proof });
  };
  const changeFollower = async (kind: "remove-follower" | "add-follower") => {
    const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
    await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: e.structureRevision, targetUserId: "bob", kind });
  };
  const removeFollower = () => changeFollower("remove-follower"), rejoin = () => changeFollower("add-follower");
  // Delete in the creation context of bob's Follower contributions: Me of the originating Group (C1).
  const deleteFromMe = async (contributionId: string, expectedRevision: number) => media.delete("bob", contributionId, { expectedRevision },
    { experienceId: f.experienceId, accessEpoch: (await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }))!.accessEpoch, perspective: "self" });
  return { ...f, creationCommand: f.command, media, provider, calls, mediaCommand, allocate, attach, removeFollower, rejoin, deleteFromMe };
}

test("allocation retries reserve one asset, trusted origin, no personal data; attachment is idempotent", async () => {
  const f = await fixture(), before = JSON.stringify(await f.cards.users().find({}).toArray()), cmd = f.mediaCommand();
  const a = await f.media.allocate("bob", f.experienceId, f.ids[0], cmd);
  const retry = await f.media.allocate("bob", f.experienceId, f.ids[0], cmd);
  assert.equal(a.contributionId, retry.contributionId); assert.equal(f.calls.allocate, 1);
  await assert.rejects(f.media.allocate("bob", f.experienceId, f.ids[0], { ...cmd, size: 101 }), { code: "GROUP_MEDIA_OPERATION_CONFLICT" });
  const saved = await f.media.commit("bob", f.experienceId, f.ids[0], a.contributionId, { expectedRevision: a.revision, proof: a.proof });
  const replay = await f.media.commit("bob", f.experienceId, f.ids[0], a.contributionId, { expectedRevision: a.revision, proof: a.proof });
  assert.deepEqual(saved, replay);
  const recovered = await f.media.allocate("bob", f.experienceId, f.ids[0], cmd);
  assert.equal(recovered.state, "attached"); assert.equal(recovered.uploadURL, undefined); assert.equal(f.calls.allocate, 1);
  assert.equal(saved.authorUserId, "bob"); assert.equal(saved.experienceId, f.experienceId);
  assert.equal(saved.cardTemplateId, f.ids[0]); assert.ok(saved.uploadedAt); assert.equal(saved.groupVisible, true);
  assert.deepEqual((await f.media.records().findOne({ contributionId: saved.contributionId }))!.asset,
    { provider: "r2", bucket: "path-user-data", assetId: `group-media/${saved.contributionId}.jpg` });
  assert.equal(JSON.stringify(await f.cards.users().find({}).toArray()), before);
});

test("owner history spans Groups without membership or personal CardData; Group feeds remain exact", async () => {
  const f = await fixture(); const other = await f.repo.create("alice", { ...f.creationCommand, operationId: "second", name: "Galway U14" });
  const first = await f.attach(), second = await f.attach("bob", {}, other.experienceId);
  const admin = await f.attach("alice");
  assert.equal((await f.cards.getPersonalUser("alice"))!.cardsData.length, 0);
  // Checkpoint 4.0: an Admin contribution belongs to its Group only and never joins the author's owner history.
  assert.deepEqual((await f.media.ownerFeed("alice", f.ids[0])).items, []);
  assert.ok((await f.media.groupFeed("alice", f.experienceId, f.ids[0])).items.some(item => item.contributionId === admin.contributionId));
  await f.removeFollower();
  // Retained origin identity has no effect on owner history access.
  await f.repo.experiences().updateOne({ experienceId: f.experienceId }, { $set: { name: "Archived Galway U18" } });
  const own = await f.media.ownerFeed("bob", f.ids[0]);
  assert.deepEqual(new Set(own.items.map(r => r.contributionId)), new Set([first.contributionId, second.contributionId]));
  assert.equal((await f.media.groupFeed("carol", other.experienceId, f.ids[0])).items.length, 1);
  assert.equal((await f.media.groupFeed("carol", f.experienceId, f.ids[0])).items.length, 2);
  await assert.rejects(f.media.groupFeed("bob", f.experienceId, f.ids[0]), { code: "GROUP_FORBIDDEN" });

});

// Checkpoint 4.2b (C1, C4): after leaving, the creator still reads their contribution but deletes it only once they
// have rejoined, from Me of its Group; the standalone Card (owner route) never deletes an attached contribution.
test("hide is visibility only; creator can read after removal and delete after rejoining; application Admin cannot delete", async () => {
  const f = await fixture(), row = await f.attach();
  const originalAsset = (await f.media.records().findOne({ contributionId: row.contributionId }))!.asset;
  await assert.rejects(f.media.delete("outsider", row.contributionId, { expectedRevision: row.revision }), { code: "GROUP_MEDIA_FORBIDDEN" });
  await assert.rejects(f.media.delete("alice", row.contributionId, { expectedRevision: row.revision }), { code: "GROUP_MEDIA_FORBIDDEN" });
  const hidden = await f.media.hide("alice", f.experienceId, row.contributionId, { expectedRevision: row.revision, accessEpoch: 0 });
  assert.deepEqual((await f.media.records().findOne({ contributionId: row.contributionId }))!.asset, originalAsset);
  assert.equal(f.calls.delete, 0); assert.equal((await f.media.groupFeed("carol", f.experienceId, f.ids[0])).items.length, 0);
  assert.equal((await f.media.ownerFeed("bob", f.ids[0])).items[0].groupVisible, false);
  await assert.rejects(f.media.deliver("carol", row.contributionId, { kind: "group", experienceId: f.experienceId }, "playback"), { code: "GROUP_MEDIA_FORBIDDEN" });
  await f.removeFollower(); await f.media.deliver("bob", row.contributionId, { kind: "owner" }, "playback");
  await assert.rejects(f.media.delete("bob", row.contributionId, { expectedRevision: hidden.revision }), { code: "GROUP_MEDIA_FORBIDDEN" });
  await assert.rejects(f.deleteFromMe(row.contributionId, hidden.revision), { code: "GROUP_FORBIDDEN" });
  assert.equal(f.calls.delete, 0);
  await f.rejoin();
  const gone = await f.deleteFromMe(row.contributionId, hidden.revision);
  assert.equal(gone.state, "deleted"); assert.equal(gone.cleanup, "succeeded"); assert.equal(f.calls.delete, 1);
  assert.equal((await f.media.ownerFeed("bob", f.ids[0])).items.length, 0);
});

test("removal during provider readiness blocks attachment, rejoin does not revive captured epoch", async () => {
  const f = await fixture(), a = await f.allocate();
  f.provider.status = async () => { await f.removeFollower(); return { status: "ready" }; };
  await assert.rejects(f.media.commit("bob", f.experienceId, f.ids[0], a.contributionId, { expectedRevision: a.revision, proof: a.proof }), { code: "GROUP_FORBIDDEN" });
  await f.repo.changeMember("alice", f.experienceId, { operationId: "rejoin", expectedStructureRevision: 1, targetUserId: "bob", kind: "add-follower" });
  f.provider.status = async () => ({ status: "ready" });
  await assert.rejects(f.media.commit("bob", f.experienceId, f.ids[0], a.contributionId, { expectedRevision: a.revision, proof: a.proof }), { code: "GROUP_ACCESS_CONFLICT" });
  assert.equal((await f.media.ownerFeed("bob", f.ids[0])).items.length, 0);
});

test("creator deletion during readiness is terminal; provider cleanup failure is retryable", async () => {
  const f = await fixture(), a = await f.allocate();
  f.provider.remove = async () => { f.calls.delete++; throw Error("timeout"); };
  f.provider.status = async () => { await f.media.delete("bob", a.contributionId, { expectedRevision: a.revision }); return { status: "ready" }; };
  await assert.rejects(f.media.commit("bob", f.experienceId, f.ids[0], a.contributionId, { expectedRevision: a.revision, proof: a.proof }), { code: "GROUP_MEDIA_DELETED_CONFLICT" });
  const stored = await f.media.records().findOne({ contributionId: a.contributionId }); assert.equal(stored!.cleanup, "failed");
  assert.equal(stored!.state, "deleted"); assert.equal(stored!.uploadURL, undefined);
  f.provider.remove = async () => { f.calls.delete++; };
  assert.equal((await f.media.delete("bob", a.contributionId, { expectedRevision: 0 })).cleanup, "succeeded");
  assert.equal(f.calls.delete, 2);
});

test("proof binds actor, Group, Card and allocation; client metadata cannot override trusted fields", async () => {
  const f = await fixture(), a = await f.allocate(), b = await f.allocate("carol");
  const cmd = { expectedRevision: a.revision, proof: a.proof };
  await assert.rejects(f.media.commit("carol", f.experienceId, f.ids[0], b.contributionId, cmd), { code: "GROUP_MEDIA_PROOF_FORBIDDEN" });
  await assert.rejects(f.media.commit("bob", f.experienceId, f.ids[1], a.contributionId, cmd), { code: "GROUP_MEDIA_FORBIDDEN" });
  await assert.rejects(f.media.commit("bob", f.experienceId, f.ids[0], a.contributionId, { ...cmd, uploadedAt: "2000-01-01" }), { code: "INVALID_GROUP_FIELDS" });
  await assert.rejects(f.allocate("bob", { authorUserId: "alice" }), { code: "INVALID_GROUP_FIELDS" });
});

test("selected scope is rechecked after upload; retained owner access survives removal of Card", async () => {
  const f = await fixture(), attached = await f.attach(), pending = await f.allocate();
  await publishGroupDeck(f, [f.ids[1]]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  await assert.rejects(f.media.commit("bob", f.experienceId, f.ids[0], pending.contributionId, { expectedRevision: pending.revision, proof: pending.proof }), { code: "GROUP_CARD_FORBIDDEN" });
  assert.equal((await f.media.ownerFeed("bob", f.ids[0])).items[0].contributionId, attached.contributionId);
  await assert.rejects(f.media.groupFeed("carol", f.experienceId, f.ids[0]), { code: "GROUP_CARD_FORBIDDEN" });
});

test("reserved Stream identities cannot escape via legacy endpoints even after deletion or hex casing", async () => {
  const f = await fixture(), a = await f.allocate("bob", { kind: "video", contentType: "video/mp4" });
  const row = (await f.media.records().findOne({ contributionId: a.contributionId })) as GroupMediaRecord;
  await assert.rejects(assertNotInfoMedia(f.cards.db, "stream", row.asset!.assetId.toUpperCase()), { code: "MEDIA_FORBIDDEN" });
  await f.media.delete("bob", a.contributionId, { expectedRevision: a.revision });
  await assert.rejects(assertNotInfoMedia(f.cards.db, "stream", row.asset!.assetId), { code: "MEDIA_FORBIDDEN" });
});

test("uncertain Stream allocation is never blindly repeated and parallel retries cannot allocate twice", async () => {
  const f = await fixture(), cmd = f.mediaCommand({ kind: "video", contentType: "video/mp4" });
  f.provider.allocate = async () => { f.calls.allocate++; throw Error("lost provider response"); };
  await assert.rejects(f.media.allocate("bob", f.experienceId, f.ids[0], cmd), { code: "GROUP_MEDIA_ALLOCATION_UNCERTAIN" });
  await assert.rejects(f.media.allocate("bob", f.experienceId, f.ids[0], cmd), { code: "GROUP_MEDIA_ALLOCATION_UNCERTAIN" });
  assert.equal(f.calls.allocate, 1); assert.equal(await f.media.records().countDocuments(), 1);
  const record = (await f.media.records().findOne({}))!;
  assert.equal(record.allocation, "uncertain");
  await f.removeFollower();
  const status = await f.media.status("bob", record.contributionId, { kind: "owner" });
  assert.equal(status.status, "allocation-uncertain"); assert.equal(status.revision, 0);
  assert.equal((await f.media.delete("bob", record.contributionId, { expectedRevision: status.revision })).state, "deleted");
});

test("provider result arriving after creator deletion is reserved only for cleanup", async () => {
  const f = await fixture(), original = f.provider.allocate;
  f.provider.allocate = async row => {
    await f.media.delete("bob", row.contributionId, { expectedRevision: 0 });
    return original(row);
  };
  await assert.rejects(f.allocate(), { code: "GROUP_MEDIA_DELETED_CONFLICT" });
  const stored = (await f.media.records().findOne({}))!;
  assert.equal(stored.state, "deleted"); assert.equal(stored.cleanup, "succeeded"); assert.equal(stored.uploadURL, undefined);
  assert.equal(f.calls.delete, 1); assert.equal((await f.media.ownerFeed("bob", f.ids[0])).total, 0);
});

test("Group delivery rechecks hiding and viewer revocation after a slow provider call", async () => {
  const f = await fixture(), row = await f.attach();
  f.provider.deliver = async () => { await f.media.hide("alice", f.experienceId, row.contributionId, { expectedRevision: row.revision, accessEpoch: 0 }); return Response.json({ secret: true }); };
  await assert.rejects(f.media.deliver("carol", row.contributionId, { kind: "group", experienceId: f.experienceId }, "playback"), { code: "GROUP_MEDIA_FORBIDDEN" });
  const own = await f.media.ownerFeed("bob", f.ids[0]); assert.equal(own.items.length, 1);
  const second = await f.attach();
  f.provider.deliver = async () => { await f.removeFollower(); return Response.json({ secret: true }); };
  await assert.rejects(f.media.deliver("bob", second.contributionId, { kind: "group", experienceId: f.experienceId }, "playback"), { code: "GROUP_FORBIDDEN" });
});

test("authorised inspection obeys peer policy and never exposes hidden private rows or upload secrets", async () => {
  const f = await fixture(), visible = await f.attach(), hidden = await f.attach();
  await f.media.hide("alice", f.experienceId, hidden.contributionId, { expectedRevision: hidden.revision, accessEpoch: 0 });
  await assert.rejects(f.media.groupFeed("carol", f.experienceId, f.ids[0], { subjectUserId: "bob" }), { code: "GROUP_MEDIA_FORBIDDEN" });
  const admin = await f.media.groupFeed("alice", f.experienceId, f.ids[0], { subjectUserId: "bob" });
  assert.equal(admin.items.length, 1); assert.equal(admin.items[0].contributionId, visible.contributionId);
  for (const field of ["uploadURL", "assetId", "bucket", "operationHash", "proof", "uploadHeaders", hidden.contributionId]) assert.ok(!JSON.stringify(admin).includes(field));
  await f.repo.experiences().updateOne({ experienceId: f.experienceId }, { $set: { allowFollowerInspection: true } });
  assert.equal((await f.media.groupFeed("carol", f.experienceId, f.ids[0], { subjectUserId: "bob" })).items.length, 1);
  await f.removeFollower();
  await assert.rejects(f.media.groupFeed("carol", f.experienceId, f.ids[0], { subjectUserId: "bob" }), { code: "GROUP_MEDIA_FORBIDDEN" });
  assert.equal((await f.media.groupFeed("carol", f.experienceId, f.ids[0])).items.length, 1); // Visible former author remains.
});

test("bounded owner/Group pages use indexes; cursors cannot cross viewer or Group identities", async () => {
  const f = await fixture(); for (let i = 0; i < 4; i++) await f.attach();
  const first = await f.media.ownerFeed("bob", f.ids[0], { limit: 2 });
  const second = await f.media.ownerFeed("bob", f.ids[0], { limit: 2, after: first.next! });
  assert.equal(first.total, 4); assert.equal(second.next, null);
  assert.equal(new Set([...first.items, ...second.items].map(r => r.contributionId)).size, 4);
  await assert.rejects(f.media.ownerFeed("carol", f.ids[0], { after: first.next! }), { code: "INVALID_GROUP_MEDIA_PAGE" });
  await assert.rejects(f.media.ownerFeed("bob", f.ids[0], { limit: 31 }), { code: "INVALID_GROUP_MEDIA_PAGE" });
  for (const [filter, index] of [
    [{ authorUserId: "bob", cardTemplateId: f.ids[0], state: "attached", creationContext: { $ne: "group" } }, "group_media_owner_history"],
    [{ experienceId: f.experienceId, cardTemplateId: f.ids[0], state: "attached", groupVisible: true }, "group_media_shared_history"],
  ] as const) {
    const plan = await f.media.records().find(filter).sort({ uploadedAt: -1, contributionId: -1 }).limit(31).explain("executionStats");
    assert.ok(JSON.stringify(plan.queryPlanner.winningPlan).includes(index));
    assert.ok(!JSON.stringify(plan.queryPlanner.winningPlan).includes('"stage":"COLLSCAN"'));
  }
});

test("foreign query projects only allowed metadata; owner history does not consult memberships", async t => {
  const f = await fixture(), row = await f.attach();
  const collection = f.media.records(), find = collection.find.bind(collection);
  const calls: { filter: unknown; options: unknown }[] = [];
  t.mock.method(collection, "find", (filter: Filter<GroupMediaRecord>, options: FindOptions) => { calls.push({ filter, options }); return find(filter, options); });
  t.mock.method(f.media, "records", () => collection);
  await f.media.groupFeed("alice", f.experienceId, f.ids[0], { subjectUserId: "bob" });
  assert.deepEqual(calls[0].filter, { cardTemplateId: f.ids[0], state: "attached", experienceId: f.experienceId, groupVisible: true, authorUserId: "bob", creationContext: { $ne: "group" } });
  assert.deepEqual((calls[0].options as { projection: object }).projection, { _id: 0, contributionId: 1, authorUserId: 1, experienceId: 1, cardTemplateId: 1, kind: 1, originalFilename: 1, uploadedAt: 1, revision: 1, groupVisible: 1, creationContext: 1 });
  t.mock.method(f.repo, "members", () => { throw Error("owner history must not join membership"); });
  assert.equal((await f.media.ownerFeed("bob", f.ids[0])).items[0].contributionId, row.contributionId);
});

test("cleanup remains pending while upload permission is live; repeated deletion drains it after expiry", async () => {
  const f = await fixture(), a = await f.allocate();
  await f.media.records().updateOne({ contributionId: a.contributionId }, { $set: { uploadExpiresAt: new Date(Date.now() + 300000) } });
  assert.equal((await f.media.delete("bob", a.contributionId, { expectedRevision: a.revision })).cleanup, "pending");
  await f.media.records().updateOne({ contributionId: a.contributionId }, { $set: { uploadExpiresAt: new Date(0) } });
  assert.equal((await f.media.delete("bob", a.contributionId, { expectedRevision: a.revision })).cleanup, "succeeded");
});

test("attachment versus removal and hide versus delete preserve one serial outcome", async () => {
  const f = await fixture(), a = await f.allocate();
  const outcomes = await Promise.allSettled([
    f.media.commit("bob", f.experienceId, f.ids[0], a.contributionId, { expectedRevision: a.revision, proof: a.proof }),
    f.removeFollower(),
  ]);
  assert.equal(outcomes[1].status, "fulfilled");
  const row = (await f.media.records().findOne({ contributionId: a.contributionId }))!;
  assert.ok(row.state === "pending" || row.state === "attached");
  if (outcomes[0].status === "fulfilled") assert.equal(row.state, "attached"); else assert.equal(row.state, "pending");
  const second = await f.attach("alice");
  await Promise.allSettled([
    f.media.hide("alice", f.experienceId, second.contributionId, { expectedRevision: second.revision, accessEpoch: 0 }),
    f.media.delete("alice", second.contributionId, { expectedRevision: second.revision }, { experienceId: f.experienceId, accessEpoch: 0, perspective: "group" }),
  ]);
  const after = (await f.media.records().findOne({ contributionId: second.contributionId }))!;
  assert.equal(after.groupVisible, false);
  if (after.state === "attached") await f.media.delete("alice", after.contributionId, { expectedRevision: after.revision }, { experienceId: f.experienceId, accessEpoch: 0, perspective: "group" });
  await assert.rejects(f.media.hide("alice", f.experienceId, second.contributionId, { expectedRevision: second.revision, accessEpoch: 0 }), { code: "GROUP_MEDIA_FORBIDDEN" });
});

test("Group assets cannot be attached to personal or canonical Cards/Decks or served by generic grants", async () => {
  const f = await fixture(), a = await f.allocate("bob", { kind: "video", contentType: "video/mp4" });
  const row = (await f.media.records().findOne({ contributionId: a.contributionId }))!;
  const item = { id: "transplant", assetId: row.asset!.assetId, provider: "cloudflare-stream" as const, mediaType: "video" as const,
    src: `https://iframe.videodelivery.net/${row.asset!.assetId}`, description: "Group asset" };
  await f.cards.ensureDeckData("bob", f.deckId, 1);
  await assert.rejects(f.cards.mutateMedia("bob", f.deckId, f.ids[0], { append: item }, () => item), { code: "MEDIA_FORBIDDEN" });
  await assert.rejects(f.cards.createCardDraft("bob", { ...createDefaultCardContent(["x", "y", "z"]), mediaItem: item }), { code: "MEDIA_FORBIDDEN" });
  const deck = createDefaultDeckContent([]);
  await assert.rejects(f.cards.createDeckDraft("bob", { ...deck, introduction: { image: null, video: item } }), { code: "MEDIA_FORBIDDEN" });
  const root = (await f.cards.cards().findOne({ cardTemplateId: f.ids[0] }))!, version = (await f.cards.getCardVersion(f.ids[0], 1))!;
  await assert.rejects(f.cards.saveCardDraft("creator", f.ids[0], root.revision, { ...version.content, mediaItem: item }), { code: "MEDIA_FORBIDDEN" });
  // Even a legacy/corrupt unrelated reference cannot grant these reserved bytes.
  await f.cards.cardVersions().updateOne({ cardTemplateId: f.ids[0], version: 1 }, { $set: { "content.mediaItem": item } });
  await assert.rejects(authorizeProtectedMedia(f.cards, "bob", "stream", row.asset!.assetId.toUpperCase()), { code: "MEDIA_FORBIDDEN" });
  await assert.rejects(authorizeCardPlayback(f.cards, "bob", { cardTemplateId: f.ids[0], version: 1, mode: "canonical" }, row.asset!.assetId), { code: "MEDIA_FORBIDDEN" });
  for (const value of [`https://alias.invalid/group-media/${a.contributionId}.jpg`, `https://alias.invalid/%67roup-media%2F${a.contributionId}.jpg`, `/api/group-media/${a.contributionId}`])
    await assert.rejects(assertNotInfoMedia(f.cards.db, "r2", value), { code: "MEDIA_FORBIDDEN" });
});

test("parallel allocation retries reuse a reservation and only one provider call", async () => {
  const f = await fixture(), cmd = f.mediaCommand();
  const results = await Promise.allSettled([f.media.allocate("bob", f.experienceId, f.ids[0], cmd), f.media.allocate("bob", f.experienceId, f.ids[0], cmd)]);
  assert.ok(results.some(r => r.status === "fulfilled")); assert.equal(f.calls.allocate, 1); assert.equal(await f.media.records().countDocuments(), 1);
  const final = await f.media.allocate("bob", f.experienceId, f.ids[0], cmd);
  assert.equal(final.state, "pending"); assert.equal(f.calls.allocate, 1);
});

test("cleanup acknowledgement failure cannot turn successful logical deletion into failure", async t => {
  const f = await fixture(), attached = await f.attach(), collection = f.media.records(), update = collection.updateOne.bind(collection);
  t.mock.method(collection, "updateOne", async (...args: Parameters<typeof update>) => {
    if ((args[0] as { cleanup?: unknown }).cleanup) throw Error("lost cleanup acknowledgement");
    return update(...args);
  });
  t.mock.method(f.media, "records", () => collection);
  const result = await f.deleteFromMe(attached.contributionId, attached.revision);
  assert.equal(result.state, "deleted"); assert.equal(result.cleanup, "pending");
  assert.equal((await f.media.ownerFeed("bob", f.ids[0])).total, 0);
});

test("original filenames survive image/video attachment and hiding; legacy allocations remain valid", async () => {
  const f = await fixture();
  for (const kind of ["image", "video"] as const) {
    const filename = kind === "image" ? "footwork-practice.jpg" : "defensive-positioning.mp4";
    const cmd = f.mediaCommand({ kind, contentType: kind === "image" ? "image/jpeg" : "video/mp4", originalFilename: filename });
    const a = await f.media.allocate("bob", f.experienceId, f.ids[0], cmd);
    await assert.rejects(f.media.allocate("bob", f.experienceId, f.ids[0], { ...cmd, originalFilename: "different.jpg" }), { code: "GROUP_MEDIA_OPERATION_CONFLICT" });
    const saved = await f.media.commit("bob", f.experienceId, f.ids[0], a.contributionId, { expectedRevision: a.revision, proof: a.proof });
    assert.equal(saved.originalFilename, filename);
    await f.media.hide("alice", f.experienceId, saved.contributionId, { expectedRevision: saved.revision, accessEpoch: 0 });
    const owner = (await f.media.ownerFeed("bob", f.ids[0])).items.find(i => i.contributionId === saved.contributionId)!;
    assert.equal(owner.originalFilename, filename); assert.equal(owner.experienceId, f.experienceId);
    assert.equal(owner.groupVisible, false); assert.ok(owner.originName);
  }
  const legacy = await f.attach(); assert.equal(legacy.originalFilename, undefined);
  await assert.rejects(f.allocate("bob", { originalFilename: "../private.jpg" }), { code: "INVALID_GROUP_MEDIA_FILENAME" });
});

test("Group-context creator deletion requires matching origin and live membership; leaving ends deletion until rejoining", async () => {
  const f = await fixture();
  const other = await f.repo.create("alice", { ...f.creationCommand, operationId: "other-media-origin", name: "Galway development" });
  const own = await f.attach(), foreign = await f.attach("bob", {}, other.experienceId);
  await assert.rejects(f.media.delete("bob", foreign.contributionId, { expectedRevision: foreign.revision }, { experienceId: f.experienceId, accessEpoch: 0, perspective: "self" as const }), { code: "GROUP_MEDIA_FORBIDDEN" });
  await f.media.hide("alice", f.experienceId, own.contributionId, { expectedRevision: own.revision, accessEpoch: 0 });
  const hidden = await f.media.records().findOne({ contributionId: own.contributionId });
  await assert.rejects(f.media.delete("bob", own.contributionId, { expectedRevision: hidden!.revision }, { experienceId: f.experienceId, accessEpoch: 99, perspective: "self" as const }));
  assert.equal((await f.media.records().findOne({ contributionId: own.contributionId }))!.state, "attached");
  await f.media.delete("bob", own.contributionId, { expectedRevision: hidden!.revision }, { experienceId: f.experienceId, accessEpoch: 0, perspective: "self" as const });
  const retained = await f.attach(); await f.removeFollower();
  await assert.rejects(f.media.delete("bob", retained.contributionId, { expectedRevision: retained.revision }, { experienceId: f.experienceId, accessEpoch: 0, perspective: "self" as const }));
  assert.equal((await f.media.records().findOne({ contributionId: retained.contributionId }))!.state, "attached");
  // C4: the standalone Card is no back door after leaving; rejoining restores deletion from Me.
  await assert.rejects(f.media.delete("bob", retained.contributionId, { expectedRevision: retained.revision }), { code: "GROUP_MEDIA_FORBIDDEN" });
  assert.equal((await f.media.records().findOne({ contributionId: retained.contributionId }))!.state, "attached");
  await f.rejoin();
  assert.equal((await f.deleteFromMe(retained.contributionId, retained.revision)).state, "deleted");
  assert.equal((await f.media.records().findOne({ contributionId: foreign.contributionId }))!.state, "attached");
});
