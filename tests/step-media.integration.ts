import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent } from "../src/lib/cards/creatorDefaults";
import { forkCardContent } from "../src/lib/cards/forks";
import { withStepMedia } from "../src/lib/stepMedia";
import { authorizeUpload } from "../src/lib/cards/uploadAuthorization";

let server: MongoMemoryReplSet, client: MongoClient;
before(async () => {
  // Disposable local replica set only. Never use an environment database URI.
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(server.getUri()).connect();
});
after(async () => { await client?.close(); await server?.stop(); });

test("stored modern drafts and published versions resist old saves/forks and retain completion state", async () => {
  const db = client.db("switchplay_test_step_media"), repo = new CardRepository(db, client, "1"), old = new CardRepository(db, client);
  await createFoundationIndexes(db);
  await repo.users().insertMany(["alice", "bob"].map((_id) => ({ _id, cardsData: [], decksData: [] })));
  const legacy = createDefaultCardContent(["one", "two", "three"]);
  legacy.intro.title = "Media practice";
  const root = await old.createCardDraft("alice", legacy, "public", "card");
  await repo.publishCard("alice", root.cardTemplateId, 0);
  await repo.ensureCardData("alice", root.cardTemplateId, 1);
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.0.items.0.completionStatus": "done" } });
  const video = { id: "uploaded", description: "Video", mediaType: "video" as const, provider: "cloudflare-stream" as const, assetId: "uploaded", src: "https://iframe.videodelivery.net/uploaded" };
  const modern = { ...legacy, intro: withStepMedia(legacy.intro, [
    { id: "visual", label: "Explore", kind: "activity", activityId: "roots-and-factors" },
    { id: "video", label: "Watch", kind: "video", media: video },
  ]) };
  await assert.rejects(old.saveCardDraft("alice", "card", 1, modern), { code: "STEP_MEDIA_CLIENT_REVISION_REQUIRED" });
  await repo.saveCardDraft("alice", "card", 1, modern);
  await assert.rejects(old.saveCardDraft("alice", "card", 2, legacy), { code: "STEP_MEDIA_CLIENT_REVISION_REQUIRED" });
  const authorized = await authorizeUpload(repo, "alice", { scope: "card-template", deckTemplateId: "detached", cardTemplateId: "card" }, []);
  assert.deepEqual(authorized.media, [video]);
  await assert.rejects(authorizeUpload(repo, "bob", { scope: "card-template", deckTemplateId: "detached", cardTemplateId: "card" }, []));
  await repo.publishCard("alice", "card", 2);
  assert.deepEqual((await repo.getCardVersion("card", 1))!.content, legacy);
  assert.deepEqual((await repo.getCardVersion("card", 2))!.content, modern);
  assert.equal((await repo.getPersonalUser("alice"))!.cardsData[0].items[0].completionStatus, "done");
  await assert.rejects(old.saveCardDraft("alice", "card", 3, legacy), { code: "STEP_MEDIA_CLIENT_REVISION_REQUIRED" });
  const source = { cardTemplateId: "card", version: 2 }, stepIds = ["fork1", "fork2", "fork3"];
  const fork = forkCardContent(modern, source, stepIds);
  const command = { source, stepIds, cardTemplateId: "fork", context: { kind: "library" as const }, content: { ...fork, intro: { ...fork.intro, title: "Changed" } } };
  await assert.rejects(old.createCardFork("bob", command), { code: "STEP_MEDIA_CLIENT_REVISION_REQUIRED" });
  await repo.createCardFork("bob", command);
  assert.deepEqual((await repo.cards().findOne({ cardTemplateId: "fork" }))!.draft!.intro.mediaItems, modern.intro.mediaItems);
});
