import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { resolveInstructionalImage } from "../src/lib/instructionalImages";
import type { InstructionalImageContext } from "../src/lib/instructionalImageContext";
import type { ImageMediaItem } from "../src/lib/media";

let server: MongoMemoryReplSet, client: MongoClient;
before(async () => { server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(server.getUri()).connect(); });
after(async () => { await client?.close(); await server?.stop(); });
async function fixture(name: string, privateEra = false) {
  const db = client.db(`switchplay_test_instructional_${name}`), repo = new CardRepository(db, client, "1");
  await createFoundationIndexes(db); await repo.users().insertMany(["owner", "learner", "other"].map(_id => ({ _id, cardsData: [], decksData: [] })));
  const image: ImageMediaItem = { id: "diagram", mediaType: "image", provider: "cloudflare-r2", src: "https://r2.invalid/deck/image.png", assetId: "deck/image.png", description: "Diagram" };
  const base = createDefaultCardContent(["one", "two", "three"]);
  const content = { ...base, intro: { ...base.intro, title: "Image practice", mediaItem: image },
    steps: base.steps.map((step, index) => index === 0 ? { stepId: step.stepId, description: "Study the diagram.", mediaItems: [{ id: "attachment", label: "Image", kind: "image" as const, media: image, alt: "A diagram" }] } : step) };
  const card = await repo.createCardDraft("owner", content, privateEra ? "private" : "public", "card");
  await repo.publishCard("owner", card.cardTemplateId, 0);
  if (privateEra) { await repo.saveCardDraft("owner", "card", 1, { ...content, intro: { ...content.intro, title: "Public image practice" } }, "public"); await repo.publishCard("owner", "card", 2); }
  const deck = await repo.createDeckDraft("owner", { ...createDefaultDeckContent([]), title: "Images", cards: [{ cardTemplateId: "card" }] }, "public");
  await repo.publishDeck("owner", deck.deckTemplateId, 0);
  const context: InstructionalImageContext = { viewerUserId: "learner", cardTemplateId: "card", version: privateEra ? 2 : 1, mode: "canonical", deckTemplateId: deck.deckTemplateId, deckVersion: 1, stepId: "intro", attachmentId: "legacy:diagram" };
  return { repo, db, image, context };
}
test("exact canonical and adopted working image lookup accepts legacy Introduction and ordered step attachments without changing personal progress", async () => {
  const { repo, image, context } = await fixture("positive"), before = await repo.getPersonalUser("learner");
  assert.deepEqual(await resolveInstructionalImage(repo, "learner", context), image);
  assert.deepEqual(await resolveInstructionalImage(repo, "learner", { ...context, stepId: "one", attachmentId: "attachment" }), image);
  assert.deepEqual(await repo.getPersonalUser("learner"), before);
  await repo.ensureDeckData("learner", context.deckTemplateId, 1); await repo.openWorkingDeck("learner", context.deckTemplateId, "2026-10-30");
  const initialized = await repo.getPersonalUser("learner");
  assert.deepEqual(await resolveInstructionalImage(repo, "learner", { ...context, mode: "working" }), image);
  assert.deepEqual(await repo.getPersonalUser("learner"), initialized);
});
test("actor, private-era version, destination, attachment and cross-deck substitution cannot grant image access", async () => {
  const { repo, context } = await fixture("negative", true);
  assert.ok(await resolveInstructionalImage(repo, "learner", context));
  const empty = await repo.createDeckDraft("owner", { ...createDefaultDeckContent([]), title: "Unrelated" }, "public");
  await repo.publishDeck("owner", empty.deckTemplateId, 0);
  for (const changed of [{ ...context, viewerUserId: "owner" }, { ...context, version: 1 }, { ...context, version: 99 },
    { ...context, stepId: "gone" }, { ...context, attachmentId: "gone" }, { ...context, stepId: "one" },
    { ...context, deckTemplateId: empty.deckTemplateId }, { ...context, deckVersion: 99 }]) await assert.rejects(resolveInstructionalImage(repo, "learner", changed));
  await assert.rejects(resolveInstructionalImage(repo, "learner", { ...context, mode: "working" }), /WORKING_DECK_REQUIRED/);
  await repo.ensureDeckData("learner", context.deckTemplateId, 1); await repo.openWorkingDeck("learner", context.deckTemplateId, "2026-10-30");
  await assert.rejects(resolveInstructionalImage(repo, "learner", { ...context, mode: "working", version: 1 }), /VERSION_CONFLICT/);
  await assert.rejects(resolveInstructionalImage(repo, "learner", { ...context, mode: "working", deckVersion: 2 }), /VERSION_CONFLICT/);
});
test("an Info Card allocation forged into a main Card never becomes instructional image access", async () => {
  const { repo, db, context, image } = await fixture("info_scope");
  await db.collection("infoCardMediaAssets").insertOne({ provider: "cloudflare-r2", assetId: image.assetId, src: image.src,
    infoCardId: "private-info", ownerUserId: "other", createdAt: new Date() });
  await assert.rejects(resolveInstructionalImage(repo, "learner", context), /MEDIA_FORBIDDEN/);
});
test("a canonical reference cannot turn another learner personal image namespace into an instructional grant", async () => {
  const { repo, context } = await fixture("personal_scope");
  for (const prefix of ["user-cards/other/private/image.png", "user-decks/other/deck/cards/card/image.png"]) {
    await repo.cardVersions().updateOne({ cardTemplateId: "card", version: 1 }, { $set: {
      "content.intro.mediaItem.assetId": prefix, "content.intro.mediaItem.src": `https://r2.invalid/${prefix}`,
    } });
    await assert.rejects(resolveInstructionalImage(repo, "learner", context), /INSTRUCTIONAL_IMAGE_FORBIDDEN/);
  }
});
