import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient, type ClientSession } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { GroupMediaRepository } from "../src/lib/groupExperiences/media/repository";
import { createGroupMediaIndexes } from "../src/lib/groupExperiences/media/indexes";
import type { GroupMediaProvider } from "../src/lib/groupExperiences/media/model";
import { readOwnerMediaPage } from "../src/lib/mediaCollection/ownerHistory";
import { ownerPreviewPages, sharedPreviewPages, subjectPreviewPages } from "../src/lib/mediaCollection/preparation";
import { mediaRemoveOperation, memberMediaCapabilities } from "../src/lib/mediaCollection/permissions";
import { viewerIdentity } from "../src/lib/groupExperiences/media/contributionIdentity";
import type { MediaCollectionItem } from "../src/lib/mediaCollection/contracts";

// Checkpoint 4.0: Group media contribution identities. Follower contributions ("self", made in Me) join the
// author's cross-context history; Admin contributions ("group", made in the Group perspective) belong only to
// their originating Group perspective. A dual-role user's two identities are separate.
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { process.env.SESSION_SECRET = "disposable-identity-test-secret"; mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });

// alice: admin of Group A and Group B and also a follower in both (dual role). bob, carol: followers only.
async function fixture() {
  const f = await groupFixture(client, { followers: ["alice", "bob", "carol"] }); await createGroupMediaIndexes(f.cards.db);
  const provider: GroupMediaProvider = {
    checkConfiguration() {},
    async allocate(row) { return { asset: { provider: "r2", assetId: `group-media/${row.contributionId}.jpg`, bucket: "path-user-data" }, uploadURL: "https://upload.example.test/only", headers: {} }; },
    async status() { return { status: "ready" }; }, async remove() {}, async deliver() { return Response.json({ grant: "signed-only" }); },
  };
  const media = new GroupMediaRepository(f.repo, provider);
  const groupB = (await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "Group B" })).experienceId;
  const epoch = async (actor: string, experienceId: string) => (await f.repo.members().findOne({ experienceId, userId: actor }))!.accessEpoch;
  const allocate = async (actor: string, creationContext: unknown, experienceId = f.experienceId, changes = {}) =>
    media.allocate(actor, experienceId, f.ids[0], { operationId: randomUUID(), accessEpoch: await epoch(actor, experienceId), version: 1, kind: "image", contentType: "image/jpeg", size: 100, creationContext, ...changes });
  const attach = async (actor: string, creationContext: "self" | "group", experienceId = f.experienceId) => {
    const a = await allocate(actor, creationContext, experienceId);
    return media.commit(actor, experienceId, f.ids[0], a.contributionId, { expectedRevision: a.revision, proof: a.proof });
  };
  const authority = (actor: string, experienceId: string, session: ClientSession) => f.repo.access(actor, experienceId, "member", session);
  const keys = (items: { contributionId?: string; source?: { kind: string; contributionId?: string } }[]) =>
    items.map(item => item.contributionId ?? item.source?.contributionId).toSorted();
  // Owner history: the standalone Card (no Group) or Me in a Group.
  const history = async (actor: string, experienceId?: string) => readOwnerMediaPage(f.cards, actor, f.ids[0], experienceId ? { experienceId } : {});
  const previews = (actor: string, experienceId?: string) => f.repo.transaction(async session => experienceId
    ? (await ownerPreviewPages(f.cards, actor, [f.ids[0]], session, true, await authority(actor, experienceId, session)))[f.ids[0]]
    : (await ownerPreviewPages(f.cards, actor, [f.ids[0]], session, true))[f.ids[0]]);
  const groupPreviews = (actor: string, experienceId = f.experienceId, subjectUserId?: string) => f.repo.transaction(async session =>
    (await sharedPreviewPages(f.cards, actor, [f.ids[0]], session, await authority(actor, experienceId, session), subjectUserId))[f.ids[0]]);
  const inspected = (actor: string, subject: string, experienceId = f.experienceId) => f.repo.transaction(async session =>
    (await subjectPreviewPages(f.cards, actor, [f.ids[0]], [subject], session, await authority(actor, experienceId, session))).get(subject)![f.ids[0]]);
  const setAdmin = async (target: string, isAdmin: boolean) => {
    const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
    await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: e.structureRevision, targetUserId: target, kind: "set-admin", isAdmin });
  };
  return { ...f, media, groupB, epoch, allocate, attach, history, previews, groupPreviews, inspected, keys, setAdmin };
}

test("coach scenario: an Admin contribution appears only in its originating Group perspective", async () => {
  const f = await fixture();
  const admin = await f.attach("alice", "group");
  assert.equal(admin.creationContext, "group");
  // Group A: its Group feed and previews, for every member.
  for (const viewer of ["alice", "carol"]) assert.deepEqual(f.keys((await f.media.groupFeed(viewer, f.experienceId, f.ids[0])).items), [admin.contributionId]);
  assert.deepEqual(f.keys((await f.groupPreviews("alice")).items), [admin.contributionId]);
  // Not in Group B, neither its Group perspective nor Me there.
  assert.deepEqual((await f.media.groupFeed("alice", f.groupB, f.ids[0])).items, []);
  assert.deepEqual((await f.history("alice", f.groupB)).items, []); assert.equal((await f.previews("alice", f.groupB)).total, 0);
  // Not on the standalone Card, nor in the author's own Me in Group A.
  for (const page of [await f.history("alice"), await f.history("alice", f.experienceId)]) { assert.deepEqual(page.items, []); assert.equal(page.total, 0); }
  assert.equal((await f.previews("alice")).total, 0); assert.equal((await f.previews("alice", f.experienceId)).total, 0);
  assert.deepEqual((await f.media.ownerFeed("alice", f.ids[0])).items, []);
});

test("follower scenario: a Follower contribution keeps its cross-context history, private outside its Group", async () => {
  const f = await fixture();
  const own = await f.attach("bob", "self");
  const standalone = await f.history("bob");
  assert.deepEqual(f.keys(standalone.items), [own.contributionId]); assert.equal(standalone.items[0].private, false);
  assert.equal((await f.history("bob", f.experienceId)).items[0].private, false);
  const elsewhere = await f.history("bob", f.groupB);
  assert.deepEqual(f.keys(elsewhere.items), [own.contributionId]); assert.equal(elsewhere.items[0].private, true, "the existing private icon outside its origin");
  assert.equal((await f.previews("bob", f.groupB)).items[0].private, true);
  assert.deepEqual(f.keys((await f.media.groupFeed("carol", f.experienceId, f.ids[0])).items), [own.contributionId]);
  assert.deepEqual((await f.media.groupFeed("carol", f.groupB, f.ids[0])).items, []);
});

test("a dual-role user has separate Admin and Follower histories, views and delete rights", async () => {
  const f = await fixture();
  const admin = await f.attach("alice", "group"), follower = await f.attach("alice", "self");
  // Me and the standalone Card show only the Follower contribution.
  for (const page of [await f.history("alice"), await f.history("alice", f.experienceId)]) assert.deepEqual(f.keys(page.items), [follower.contributionId]);
  assert.deepEqual(f.keys((await f.previews("alice")).items), [follower.contributionId]);
  // The Group feed shows both, as separate items.
  const feed = await f.media.groupFeed("carol", f.experienceId, f.ids[0]);
  assert.deepEqual(f.keys(feed.items), [admin.contributionId, follower.contributionId].toSorted());
  assert.deepEqual(feed.items.map(item => [item.contributionId, item.creationContext]).toSorted(), [[admin.contributionId, "group"], [follower.contributionId, "self"]].toSorted());
  // Viewed as a follower, only the Follower contribution is theirs.
  await f.repo.experiences().updateOne({ experienceId: f.experienceId }, { $set: { allowFollowerInspection: true } });
  assert.deepEqual(f.keys((await f.media.groupFeed("carol", f.experienceId, f.ids[0], { subjectUserId: "alice" })).items), [follower.contributionId]);
  assert.deepEqual(f.keys((await f.inspected("carol", "alice")).items), [follower.contributionId]);
  assert.deepEqual(f.keys((await f.groupPreviews("carol", f.experienceId, "alice")).items), [follower.contributionId]);

  // Delete is offered only in the creating perspective; elsewhere an admin may only hide.
  const member = (await f.repo.members().findOne({ experienceId: f.experienceId, userId: "alice" }))!;
  const groupContext = { kind: "group" as const, viewerUserId: "alice", cardTemplateId: f.ids[0], experienceId: f.experienceId, accessEpoch: member.accessEpoch, adoptionRevision: 0 };
  const meContext = { kind: "owner" as const, viewerUserId: "alice", cardTemplateId: f.ids[0], experienceId: f.experienceId };
  const item = (id: string, creationContext: "self" | "group"): MediaCollectionItem => ({ source: { kind: "group", experienceId: f.experienceId, contributionId: id }, authorUserId: "alice",
    mediaType: "image", description: "Group image", uploadedAt: null, originName: null, private: false, creationContext });
  const groupCaps = memberMediaCapabilities(member), meCaps = memberMediaCapabilities(member, "alice");
  assert.equal(mediaRemoveOperation("alice", item(admin.contributionId, "group"), groupCaps, f.experienceId, viewerIdentity(groupContext)), "delete");
  assert.equal(mediaRemoveOperation("alice", item(follower.contributionId, "self"), groupCaps, f.experienceId, viewerIdentity(groupContext)), "hide");
  assert.equal(mediaRemoveOperation("alice", item(follower.contributionId, "self"), meCaps, f.experienceId, viewerIdentity(meContext)), "delete");
  assert.equal(mediaRemoveOperation("alice", item(admin.contributionId, "group"), meCaps, f.experienceId, viewerIdentity(meContext)), null);
  assert.equal(mediaRemoveOperation("alice", item(follower.contributionId, "self"), { canUpload: false, canManage: true, canRemoveOwn: true, canHideOthers: false }, undefined, "self"), "delete");

  // The server rejects cross-identity deletes through the Group-context route and the owner route.
  const epoch = member.accessEpoch;
  await assert.rejects(f.media.delete("alice", admin.contributionId, { expectedRevision: admin.revision }, { experienceId: f.experienceId, accessEpoch: epoch, perspective: "self" }), { code: "GROUP_MEDIA_FORBIDDEN" });
  await assert.rejects(f.media.delete("alice", follower.contributionId, { expectedRevision: follower.revision }, { experienceId: f.experienceId, accessEpoch: epoch, perspective: "group" }), { code: "GROUP_MEDIA_FORBIDDEN" });
  await assert.rejects(f.media.delete("alice", admin.contributionId, { expectedRevision: admin.revision }), { code: "GROUP_MEDIA_FORBIDDEN" });
  assert.equal((await f.media.records().countDocuments({ state: "attached" })), 2, "nothing was deleted");
  // Each identity deletes its own.
  assert.equal((await f.media.delete("alice", admin.contributionId, { expectedRevision: admin.revision }, { experienceId: f.experienceId, accessEpoch: epoch, perspective: "group" })).state, "deleted");
  assert.equal((await f.media.delete("alice", follower.contributionId, { expectedRevision: follower.revision })).state, "deleted");
});

test("a follower-only user has no Admin identity: no Group-perspective delete, deletion works from Me and standalone", async () => {
  const f = await fixture();
  const first = await f.attach("bob", "self"), second = await f.attach("bob", "self");
  const member = (await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }))!;
  const item: MediaCollectionItem = { source: { kind: "group", experienceId: f.experienceId, contributionId: first.contributionId }, authorUserId: "bob", mediaType: "image",
    description: "Group image", uploadedAt: null, originName: null, private: false, creationContext: "self" };
  assert.equal(mediaRemoveOperation("bob", item, memberMediaCapabilities(member), f.experienceId, "group"), null, "no Delete in the Group perspective");
  assert.equal(mediaRemoveOperation("bob", item, memberMediaCapabilities(member, "bob"), f.experienceId, "self"), "delete");
  await assert.rejects(f.media.delete("bob", first.contributionId, { expectedRevision: first.revision }, { experienceId: f.experienceId, accessEpoch: member.accessEpoch, perspective: "group" }), { code: "GROUP_FORBIDDEN" });
  assert.equal((await f.media.delete("bob", first.contributionId, { expectedRevision: first.revision }, { experienceId: f.experienceId, accessEpoch: member.accessEpoch, perspective: "self" })).state, "deleted");
  assert.equal((await f.media.delete("bob", second.contributionId, { expectedRevision: second.revision })).state, "deleted");
  // Nobody deletes another author's contribution, whatever identity they claim.
  const carol = await f.attach("carol", "self");
  const alice = (await f.repo.members().findOne({ experienceId: f.experienceId, userId: "alice" }))!;
  for (const perspective of ["self", "group"] as const) await assert.rejects(f.media.delete("alice", carol.contributionId, { expectedRevision: carol.revision }, { experienceId: f.experienceId, accessEpoch: alice.accessEpoch, perspective }), { code: "GROUP_MEDIA_FORBIDDEN" });
});

test("cancelling a pending Admin or Follower upload through the owner route still works", async () => {
  const f = await fixture();
  for (const [actor, identity] of [["alice", "group"], ["alice", "self"], ["bob", "self"]] as const) {
    const pending = await f.allocate(actor, identity);
    const status = await f.media.status(actor, pending.contributionId, { kind: "owner" });
    assert.equal((await f.media.delete(actor, pending.contributionId, { expectedRevision: status.revision })).state, "deleted");
    // A lost cancel response can be retried.
    assert.equal((await f.media.delete(actor, pending.contributionId, { expectedRevision: status.revision })).state, "deleted");
  }
});

test("management controls and own counts reflect only the acting identity", async () => {
  const f = await fixture();
  await f.attach("bob", "self");
  // bob is a follower only: in the Group perspective his Follower contribution is not his to manage there.
  assert.equal((await f.media.groupFeed("bob", f.experienceId, f.ids[0])).capabilities.canManage, false);
  assert.equal((await f.groupPreviews("bob")).capabilities?.canManage, false);
  // As himself he manages it.
  assert.equal((await f.media.groupFeed("bob", f.experienceId, f.ids[0], { subjectUserId: "bob" })).capabilities.canManage, true);
  assert.equal((await f.inspected("bob", "bob")).capabilities?.canManage, true);
  // Promoted, bob manages the Group perspective as an admin; the Admin identity starts with no contributions.
  await f.setAdmin("bob", true);
  assert.equal((await f.media.groupFeed("bob", f.experienceId, f.ids[0])).capabilities.canManage, true);
  const ownAdmin = await f.media.records().countDocuments({ experienceId: f.experienceId, authorUserId: "bob", creationContext: "group", state: "attached" });
  assert.equal(ownAdmin, 0);
});

test("role changes after creation never reclassify, and an in-flight upload across a role change fails", async () => {
  const f = await fixture();
  const followerItem = await f.attach("bob", "self");
  await f.setAdmin("bob", true);
  const adminItem = await f.attach("bob", "group");
  // Promotion did not move the Follower contribution out of bob's history; the Admin one never joins it.
  assert.deepEqual(f.keys((await f.history("bob")).items), [followerItem.contributionId]);
  await f.setAdmin("bob", false);
  assert.deepEqual(f.keys((await f.history("bob")).items), [followerItem.contributionId], "demotion does not reclassify either");
  assert.ok(f.keys((await f.media.groupFeed("carol", f.experienceId, f.ids[0])).items).includes(adminItem.contributionId));
  // Accepted limitation: without the admin role, the Admin contribution cannot be deleted from any perspective.
  const epoch = await f.epoch("bob", f.experienceId);
  await assert.rejects(f.media.delete("bob", adminItem.contributionId, { expectedRevision: adminItem.revision }, { experienceId: f.experienceId, accessEpoch: epoch, perspective: "group" }), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.media.delete("bob", adminItem.contributionId, { expectedRevision: adminItem.revision }), { code: "GROUP_MEDIA_FORBIDDEN" });
  // A pending upload whose author changes role fails its commit.
  const pending = await f.allocate("bob", "self");
  await f.setAdmin("bob", true);
  await assert.rejects(f.media.commit("bob", f.experienceId, f.ids[0], pending.contributionId, { expectedRevision: pending.revision, proof: pending.proof }), { code: "GROUP_ACCESS_CONFLICT" });
});

test("the server accepts Admin contributions only from admins and Follower contributions only from followers", async () => {
  const f = await fixture();
  await assert.rejects(f.allocate("bob", "group"), { code: "GROUP_MEDIA_PERSPECTIVE_FORBIDDEN" });
  // An admin who is not a follower has no Me perspective.
  const adminOnly = (await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "Admin only", followerIds: ["bob"] })).experienceId;
  await assert.rejects(f.allocate("alice", "self", adminOnly), { code: "GROUP_MEDIA_PERSPECTIVE_FORBIDDEN" });
  assert.equal((await f.allocate("alice", "group", adminOnly)).state, "pending");
  for (const value of [undefined, "admin", "Me"]) await assert.rejects(f.allocate("bob", value), { code: value === undefined ? "INVALID_GROUP_MEDIA_PERSPECTIVE" : "INVALID_GROUP_MEDIA_PERSPECTIVE" });
  // The identity is part of the operation: a retry cannot change it.
  const operationId = randomUUID(), base = { operationId, accessEpoch: await f.epoch("alice", f.experienceId), version: 1, kind: "image", contentType: "image/jpeg", size: 100 };
  await f.media.allocate("alice", f.experienceId, f.ids[0], { ...base, creationContext: "self" });
  await assert.rejects(f.media.allocate("alice", f.experienceId, f.ids[0], { ...base, creationContext: "group" }), { code: "GROUP_MEDIA_OPERATION_CONFLICT" });
  assert.equal((await f.media.records().findOne({ operationId }))!.creationContext, "self");
});

test("admins hide any contribution of their Group, including their own Follower one; nothing is deleted", async () => {
  const f = await fixture();
  const carol = await f.attach("carol", "self"), own = await f.attach("alice", "self");
  for (const row of [carol, own]) await f.media.hide("alice", f.experienceId, row.contributionId, { expectedRevision: row.revision, accessEpoch: await f.epoch("alice", f.experienceId) });
  assert.equal(await f.media.records().countDocuments({ state: "attached", groupVisible: false }), 2);
  assert.deepEqual((await f.media.groupFeed("bob", f.experienceId, f.ids[0])).items, []);
  // The author still sees a hidden Follower contribution, marked private (the existing icon).
  const me = await f.history("alice", f.experienceId);
  assert.deepEqual(f.keys(me.items), [own.contributionId]); assert.equal(me.items[0].private, true);
});

test("a record without creationContext behaves as a Follower contribution", async () => {
  const f = await fixture();
  const legacy = await f.attach("bob", "self");
  await f.media.records().updateOne({ contributionId: legacy.contributionId }, { $unset: { creationContext: "" } });
  assert.equal((await f.media.records().findOne({ contributionId: legacy.contributionId }))!.creationContext, undefined);
  assert.deepEqual(f.keys((await f.history("bob")).items), [legacy.contributionId]);
  assert.equal((await f.history("bob", f.groupB)).items[0].private, true);
  assert.deepEqual(f.keys((await f.inspected("alice", "bob")).items), [legacy.contributionId]);
  const feed = await f.media.groupFeed("carol", f.experienceId, f.ids[0]);
  assert.equal(feed.items[0].creationContext, "self");
  const epoch = await f.epoch("bob", f.experienceId);
  await assert.rejects(f.media.delete("bob", legacy.contributionId, { expectedRevision: legacy.revision }, { experienceId: f.experienceId, accessEpoch: epoch, perspective: "group" }));
  assert.equal((await f.media.delete("bob", legacy.contributionId, { expectedRevision: legacy.revision }, { experienceId: f.experienceId, accessEpoch: epoch, perspective: "self" })).state, "deleted");
});

test("owner-history totals, olderCount and cursors count Follower contributions only", async () => {
  const f = await fixture();
  const follower = [];
  for (let i = 0; i < 3; i++) { follower.push((await f.attach("alice", "self")).contributionId); await f.attach("alice", "group"); }
  const first = await readOwnerMediaPage(f.cards, "alice", f.ids[0], { limit: 2 });
  assert.equal(first.total, 3); assert.equal(first.olderCount, 1); assert.equal(first.items.length, 2); assert.equal(first.newer, null);
  assert.ok(first.older);
  const older = await readOwnerMediaPage(f.cards, "alice", f.ids[0], { limit: 2, cursor: first.older! });
  assert.equal(older.items.length, 1); assert.equal(older.older, null); assert.equal(older.start, 0);
  assert.deepEqual(f.keys([...first.items, ...older.items]), follower.toSorted());
  const preview = await f.previews("alice");
  assert.equal(preview.total, 3); assert.equal(preview.items.length, 3);
  const feed = await f.media.ownerFeed("alice", f.ids[0], { limit: 2 });
  assert.equal(feed.total, 3);
  const rest = await f.media.ownerFeed("alice", f.ids[0], { limit: 2, after: feed.next! });
  assert.deepEqual(f.keys([...feed.items, ...rest.items]), follower.toSorted());
  // The Group feed still lists all six, each once.
  assert.equal((await f.media.groupFeed("carol", f.experienceId, f.ids[0])).total, 6);
});
