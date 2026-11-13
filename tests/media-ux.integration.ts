import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { createGroupMediaIndexes } from "../src/lib/groupExperiences/media/indexes";
import { GroupMediaRepository } from "../src/lib/groupExperiences/media/repository";
import { readOwnerMediaPage } from "../src/lib/mediaCollection/ownerHistory";
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
test("media capabilities match Group, self, Admin inspection and peer contexts", async () => {
  const f = await groupFixture(client), media = new GroupMediaRepository(f.repo);
  assert.equal((await media.groupFeed("alice", f.experienceId, f.ids[0])).capabilities?.canUpload, true);
  const follower = await media.groupFeed("bob", f.experienceId, f.ids[0]); assert.equal(follower.capabilities?.canUpload, false); assert.equal(follower.capabilities?.canManage, false);
  await createGroupMediaIndexes(f.cards.db);
  await media.records().insertOne({ contributionId: "owned", operationId: "owned", operationHash: "fixture", authorUserId: "bob", experienceId: f.experienceId, cardTemplateId: f.ids[0], deckTemplateId: f.deckId,
    accessEpoch: 0, version: 1, adoptionRevision: 0, kind: "image", contentType: "image/png", size: 1, state: "attached", groupVisible: true, revision: 1, allocation: "ready", createdAt: new Date(), uploadedAt: new Date() });
  // Checkpoint 4.0: a follower-only user has no Admin identity, so their Follower contribution does not make them a
  // manager of the Group perspective; they manage it from Me (and inspection of themselves).
  const creator = await media.groupFeed("bob", f.experienceId, f.ids[0]); assert.equal(creator.items[0].authorName, "bob"); assert.equal(creator.capabilities?.canManage, false); assert.equal(creator.capabilities?.canUpload, false);
  assert.equal((await media.groupFeed("bob", f.experienceId, f.ids[0], { subjectUserId: "bob" })).capabilities?.canManage, true);
  const self = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { experienceId: f.experienceId }); assert.equal(self.items[0].authorName, "bob"); assert.equal(self.capabilities?.canUpload, true); assert.equal(self.capabilities?.canManage, true);
  const inspected = await media.groupFeed("alice", f.experienceId, f.ids[0], { subjectUserId: "bob" }); assert.equal(inspected.capabilities?.canUpload, false); assert.equal(inspected.capabilities?.canHideOthers, true);
  await media.records().updateOne({ contributionId: "owned" }, { $set: { groupVisible: false } });
  const hidden = await readOwnerMediaPage(f.cards, "bob", f.ids[0], { experienceId: f.experienceId });
  assert.equal(hidden.items[0].authorName, "bob"); assert.equal(hidden.items[0].private, true);
  await media.records().updateOne({ contributionId: "owned" }, { $set: { groupVisible: true } });
  await f.repo.experiences().updateOne({ experienceId: f.experienceId }, { $set: { allowFollowerInspection: true } });
  const peer = await media.groupFeed("carol", f.experienceId, f.ids[0], { subjectUserId: "bob" }); assert.equal(peer.capabilities?.canManage, false); assert.equal(peer.capabilities?.canHideOthers, false);
});
