import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { CardRepository } from "../src/lib/cards/repository";
import { resolveAccessibleCardMedia } from "../src/lib/cardMediaAccess";
import type { AuthUser } from "../src/lib/auth";

let server: MongoMemoryReplSet, client: MongoClient, repo: CardRepository;
const alice = new ObjectId(), bob = new ObjectId();
const image = (name: string) => ({ id: "same-id", description: name, mediaType: "image", provider: "cloudflare-r2", assetId: `${name}.png`, src: `https://images.example/${name}.png` });
const actor = (id: ObjectId, isAdmin = false): AuthUser => ({ id: id.toHexString(), username: "fixture", email: "fixture@example.invalid", isAdmin, createdAt: "2026-10-01", updatedAt: "2026-10-01" });
const target = { viewerUserId: alice.toHexString(), cardTemplateId: "fork", sourceCardTemplateId: "source", mediaItemId: "same-id" };
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(server.getUri()).connect();
  repo = new CardRepository(client.db("switchplay_test_card_media_access"), client);
  await repo.db.collection("users").insertMany([
    { _id: alice, decksData: [{ deckTemplateId: "one", archivedAt: null }, { deckTemplateId: "two", archivedAt: new Date() }], cardsData: [
      { cardTemplateId: "source", cardTemplateVersion: 1, mediaItems: [image("alice-source")] },
      { cardTemplateId: "fork", cardTemplateVersion: 1, historySourceCardTemplateId: "source", mediaItems: [image("alice-fork")] },
      { cardTemplateId: "unrelated", mediaItems: [image("unrelated")] },
    ] },
    { _id: bob, decksData: [], cardsData: [{ cardTemplateId: "source", mediaItems: [image("bob-source")] }] },
  ]);
});
after(async () => { await client?.close(); await server?.stop(); });
const deps = { loadCards: async (id: string) => (await repo.getPersonalUser(id))?.cardsData };
test("source-aware personal reads work across Deck contexts and retained history without database writes", async () => {
  const before = await repo.users().find({}).toArray();
  assert.equal((await resolveAccessibleCardMedia(actor(alice), target, deps)).description, "alice-source");
  assert.equal((await resolveAccessibleCardMedia(actor(alice), { ...target, sourceCardTemplateId: "fork" }, deps)).description, "alice-fork");
  assert.deepEqual(await repo.users().find({}).toArray(), before);
});
test("template ownership/admin status never permits another learner's media or a forged ancestry source", async () => {
  await assert.rejects(resolveAccessibleCardMedia(actor(bob, true), target, deps), { status: 403 });
  await assert.rejects(resolveAccessibleCardMedia(actor(bob, true), { ...target, viewerUserId: bob.toHexString() }, deps), { status: 404 });
  await assert.rejects(resolveAccessibleCardMedia(actor(alice), { ...target, sourceCardTemplateId: "unrelated" }, deps), { status: 404 });
});
test("removal and ambiguous source state fail safely instead of choosing a different asset", async () => {
  await repo.users().updateOne({ _id: alice }, { $push: { cardsData: { cardTemplateId: "source", mediaItems: [image("duplicate")] } } } as never);
  await assert.rejects(resolveAccessibleCardMedia(actor(alice), target, deps), { status: 404 });
  await assert.rejects(resolveAccessibleCardMedia(actor(alice), { ...target, mediaItemId: "removed" }, deps), { status: 404 });
});
