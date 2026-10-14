import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { CardRepository } from "../src/lib/cards/repository";
import { authorizeProtectedMedia } from "../src/lib/cards/protectedMedia";

let server: MongoMemoryReplSet, client: MongoClient, repo: CardRepository;
const alice = new ObjectId(), bob = new ObjectId();
const image = (id: string) => ({ id, description: "fixture", mediaType: "image", provider: "cloudflare-r2", assetId: `${id}.png`, src: `https://assets.example.com/${id}.png` });
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(server.getUri()).connect(); repo = new CardRepository(client.db("switchplay_test_protected_media"), client);
  await repo.db.collection("users").insertMany([
    { _id: alice, decksData: [{ archivedAt: new Date() }], cardsData: [{ cardTemplateId: "source", mediaItems: [image("alice-personal")] }, { cardTemplateId: "fork", historySourceCardTemplateId: "source", mediaItems: [] }] },
    { _id: bob, decksData: [], cardsData: [{ cardTemplateId: "source", mediaItems: [image("bob-personal")] }] },
  ]);
  await repo.db.collection("cardTemplates").insertMany([
    { cardTemplateId: "public", ownerUserId: bob.toHexString(), visibility: "public", latestVersion: 2, draft: { mediaItem: image("bob-draft") } },
    { cardTemplateId: "fork", ownerUserId: alice.toHexString(), visibility: "private", forkedFrom: { cardTemplateId: "public", version: 2 }, draft: { mediaItem: image("alice-draft") } },
  ]);
  await repo.db.collection("cardTemplateVersions").insertMany([
    { cardTemplateId: "public", version: 1, visibility: "private", content: { mediaItem: image("private-era") } },
    { cardTemplateId: "public", version: 2, visibility: "public", content: { mediaItem: image("public-era"), intro: { mediaItem: { id: "video", description: "video", mediaType: "video", provider: "cloudflare-stream", assetId: "public-video", src: "https://iframe.videodelivery.net/public-video" } } } },
  ]);
});
after(async () => { await client?.close(); await server?.stop(); });
test("own retained/archived source media and owned drafts remain readable without writes", async () => {
  const before = await repo.db.collection("users").find({}).toArray();
  assert.equal((await authorizeProtectedMedia(repo, alice.toHexString(), "r2", image("alice-personal").src)).id, "alice-personal");
  assert.equal((await authorizeProtectedMedia(repo, alice.toHexString(), "r2", image("alice-draft").src)).id, "alice-draft");
  assert.deepEqual(await repo.db.collection("users").find({}).toArray(), before);
});
test("canonical public versions allow delivery while private-era versions, drafts and other actors' personal media do not", async () => {
  assert.equal((await authorizeProtectedMedia(repo, alice.toHexString(), "r2", image("public-era").src)).id, "public-era");
  const video = await authorizeProtectedMedia(repo, alice.toHexString(), "stream", "public-video");
  assert.equal("assetId" in video && video.assetId, "public-video");
  for (const id of ["private-era", "bob-draft", "bob-personal", "forged"]) await assert.rejects(authorizeProtectedMedia(repo, alice.toHexString(), "r2", image(id).src), { code: "MEDIA_FORBIDDEN" });
  assert.equal((await authorizeProtectedMedia(repo, bob.toHexString(), "r2", image("private-era").src)).id, "private-era");
});
