import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import { randomUUID } from "node:crypto";
import { S3Client, type HeadObjectCommand } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { InfoCardRepository, createInfoCardIndexes } from "../src/lib/infoCards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { createInstructionalImageUpload } from "../src/lib/cloudflareR2";
import { INSTRUCTIONAL_IMAGE_ALLOCATIONS, recordImageAllocation } from "../src/lib/cards/instructionalImageOwnership";
import { resolveInstructionalImage } from "../src/lib/instructionalImages";
import { libraryDetail } from "../src/lib/cards/libraryReadModels";
import { cardContentPresentation } from "../src/lib/cards/libraryProjection";
import { creatorBoard, privateGraph } from "../src/components/creator/cardArchitectureAdapter";
import { creatorBoardToDeckTemplate, createCreatorBoardFromTemplate } from "../src/components/creator/creatorBoardState";
import { GROUP_MEDIA_COLLECTION } from "../src/lib/groupExperiences/media/indexes";
import { withStepMedia, type StepMediaItem } from "../src/lib/stepMedia";
import type { CardContent } from "../src/lib/cards/model";
import type { CloudflareR2ImageMediaItem, CloudflareStreamVideoMediaItem } from "../src/lib/media";

// Interactions between the two branches that neither branch tested alone:
// step media collections (main) with Info Card attachment dates, Group media
// restrictions and Card image ownership (Group Experience branch + main).
//
// Coverage boundaries (what these tests do NOT establish):
// - Nested mediaItems are exercised through the Card create and save paths only. Deck content and
//   the graph write paths (createPrivateGraph / Deck saves) are not covered for the Group media
//   restriction or for image ownership. A pre-existing validation defect on those paths would need a
//   production change and is outside this test file.
// - The Creator round trip runs the pure adapters (creatorBoard, privateGraph and the template
//   conversions); it does not drive the Creator interface or its save requests.
// - Image delivery is checked by resolving an authorised reference with resolveInstructionalImage.
//   Object storage is a stubbed S3 client; no bytes are served over HTTP here.
let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
const objects = new Map<string, Record<string, string>>();
before(async () => {
  process.env.SESSION_SECRET = "disposable-merge-interaction-test-only";
  Object.assign(process.env, { CLOUDFLARE_ACCOUNT_ID: "fixture", CLOUDFLARE_R2_ACCESS_KEY_ID: "fixture", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "fixture",
    CLOUDFLARE_R2_BUCKET_NAME: "fixture", CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://r2.invalid" });
  mock.method(S3Client.prototype, "send", async (command: HeadObjectCommand) => {
    const metadata = objects.get(command.input.Key!); if (!metadata) throw new Error("No such uploaded object");
    return { Metadata: metadata, ContentLength: 10, ContentType: "image/png" };
  });
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(mongo.getUri()).connect();
});
after(async () => { mock.restoreAll(); await client?.close(); await mongo?.stop(); });

async function setup() {
  const db = client.db(`switchplay_test_merge_interactions_${sequence++}`);
  // Writers advertise the Step Media Protocol; the legacy client does not.
  const repo = new CardRepository(db, client, "1"), legacy = new CardRepository(db, client);
  await db.createCollection(INSTRUCTIONAL_IMAGE_ALLOCATIONS);
  await createFoundationIndexes(db); await createInfoCardIndexes(db);
  await repo.users().insertMany(["alice", "bob", "learner"].map(_id => ({ _id, username: _id, cardsData: [], decksData: [] })));
  const info = new InfoCardRepository(db, client);
  await info.createSeries("alice", "series", "Basics");
  for (const id of ["a", "b"]) {
    await info.create("alice", id);
    await info.save("alice", id, 0, { title: "Signs", body: "Keep the sign with the number.", seriesId: "series", mediaItem: null }, "public");
    await info.publish("alice", id, 1);
  }
  return { repo, legacy, info };
}
const activity: StepMediaItem = { id: "visual", label: "Explore", kind: "activity", activityId: "roots-and-factors" };
function content(ids: string[], media: StepMediaItem[] = [activity]): CardContent {
  const base = createDefaultCardContent(["one", "two", "three"]);
  return { ...base, infoCardIds: ids, intro: withStepMedia({ ...base.intro, title: "Practice", description: "Keep this introduction" }, media) };
}
const deckContent = (cards: string[]) => ({ ...createDefaultDeckContent([]), title: "Practice Deck", cards: cards.map(cardTemplateId => ({ cardTemplateId })) });
async function allocateImage(repo: CardRepository, targetId: string, uploaded = true): Promise<CloudflareR2ImageMediaItem> {
  const upload = await createInstructionalImageUpload({ creator: "alice", scope: "card", targetId, contentType: "image/png" });
  await recordImageAllocation(repo.db, "alice", { scope: "card", targetId }, upload);
  if (uploaded) objects.set(upload.assetId, { creator: "alice", "instructional-scope": "card", "instructional-target": targetId });
  return { id: randomUUID(), mediaType: "image", provider: "cloudflare-r2", assetId: upload.assetId, src: upload.deliveryUrl, description: "Parabola" };
}

test("mediaItems and infoCardAttachedAt coexist through save, publish, Library, presentation and the Creator", async () => {
  const { repo, legacy } = await setup();
  const first = content(["b", "a"]), deck = deckContent(["main"]);
  await repo.createPrivateGraph("alice", "graph", deck, [{ cardTemplateId: "main", content: first }]);
  const stored = (await repo.cards().findOne({ cardTemplateId: "main" }))!.draft!;
  assert.deepEqual(Object.keys(stored.infoCardAttachedAt!).sort(), ["a", "b"]);
  assert.deepEqual(stored.intro.mediaItems, [activity]);
  assert.equal(Object.hasOwn(stored.intro, "mediaItem"), false, "a modern destination never keeps the legacy field");

  // Creator adapter round trip (pure functions, no Creator UI) keeps both families of fields.
  const dto = { root: { deckTemplateId: "graph" }, content: deck, cards: [{ root: { cardTemplateId: "main" }, content: stored, publishedContent: null }] };
  const board = creatorBoard(dto), saved = privateGraph(board, dto).cards[0].content;
  assert.deepEqual(saved.infoCardAttachedAt, stored.infoCardAttachedAt);
  assert.deepEqual(saved.intro.mediaItems, [activity]);
  const template = creatorBoardToDeckTemplate(createCreatorBoardFromTemplate(creatorBoardToDeckTemplate(board))).cards[0];
  assert.deepEqual(template.infoCardAttachedAt, stored.infoCardAttachedAt);
  assert.deepEqual(template.intro.mediaItems, [activity]);

  // Editing media keeps the original attachment dates; it never restamps them.
  const video: CloudflareStreamVideoMediaItem = { id: "uploaded", description: "Video", mediaType: "video", provider: "cloudflare-stream", assetId: "uploaded", src: "https://iframe.videodelivery.net/uploaded" };
  const edited = content(["b", "a"], [activity, { id: "video", label: "Watch", kind: "video", media: video }]);
  await repo.saveCardDraft("alice", "main", 0, { ...edited, infoCardAttachedAt: { a: "2020-01-01T00:00:00.000Z", b: "2020-01-01T00:00:00.000Z" } });
  const after = (await repo.cards().findOne({ cardTemplateId: "main" }))!.draft!;
  assert.deepEqual(after.infoCardAttachedAt, stored.infoCardAttachedAt, "client supplied timestamps are transport metadata, never authority");
  assert.equal(after.intro.mediaItems!.length, 2);

  // A client that predates the protocol can neither read-modify-write nor strip the draft.
  await assert.rejects(legacy.saveCardDraft("alice", "main", 1, createDefaultCardContent(["one", "two", "three"])), { code: "STEP_MEDIA_CLIENT_REVISION_REQUIRED" });
  assert.deepEqual((await repo.cards().findOne({ cardTemplateId: "main" }))!.draft, after);

  // Publication, Library availability and presentation expose both.
  await repo.saveCardDraft("alice", "main", 1, edited, "public");
  const published = (await repo.cards().findOne({ cardTemplateId: "main" }))!.draft!;
  assert.deepEqual(published.infoCardAttachedAt, stored.infoCardAttachedAt, "a visibility change keeps the attachment dates");
  await repo.publishCard("alice", "main", 2);
  const root = await repo.createDeckDraft("alice", deck, "public");
  await repo.publishDeck("alice", root.deckTemplateId, 0);
  assert.equal((await libraryDetail(repo, "bob", root.deckTemplateId)).availability, "available");
  const presented = cardContentPresentation((await repo.getCardVersion("main", 1))!, "Card 1", { username: "alice", immediateSourceUsername: null });
  assert.deepEqual(presented.infoCardAttachedAt, stored.infoCardAttachedAt);
  assert.deepEqual(presented.intro.mediaItems, [activity, { id: "video", label: "Watch", kind: "video", media: video }]);
});

test("image ownership applies to Card mediaItems entries and survives publication and canonical image-reference resolution", async () => {
  const { repo } = await setup();
  await repo.createCardDraft("alice", content(["a"]), "public", "card");
  const image = await allocateImage(repo, "card");
  const withImage = (media: CloudflareR2ImageMediaItem): CardContent => {
    const base = content(["a"]);
    return { ...base, steps: base.steps.map((step, index) => index === 0
      ? withStepMedia(step, [{ id: "graph", label: "Graph", kind: "image", media, alt: "A parabola" }]) : step) };
  };
  // Unallocated, foreign-target and legacy local references cannot enter a Card draft.
  const stranger = { ...image, assetId: "instructional-images/alice/card/card/forged.png", src: "https://r2.invalid/instructional-images/alice/card/card/forged.png" };
  await assert.rejects(repo.saveCardDraft("alice", "card", 0, withImage(stranger)), { code: "INSTRUCTIONAL_IMAGE_FORBIDDEN" });
  const foreign = await allocateImage(repo, "other-card");
  await assert.rejects(repo.saveCardDraft("alice", "card", 0, withImage(foreign)), { code: "INSTRUCTIONAL_IMAGE_FORBIDDEN" });
  await assert.rejects(repo.saveCardDraft("alice", "card", 0, withImage({ ...image, src: "/images/media-traces/gym-trace-01.png" } as CloudflareR2ImageMediaItem)));
  assert.equal((await repo.cards().findOne({ cardTemplateId: "card" }))!.revision, 0, "rejected writes leave the draft untouched");

  const saved = await repo.saveCardDraft("alice", "card", 0, withImage(image));
  assert.ok(saved);
  // An allocation whose object was never uploaded cannot be published.
  const missing = await allocateImage(repo, "card", false);
  await repo.saveCardDraft("alice", "card", 1, { ...withImage(image), steps: withImage(image).steps.map((step, index) => index === 1
    ? withStepMedia(step, [{ id: "missing", label: "Missing", kind: "image", media: missing, alt: "Missing" }]) : step) });
  await assert.rejects(repo.publishCard("alice", "card", 2));
  await repo.saveCardDraft("alice", "card", 2, withImage(image));
  await repo.publishCard("alice", "card", 3);
  const deck = await repo.createDeckDraft("alice", deckContent(["card"]), "public");
  await repo.publishDeck("alice", deck.deckTemplateId, 0);

  // Any signed-in viewer of the published Deck (a Group member reads it in canonical mode) receives the exact attachment only.
  const stepId = (await repo.getCardVersion("card", 1))!.content.steps[0].stepId;
  const context = { viewerUserId: "learner", cardTemplateId: "card", version: 1, deckTemplateId: deck.deckTemplateId, deckVersion: 1, mode: "canonical" as const, stepId, attachmentId: "graph" };
  assert.deepEqual(await resolveInstructionalImage(repo, "learner", context), image);
  await assert.rejects(resolveInstructionalImage(repo, "bob", context), /FORBIDDEN/);
  await assert.rejects(resolveInstructionalImage(repo, "learner", { ...context, attachmentId: "unknown" }), /FORBIDDEN/);
  await assert.rejects(resolveInstructionalImage(repo, "learner", { ...context, stepId: "intro" }), /FORBIDDEN/);
});

test("Group media is refused inside nested mediaItems through the Card create and save paths", async () => {
  const { repo } = await setup();
  await repo.createCardDraft("alice", content(["a"]), "public", "card");
  const nested = (media: StepMediaItem): CardContent => ({ ...content(["a"]), intro: withStepMedia(content(["a"]).intro, [media]) });
  const groupImage: CloudflareR2ImageMediaItem = { id: "g", mediaType: "image", provider: "cloudflare-r2", assetId: "group-media/contribution.png",
    src: "https://r2.invalid/group-media/contribution.png", description: "Group" };
  await assert.rejects(repo.saveCardDraft("alice", "card", 0, nested({ id: "g", label: "Group", kind: "image", media: groupImage, alt: "Group" })), { code: "MEDIA_FORBIDDEN" });
  await repo.db.collection(GROUP_MEDIA_COLLECTION).insertOne({ asset: { provider: "stream", assetId: "reserved123" } });
  const reserved: CloudflareStreamVideoMediaItem = { id: "r", description: "Reserved", mediaType: "video", provider: "cloudflare-stream", assetId: "reserved123", src: "https://iframe.videodelivery.net/reserved123" };
  await assert.rejects(repo.saveCardDraft("alice", "card", 0, nested({ id: "r", label: "Reserved", kind: "video", media: reserved })), { code: "MEDIA_FORBIDDEN" });
  await assert.rejects(repo.createCardDraft("alice", nested({ id: "r2", label: "Reserved", kind: "video", media: reserved }), "private", "second"), { code: "MEDIA_FORBIDDEN" });
  assert.equal((await repo.cards().findOne({ cardTemplateId: "card" }))!.revision, 0);
  assert.equal(await repo.cards().findOne({ cardTemplateId: "second" }), null);
});
