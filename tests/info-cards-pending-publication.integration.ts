import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { InfoCardRepository, createInfoCardIndexes } from "../src/lib/infoCards/repository";
import { resumingInfoConsultation } from "../src/lib/infoCards/queries";
import { signInfoUpload, type InfoMediaReadiness } from "../src/lib/infoCards/media";
import { CardArchitectureError } from "../src/lib/cards/domain";
import { CREATOR_INFO_FILTER, type InfoDraft, type InfoMedia, type InfoPublication, type PersonalInfoContext } from "../src/lib/infoCards/model";

// Checkpoint 10: one stored pending-publication mechanism for Creator Publish and Personal Save, completed only
// when the owner checks again (editor status poll, My Drafts, the Info Card list, the consultation).
let mongo: MongoMemoryReplSet, client: MongoClient, seq = 0;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = await new MongoClient(mongo.getUri()).connect();
  process.env.SESSION_SECRET = "pending-publication-disposable-test-only";
});
after(async () => { await client?.close(); await mongo?.stop(); });

const video = (assetId = `video-${randomUUID()}`): InfoMedia => ({ id: assetId, provider: "cloudflare-stream", mediaType: "video", assetId, src: `https://iframe.videodelivery.net/${assetId}`, description: "Video" });
const content = (mediaItem: InfoMedia | null, title = "Signs"): InfoDraft => ({ title, body: "Keep the sign with its number.", seriesId: "s", mediaItem });

// The injected provider: tests move each video between processing, ready and failed, and count checks.
function provider() {
  const states = new Map<string, InfoMediaReadiness | "forbidden">(); let checks = 0;
  return { states, get checks() { return checks; }, security: { async readiness(_actor: string, _root: unknown, media: InfoMedia) {
    checks++; const state = states.get(media.assetId) ?? "processing";
    if (state === "forbidden") throw new CardArchitectureError("INFO_MEDIA_NOT_READY_OR_UNPROTECTED");
    return state;
  } } };
}
async function setup() {
  const db = client.db(`switchplay_pending_publication_${seq++}`);
  const media = provider(), info = new InfoCardRepository(db, client, media.security), main = new CardRepository(db, client);
  await createFoundationIndexes(db); await createInfoCardIndexes(db);
  await main.users().insertMany(["alice", "bob"].map(_id => ({ _id, username: _id, cardsData: [], decksData: [] })));
  await info.createSeries("alice", "s", "Basics");
  return { db, info, main, media };
}
async function creatorDraft(info: InfoCardRepository, media: InfoMedia | null, id = "a") {
  await info.create("alice", id);
  const root = await info.owner("alice", id);
  return info.save("alice", id, 0, content(media), "private", media ? await signInfoUpload(root, media) : undefined);
}

test("ready media publishes at once; processing media stores one request and publishes nothing", async () => {
  const { info, media } = await setup();
  const ready = video(); media.states.set(ready.assetId, "ready");
  await creatorDraft(info, ready, "ready");
  const published = await info.publish("alice", "ready", 1) as InfoPublication;
  assert.equal(published.version, 1); assert.equal((await info.owner("alice", "ready")).pendingPublication, undefined);

  const slow = video(); await creatorDraft(info, slow, "slow");
  const receipt = await info.publish("alice", "slow", 1);
  assert.deepEqual(receipt, { status: "pending", infoCardId: "slow", revision: 1 });
  const root = await info.owner("alice", "slow");
  assert.equal(root.pendingPublication?.revision, 1); assert.ok(root.pendingPublication?.requestedAt instanceof Date);
  assert.equal(root.revision, 1); assert.equal(root.latestVersion, 0); assert.equal(root.draft?.mediaItem?.assetId, slow.assetId);
  assert.equal(await info.versions().countDocuments({ infoCardId: "slow" }), 0);
  // Pressing again for the same revision keeps the original request.
  await info.publish("alice", "slow", 1);
  assert.deepEqual((await info.owner("alice", "slow")).pendingPublication, root.pendingPublication);
  // Checks that need no provider still run first: an incomplete draft is rejected, not stored.
  await info.create("alice", "incomplete"); const empty = await info.owner("alice", "incomplete"), clip = video();
  await info.save("alice", "incomplete", 0, { ...content(clip), body: "" , bodyFormat: "latex-v1" }, "private", await signInfoUpload(empty, clip));
  await assert.rejects(info.publish("alice", "incomplete", 1), { code: "INFO_PUBLICATION_INCOMPLETE" });
  assert.equal((await info.owner("alice", "incomplete")).pendingPublication, undefined);
});

test("a stored request completes exactly once when the video becomes ready, even under concurrent checks", async () => {
  const { info, media } = await setup();
  const clip = video(); await creatorDraft(info, clip);
  await info.publish("alice", "a", 1);
  assert.deepEqual(await info.completePendingPublication("alice", "a"), { infoCardId: "a", title: "Signs", kind: "creator", status: "pending" });
  assert.equal(await info.versions().countDocuments(), 0);
  media.states.set(clip.assetId, "ready");
  const results = await Promise.all(Array.from({ length: 6 }, () => info.completePendingPublication("alice", "a")));
  assert.equal(await info.versions().countDocuments({ infoCardId: "a" }), 1, "concurrent checks create one version");
  assert.ok(results.some(result => result?.status === "published"));
  const root = await info.owner("alice", "a");
  assert.equal(root.latestVersion, 1); assert.equal(root.draft, null); assert.equal(root.pendingPublication, undefined);
  const version = await info.versions().findOne({ infoCardId: "a" });
  assert.equal(version?.content.mediaItem?.assetId, clip.assetId, "published with the intended media"); assert.equal(version?.sourceRevision, 1);
  // Later checks find nothing to do and never publish again.
  assert.equal(await info.completePendingPublication("alice", "a"), null);
  await info.publish("alice", "a", 1);
  assert.equal(await info.versions().countDocuments({ infoCardId: "a" }), 1);
});

test("a republish keeps the previous version until completion, and a failure keeps it and records why", async () => {
  const { info, media } = await setup();
  await creatorDraft(info, null); await info.publish("alice", "a", 1);
  const clip = video(), root = await info.owner("alice", "a");
  await info.save("alice", "a", 2, content(clip, "Signs with video"), "private", await signInfoUpload(root, clip));
  await info.publish("alice", "a", 3);
  assert.equal((await info.owner("alice", "a")).latestVersion, 1, "the published version is unchanged while pending");
  media.states.set(clip.assetId, "failed");
  assert.deepEqual(await info.completePendingPublication("alice", "a"), { infoCardId: "a", title: "Signs with video", kind: "creator", status: "failed", code: "INFO_MEDIA_PROCESSING_FAILED" });
  const failed = await info.owner("alice", "a");
  assert.equal(failed.pendingPublication, undefined); assert.equal(failed.lastPublicationFailure?.revision, 3);
  assert.equal(failed.latestVersion, 1); assert.equal(failed.draft?.mediaItem?.assetId, clip.assetId, "the draft is preserved");
  assert.equal(await info.versions().countDocuments(), 1, "nothing is published without its media");
  // The failure stays visible on later checks until the draft changes.
  assert.equal((await info.completePendingPublication("alice", "a"))?.status, "failed");
  assert.deepEqual((await info.resumePendingPublications("alice")).map(state => state.status), ["failed"]);
  // A direct press on a failed video is refused rather than stored.
  await assert.rejects(info.publish("alice", "a", 3), { code: "INFO_MEDIA_PROCESSING_FAILED" });
  // Replacement path: another file clears the failure, and a press with ready media publishes.
  const replacement = video(); media.states.set(replacement.assetId, "ready");
  await info.save("alice", "a", 3, content(replacement, "Signs with video"), "private", await signInfoUpload(failed, replacement));
  assert.equal((await info.owner("alice", "a")).lastPublicationFailure, undefined);
  assert.equal((await info.publish("alice", "a", 4) as InfoPublication).version, 2);
  // A provider that no longer vouches for the video is a recorded failure too, never a publication.
  const other = video(); await creatorDraft(info, other, "b"); await info.publish("alice", "b", 1);
  media.states.set(other.assetId, "forbidden");
  assert.deepEqual(await info.completePendingPublication("alice", "b"), { infoCardId: "b", title: "Signs", kind: "creator", status: "failed", code: "INFO_MEDIA_NOT_READY_OR_UNPROTECTED" });
  assert.equal(await info.versions().countDocuments({ infoCardId: "b" }), 0);
});

test("editing after the request cancels it, so the outdated revision is never published", async () => {
  const { info, media } = await setup();
  const clip = video(); await creatorDraft(info, clip);
  await info.publish("alice", "a", 1);
  const root = await info.owner("alice", "a");
  await info.save("alice", "a", 1, { ...content(clip), title: "Edited" }, "private");
  assert.equal((await info.owner("alice", "a")).pendingPublication, undefined);
  media.states.set(clip.assetId, "ready");
  assert.equal(await info.completePendingPublication("alice", "a"), null);
  assert.equal(await info.versions().countDocuments(), 0);
  assert.deepEqual(await info.resumePendingPublications("alice"), []);
  // The user presses again after editing; ready media now publishes the edited revision.
  assert.equal((await info.publish("alice", "a", 2) as InfoPublication).content.title, "Edited");
  assert.equal(root.pendingPublication?.revision, 1);
  // An edit that lands while a completion is between its readiness check and its write wins as well.
  const late = video(); await creatorDraft(info, late, "b"); await info.publish("alice", "b", 1);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
  const gated = new InfoCardRepository(info.db, info.client, { async readiness() { entered(); await gate; return "ready" as const; } });
  const completing = gated.completePendingPublication("alice", "b"); await reached;
  await info.save("alice", "b", 1, { ...content(late), title: "Raced" }, "private"); release();
  assert.equal(await completing, null);
  assert.equal(await info.versions().countDocuments({ infoCardId: "b" }), 0);
});

test("resume is bounded to the owner and the interface scope, and reports confirmations", async () => {
  const { info, media } = await setup();
  const clip = video(); await creatorDraft(info, clip);
  await info.publish("alice", "a", 1);
  media.states.set(clip.assetId, "ready");
  assert.deepEqual(await info.resumePendingPublications("bob"), [], "another user never completes or sees the request");
  assert.equal((await info.owner("alice", "a")).pendingPublication?.revision, 1);
  const checks = media.checks;
  assert.deepEqual(await info.resumePendingPublications("alice", { kind: "personal" }), [], "out-of-scope interfaces leave it alone");
  assert.equal(media.checks, checks);
  assert.deepEqual(await info.resumePendingPublications("alice", CREATOR_INFO_FILTER), [{ infoCardId: "a", title: "Signs", kind: "creator", status: "published", version: 1 }]);
  assert.deepEqual(await info.resumePendingPublications("alice", CREATOR_INFO_FILTER), [], "a confirmation is reported once");
});

async function personalSetup() {
  const base = await setup(), { main, info } = base;
  await info.createSeries("alice", "s", "Basics");
  const card = { ...createDefaultCardContent([randomUUID(), randomUUID(), randomUUID()]), intro: { title: "Practice", description: null, mediaItem: null } };
  await main.createCardDraft("alice", card, "public", "main"); await main.publishCard("alice", "main", 0);
  const deck = await main.createDeckDraft("alice", { ...createDefaultDeckContent([]), title: "Practice Deck", cards: [{ cardTemplateId: "main" }] }, "public");
  await main.publishDeck("alice", deck.deckTemplateId, 0);
  await main.ensureDeckData("alice", deck.deckTemplateId, 1); await main.ensureCardData("alice", "main", 1);
  const context: PersonalInfoContext = { deckTemplateId: deck.deckTemplateId, version: 1, personalInfoRevision: 0 };
  return { ...base, context };
}

test("a Personal first Save waits for its video and attaches with the list revision current at completion", async () => {
  const { info, main, media, context } = await personalSetup();
  const clip = video();
  await info.createPersonal("alice", "note", "main", context);
  await info.save("alice", "note", 0, content(clip, "Video note"), "private", await signInfoUpload(await info.owner("alice", "note"), clip));
  assert.deepEqual(await info.savePersonal("alice", "note", 1, context), { status: "pending", infoCardId: "note", revision: 1 });
  const root = await info.owner("alice", "note");
  assert.deepEqual(root.pendingPublication?.context, { deckTemplateId: context.deckTemplateId, version: 1 });
  assert.equal((await main.getPersonalUser("alice"))!.cardsData[0].personalInfoCardIds, undefined, "not attached while pending");
  // Another note is saved meanwhile, moving the list revision on. The stored request is still valid.
  await info.createPersonal("alice", "other", "main", context);
  await info.save("alice", "other", 0, content(null, "Plain note"), "private");
  await info.savePersonal("alice", "other", 1, context);
  assert.equal((await main.getPersonalUser("alice"))!.cardsData[0].personalInfoRevision, 1);
  // Returning to the pouch for that Card resumes it: still processing, so it is reported as pending.
  const consultation = { mode: "working" as const, version: 1, deckTemplateId: context.deckTemplateId };
  const waiting = await resumingInfoConsultation(info, "alice", "main", consultation);
  assert.deepEqual(waiting.publications, [{ infoCardId: "note", title: "Video note", kind: "personal", status: "pending" }]);
  assert.deepEqual(waiting.entries.map(entry => entry.status === "available" ? entry.info.infoCardId : null), ["other"]);
  media.states.set(clip.assetId, "ready");
  const done = await resumingInfoConsultation(info, "alice", "main", consultation);
  assert.deepEqual(done.publications, [{ infoCardId: "note", title: "Video note", kind: "personal", status: "published", version: 1 }]);
  assert.deepEqual(done.entries.map(entry => entry.status === "available" ? entry.info.infoCardId : null).toSorted(), ["note", "other"], "the completed note appears");
  const source = (await main.getPersonalUser("alice"))!.cardsData[0];
  assert.deepEqual(source.personalInfoCardIds, ["other", "note"]); assert.equal(source.personalInfoRevision, 2);
  assert.ok(source.personalInfoCardAttachedAt?.note instanceof Date);
  const saved = await info.versions().findOne({ infoCardId: "note" });
  assert.equal(saved?.visibility, "private"); assert.equal(saved?.content.mediaItem?.assetId, clip.assetId);
  assert.equal(await info.versions().countDocuments({ infoCardId: "note" }), 1);
  assert.deepEqual(await info.personalAssociation("alice", "note"), { cardTemplateId: "main", personalInfoRevision: 2,
    personalInfoCardIds: ["other", "note"], personalInfoCardAttachedAt: source.personalInfoCardAttachedAt });
  // A direct Save still keeps its compare-and-set on the list revision.
  const third = video(); media.states.set(third.assetId, "ready");
  await info.createPersonal("alice", "third", "main", context);
  await info.save("alice", "third", 0, content(third, "Third"), "private", await signInfoUpload(await info.owner("alice", "third"), third));
  await assert.rejects(info.savePersonal("alice", "third", 1, context), { code: "STALE_PERSONAL_INFO_REVISION" });
});

test("a later Personal Save and a Personal failure use the same mechanism", async () => {
  const { info, main, media, context } = await personalSetup();
  await info.createPersonal("alice", "note", "main", context);
  await info.save("alice", "note", 0, content(null, "Note"), "private");
  await info.savePersonal("alice", "note", 1, context);
  const clip = video(), root = await info.owner("alice", "note");
  await info.save("alice", "note", 2, content(clip, "Note with video"), "private", await signInfoUpload(root, clip));
  assert.equal((await info.savePersonal("alice", "note", 3) as { status: string }).status, "pending");
  media.states.set(clip.assetId, "failed");
  assert.deepEqual((await info.resumePendingPublications("alice", { kind: "personal", originCardTemplateId: "main" })).map(state => [state.status, state.kind]), [["failed", "personal"]]);
  assert.equal((await info.owner("alice", "note")).latestVersion, 1, "the saved version is kept");
  assert.equal((await main.getPersonalUser("alice"))!.cardsData[0].personalInfoRevision, 1);
});
