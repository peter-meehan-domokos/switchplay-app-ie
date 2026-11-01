import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { randomUUID } from "node:crypto";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { createInstructionalImageUpload } from "../src/lib/cloudflareR2";
import { INSTRUCTIONAL_IMAGE_ALLOCATIONS, recordImageAllocation } from "../src/lib/cards/instructionalImageOwnership";
import { authorizeUpload } from "../src/lib/cards/uploadAuthorization";
import { authorizeProtectedMedia } from "../src/lib/cards/protectedMedia";
import { resolveInstructionalImage } from "../src/lib/instructionalImages";
import { forkCardContent } from "../src/lib/cards/forks";
import type { CloudflareR2ImageMediaItem } from "../src/lib/media";

let server: MongoMemoryReplSet, client: MongoClient, sequence = 0;
const objects = new Map<string, Record<string, string>>();
before(async () => {
  Object.assign(process.env, { CLOUDFLARE_ACCOUNT_ID: "fixture", CLOUDFLARE_R2_ACCESS_KEY_ID: "fixture", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "fixture", CLOUDFLARE_R2_BUCKET_NAME: "fixture", CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://r2.invalid" });
  mock.method(S3Client.prototype, "send", async (command: HeadObjectCommand) => {
    const metadata = objects.get(command.input.Key!); if (!metadata) throw new Error("No such uploaded object");
    return { Metadata: metadata, ContentLength: 10, ContentType: "image/png" };
  });
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(server.getUri()).connect();
});
after(async () => { await client?.close(); await server?.stop(); });
async function fixture() {
  const repo = new CardRepository(client.db(`switchplay_test_image_ownership_${sequence++}`), client, "1");
  await repo.db.createCollection(INSTRUCTIONAL_IMAGE_ALLOCATIONS); await createFoundationIndexes(repo.db);
  await repo.users().insertMany(["alice", "bob", "learner"].map(_id => ({ _id, cardsData: [], decksData: [] })));
  const content = createDefaultCardContent(["one", "two", "three"]); content.intro.title = "Study a graph";
  await repo.createCardDraft("alice", content, "public", "card");
  return { repo, content };
}
async function allocate(repo: CardRepository, targetId = "card", uploaded = true, scope: "card" | "deck" = "card") {
  const upload = await createInstructionalImageUpload({ creator: "alice", scope, targetId, contentType: "image/png" });
  await recordImageAllocation(repo.db, "alice", { scope, targetId }, upload);
  if (uploaded) objects.set(upload.assetId, { creator: "alice", "instructional-scope": scope, "instructional-target": targetId });
  const image: CloudflareR2ImageMediaItem = { id: randomUUID(), mediaType: "image", provider: "cloudflare-r2", assetId: upload.assetId, src: upload.deliveryUrl, description: "Parabola" };
  return image;
}
test("authorised allocation, save, publication, reload and both delivery paths preserve exact viewer permissions", async () => {
  const { repo, content } = await fixture();
  await authorizeUpload(repo, "alice", { scope: "card-template", deckTemplateId: "detached", cardTemplateId: "card" }, []);
  await assert.rejects(authorizeUpload(repo, "bob", { scope: "card-template", deckTemplateId: "detached", cardTemplateId: "card" }, []), /CARD_FORBIDDEN/);
  const image = await allocate(repo), edited = { ...content, intro: { ...content.intro, mediaItem: image } };
  await repo.saveCardDraft("alice", "card", 0, edited);
  assert.deepEqual((await repo.cards().findOne({ cardTemplateId: "card" }))!.draft, edited);
  await repo.publishCard("alice", "card", 1);
  const deck = await repo.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Graphs", cards: [{ cardTemplateId: "card" }] }, "public");
  await repo.publishDeck("alice", deck.deckTemplateId, 0);
  const context = { viewerUserId: "learner", cardTemplateId: "card", version: 1, deckTemplateId: deck.deckTemplateId, deckVersion: 1, mode: "canonical" as const, stepId: "intro", attachmentId: `legacy:${image.id}` };
  assert.deepEqual(await resolveInstructionalImage(repo, "learner", context), image);
  assert.deepEqual(await authorizeProtectedMedia(repo, "learner", "r2", image.src), image);
  await assert.rejects(resolveInstructionalImage(repo, "bob", context), /FORBIDDEN/);
  await assert.rejects(resolveInstructionalImage(repo, "learner", { ...context, attachmentId: "other" }), /FORBIDDEN/);
  assert.deepEqual((await repo.getCardVersion("card", 1))!.content, edited);
  assert.equal((await repo.getPersonalUser("learner"))!.cardsData.length, 0);
});
test("forged URLs, cross-account and unrelated destinations cannot attach an allocated image", async () => {
  const { repo, content } = await fixture(), image = await allocate(repo);
  await repo.createCardDraft("bob", { ...content, steps: content.steps.map((s, i) => ({ ...s, stepId: `bob-${i}` })) }, "private", "bob-card");
  for (const forged of [{ ...image, assetId: "someone-elses.png" }, { ...image, src: "https://foreign.invalid/image.png" },
    { ...image, src: "https://r2.invalid/info-cards/other/private/image.png", assetId: "info-cards/other/private/image.png" }]) {
    await assert.rejects(repo.saveCardDraft("alice", "card", 0, { ...content, intro: { ...content.intro, mediaItem: forged } }), /FORBIDDEN/);
  }
  const b = (await repo.cards().findOne({ cardTemplateId: "bob-card" }))!;
  await assert.rejects(repo.saveCardDraft("bob", "bob-card", 0, { ...b.draft!, intro: { ...b.draft!.intro, mediaItem: image } }), /FORBIDDEN/);
  await assert.rejects(repo.createCardDraft("bob", { ...b.draft!, steps: b.draft!.steps.map((s, i) => ({ ...s, stepId: `new-${i}` })), intro: { ...b.draft!.intro, mediaItem: image } }, "private", "new-card"), /FORBIDDEN/);
  assert.equal((await repo.cards().findOne({ cardTemplateId: "card" }))!.revision, 0);
});
test("allocated but missing or incorrectly owned provider bytes cannot publish", async () => {
  const { repo, content } = await fixture(), image = await allocate(repo, "card", false);
  await repo.saveCardDraft("alice", "card", 0, { ...content, intro: { ...content.intro, mediaItem: image } });
  await assert.rejects(repo.publishCard("alice", "card", 1), /No such uploaded object/);
  objects.set(image.assetId, { creator: "bob", "instructional-scope": "card", "instructional-target": "card" });
  await assert.rejects(repo.publishCard("alice", "card", 1), /not ready/);
  assert.equal((await repo.cards().findOne({ cardTemplateId: "card" }))!.latestVersion, 0);
});
test("authorised fork inherits provenance without changing uploader or requiring a new upload", async () => {
  const { repo, content } = await fixture(), image = await allocate(repo);
  const edited = { ...content, intro: { ...content.intro, mediaItem: image } };
  await repo.saveCardDraft("alice", "card", 0, edited); await repo.publishCard("alice", "card", 1);
  const source = { cardTemplateId: "card", version: 1 }, stepIds = ["fork-one", "fork-two", "fork-three"];
  const fork = forkCardContent(edited, source, stepIds);
  await repo.createCardFork("bob", { source, cardTemplateId: "fork", stepIds, content: { ...fork, intro: { ...fork.intro, title: "A copied graph" } }, context: { kind: "library" }, visibility: "public" });
  await repo.publishCard("bob", "fork", 0);
  const allocations = await repo.db.collection(INSTRUCTIONAL_IMAGE_ALLOCATIONS).find({ assetId: image.assetId }).toArray();
  assert.equal(allocations.length, 2); assert(allocations.every(a => a.ownerUserId === "alice"));
  assert.equal(allocations.find(a => a.destination.targetId === "fork")!.destinationOwnerUserId, "bob");
  assert.deepEqual(await authorizeProtectedMedia(repo, "learner", "r2", image.src), image);
});
test("legacy references and a forged personal copy never gain delivery rights or automatic registration", async () => {
  const { repo, content } = await fixture();
  const image = { id: "old", mediaType: "image" as const, provider: "cloudflare-r2" as const, assetId: "old/file.png", src: "https://r2.invalid/old/file.png", description: "Legacy" };
  await repo.cards().updateOne({ cardTemplateId: "card" }, { $set: { "draft.intro.mediaItem": image } });
  await repo.users().updateOne({ _id: "bob" }, { $set: { cardsData: [{ cardTemplateId: "card", mediaItems: [image] }] } } as never);
  await repo.saveCardDraft("alice", "card", 0, { ...content, intro: { ...content.intro, title: "Unrelated edit", mediaItem: image } });
  await assert.rejects(repo.publishCard("alice", "card", 1), /FORBIDDEN/);
  for (const actor of ["alice", "bob", "learner"]) await assert.rejects(authorizeProtectedMedia(repo, actor, "r2", image.src), /FORBIDDEN/);
  assert.equal(await repo.db.collection(INSTRUCTIONAL_IMAGE_ALLOCATIONS).countDocuments(), 0);
  await repo.saveCardDraft("alice", "card", 1, content); await repo.publishCard("alice", "card", 2);
});
test("upload does not implicitly create an unapproved allocation collection", async () => {
  const db = client.db(`switchplay_test_image_no_setup_${sequence++}`);
  await assert.rejects(recordImageAllocation(db, "alice", { scope: "card", targetId: "card" }, { assetId: "image.png", deliveryUrl: "https://r2.invalid/image.png" }), /INSTRUCTIONAL_IMAGE_SETUP_REQUIRED/);
  assert.equal(await db.listCollections({ name: INSTRUCTIONAL_IMAGE_ALLOCATIONS }).hasNext(), false);
});

test("Deck illustration grants remain scoped and an authorised Deck fork inherits them", async () => {
  const { repo } = await fixture();
  const content = { ...createDefaultDeckContent([]), title: "Illustrated deck" };
  const deck = await repo.createDeckDraft("alice", content, "public");
  const image = await allocate(repo, deck.deckTemplateId, true, "deck");
  const illustrated = { ...content, introduction: { image, video: null } };
  await repo.saveDeckDraft("alice", deck.deckTemplateId, 0, illustrated);
  await repo.publishDeck("alice", deck.deckTemplateId, 1);
  const foreign = await repo.createDeckDraft("bob", { ...content, title: "Unrelated deck" });
  await assert.rejects(repo.saveDeckDraft("bob", foreign.deckTemplateId, 0, illustrated), /FORBIDDEN/);
  await repo.createDeckFork("bob", { source: { deckTemplateId: deck.deckTemplateId, version: 1 }, deckTemplateId: "fork-deck",
    content: { ...illustrated, title: "Inherited illustration" }, context: { kind: "library" }, visibility: "public" });
  await repo.publishDeck("bob", "fork-deck", 0, undefined, undefined, { enterMyDecks: false });
  const inherited = await repo.db.collection(INSTRUCTIONAL_IMAGE_ALLOCATIONS).findOne({ "destination.scope": "deck", "destination.targetId": "fork-deck" });
  assert.equal(inherited!.ownerUserId, "alice"); assert.equal(inherited!.destinationOwnerUserId, "bob");
  assert.deepEqual(await authorizeProtectedMedia(repo, "learner", "r2", image.src), image);
});
