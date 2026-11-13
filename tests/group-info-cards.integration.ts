import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { InfoCardRepository, createInfoCardIndexes } from "../src/lib/infoCards/repository";
import { mainInfoConsultation, resumingInfoConsultation } from "../src/lib/infoCards/queries";
import { authorizeInfoMedia, signInfoUpload, type InfoMediaReadiness } from "../src/lib/infoCards/media";
import type { InfoConsultationSnapshot, InfoDraft, InfoMedia, InfoPublication, InfoRoot } from "../src/lib/infoCards/model";

// Checkpoint 4.2: Personal Info Cards in Groups. A Follower contribution Info Card is created from Me as a
// kind "group" root, never touches CardData, and follows the Group media identity rules (contributionIdentity.ts).
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { process.env.SESSION_SECRET = "group-info-cards-disposable-test-only"; mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });

const draft = (title: string, mediaItem: InfoMedia | null = null): InfoDraft => ({ title, body: "Keep the sign with its number.", seriesId: "notes", mediaItem });
// alice administers Group A and Group B and follows both (dual role); bob and carol follow both.
async function fixture() {
  const f = await groupFixture(client, { followers: ["alice", "bob", "carol"] }); await createInfoCardIndexes(f.cards.db);
  let video: InfoMediaReadiness = "ready";
  const info = new InfoCardRepository(f.cards.db, client, { async readiness() { return video; } });
  for (const actor of ["alice", "bob", "carol"]) await info.createSeries(actor, actor === "bob" ? "notes" : `notes-${actor}`, "Notes");
  await info.series().updateOne({ seriesId: "notes" }, { $set: { createdByUserId: "bob" } });
  const groupB = (await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "Group B" })).experienceId;
  const epoch = async (actor: string, experienceId = f.experienceId) => (await f.repo.members().findOne({ experienceId, userId: actor }))!.accessEpoch;
  const create = async (actor: string, experienceId = f.experienceId, changes: Record<string, unknown> = {}) => {
    const id = randomUUID();
    await info.createGroup(actor, id, experienceId, f.ids[0], { accessEpoch: await epoch(actor, experienceId), version: 1, creationContext: "self", ...changes });
    return id;
  };
  // A saved Follower contribution: created in Me, a draft saved, then the first Save publishes it privately.
  const note = async (actor: string, title: string, experienceId = f.experienceId) => {
    const id = await create(actor, experienceId);
    await info.save(actor, id, 0, actor === "bob" ? draft(title) : { ...draft(title), seriesId: `notes-${actor}` }, "private");
    await info.savePersonal(actor, id, 1);
    return id;
  };
  // bob also holds the Card in a standalone Deck, with a standalone Personal Info Card on it.
  await f.cards.ensureDeckData("bob", f.deckId, 1);
  const standaloneContext = { deckTemplateId: f.deckId, version: 1, personalInfoRevision: 0 };
  await info.createPersonal("bob", "bob-standalone", f.ids[0], standaloneContext);
  await info.save("bob", "bob-standalone", 0, draft("Standalone note"), "private");
  await info.savePersonal("bob", "bob-standalone", 1, standaloneContext);
  const me = (actor: string, experienceId = f.experienceId) => mainInfoConsultation(info, actor, f.ids[0], { mode: "experience", version: 1, experienceId });
  const standalone = (actor: string) => mainInfoConsultation(info, actor, f.ids[0], { mode: "working", version: 1, deckTemplateId: f.deckId });
  const canonical = (actor: string) => mainInfoConsultation(info, actor, f.ids[0], { mode: "canonical", version: 1 });
  const shown = (snapshot: InfoConsultationSnapshot) => snapshot.entries.flatMap(entry => entry.status === "available" ? [[entry.info.infoCardId, entry.source, entry.private ?? null] as const] : [])
    .toSorted((a, b) => a[0].localeCompare(b[0]));
  return { ...f, info, groupB, epoch, create, note, me, standalone, canonical, shown, setVideo: (value: InfoMediaReadiness) => { video = value; } };
}

test("creation from Me makes a Follower contribution that never writes CardData", async () => {
  const f = await fixture();
  const before = JSON.stringify(await f.cards.users().find({}).toArray());
  const id = await f.note("bob", "Group note");
  assert.equal(JSON.stringify(await f.cards.users().find({}).toArray()), before, "CardData is untouched");
  const root = await f.info.owner("bob", id);
  assert.equal(root.kind, "group"); assert.equal(root.creationContext, "self"); assert.equal(root.experienceId, f.experienceId);
  assert.equal(root.originCardTemplateId, f.ids[0]); assert.equal(root.groupVisible, true); assert.equal(root.visibility, "private");
  assert.equal(root.latestVersion, 1);
  const version = await f.info.versions().findOne({ infoCardId: id });
  assert.equal(version?.visibility, "private"); assert.equal(version?.content.title, "Group note");
  // Creation is idempotent for the same identity, and refuses a different origin.
  await f.info.createGroup("bob", "retry", f.experienceId, f.ids[0], { accessEpoch: await f.epoch("bob"), version: 1, creationContext: "self" });
  await f.info.createGroup("bob", "retry", f.experienceId, f.ids[0], { accessEpoch: await f.epoch("bob"), version: 1, creationContext: "self" });
  await assert.rejects(f.info.createGroup("bob", "retry", f.groupB, f.ids[0], { accessEpoch: await f.epoch("bob", f.groupB), version: 1, creationContext: "self" }), { code: "INFO_CREATE_RECOVERY_CONFLICT" });
  assert.equal(await f.info.roots().countDocuments({ infoCardId: "retry" }), 1);
});

test("the server authorises creation exactly as a Group media upload from Me", async () => {
  const f = await fixture();
  // Admin creation from the Group perspective is checkpoint 4.3; only the Follower identity exists here.
  await assert.rejects(f.create("alice", f.experienceId, { creationContext: "group" }), { code: "INFO_GROUP_PERSPECTIVE_FORBIDDEN" });
  await assert.rejects(f.create("bob", f.experienceId, { creationContext: "admin" }), { code: "INVALID_GROUP_MEDIA_PERSPECTIVE" });
  await assert.rejects(f.info.createGroup("outsider", randomUUID(), f.experienceId, f.ids[0], { accessEpoch: 0, version: 1, creationContext: "self" }), { code: "GROUP_FORBIDDEN" });
  const adminOnly = (await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "Admin only", followerIds: ["bob"] })).experienceId;
  await assert.rejects(f.create("alice", adminOnly), { code: "GROUP_MEDIA_PERSPECTIVE_FORBIDDEN" });
  await assert.rejects(f.create("bob", f.experienceId, { accessEpoch: 99 }), { code: "GROUP_ACCESS_CONFLICT" });
  await assert.rejects(f.create("bob", f.experienceId, { version: 2 }), { code: "GROUP_MEDIA_SCOPE_CONFLICT" });
  await assert.rejects(f.info.createGroup("bob", randomUUID(), f.experienceId, "not-in-group", { accessEpoch: 0, version: 1, creationContext: "self" }));
  assert.equal(await f.info.roots().countDocuments({ kind: "group" }), 0);
});

test("Me shows the author's Follower contributions from every Group and their standalone notes, with the private icon", async () => {
  const f = await fixture();
  const here = await f.note("bob", "Here"), elsewhere = await f.note("bob", "Elsewhere", f.groupB), hidden = await f.note("bob", "Hidden");
  await f.info.hideGroup("alice", f.experienceId, hidden, await f.epoch("alice"));
  assert.deepEqual(f.shown(await f.me("bob")), [
    ["bob-standalone", "personal", true], [elsewhere, "group", true], [hidden, "group", true], [here, "group", false],
  ].toSorted((a, b) => String(a[0]).localeCompare(String(b[0]))));
  // In Group B the same contributions read the other way round.
  const inB = new Map(f.shown(await f.me("bob", f.groupB)).map(([id, , value]) => [id, value]));
  assert.equal(inB.get(elsewhere), false); assert.equal(inB.get(here), true); assert.equal(inB.get("bob-standalone"), true);
  // Nobody else sees any of them: not another follower's Me, nor the canonical Group-perspective read.
  assert.deepEqual(f.shown(await f.me("carol")), []);
  assert.deepEqual(f.shown(await f.canonical("carol")), []);
  assert.deepEqual(f.shown(await f.canonical("bob")), []);
  // Me requires an active follower of that Group.
  await assert.rejects(f.me("outsider"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(mainInfoConsultation(f.info, "bob", f.ids[0], { mode: "experience", version: 2, experienceId: f.experienceId }), { code: "INFO_MAIN_VERSION_CONFLICT" });
});

test("the standalone Card shows standalone notes plus all Follower contributions, without the private icon", async () => {
  const f = await fixture();
  const a = await f.note("bob", "From A"), b = await f.note("bob", "From B", f.groupB);
  assert.deepEqual(f.shown(await f.standalone("bob")), [["bob-standalone", "personal", null], [a, "group", null], [b, "group", null]]
    .toSorted((x, y) => String(x[0]).localeCompare(String(y[0]))));
  const snapshot = await f.standalone("bob");
  assert.deepEqual(snapshot.personalSources, [{ cardTemplateId: f.ids[0], personalInfoRevision: 1 }], "the standalone list is unchanged by Group notes");
});

test("a dual-role user never sees Admin contributions in Me or on the standalone Card", async () => {
  const f = await fixture();
  const follower = await f.note("alice", "Alice as follower");
  // An Admin contribution root (created in the Group perspective, checkpoint 4.3), stored as the mapping defines.
  const now = new Date(), admin: InfoRoot = { infoCardId: "alice-admin", ownerUserId: "alice", kind: "group", originCardTemplateId: f.ids[0], experienceId: f.experienceId,
    creationContext: "group", groupVisible: true, visibility: "private", draftVisibility: "private", draft: null, latestVersion: 1, revision: 2, referenceRevision: 0, createdAt: now, updatedAt: now };
  await f.info.roots().insertOne({ ...admin });
  const followerVersion = (await f.info.versions().findOne({ infoCardId: follower }))!;
  await f.info.versions().insertOne({ ...followerVersion, _id: undefined, infoCardId: "alice-admin" } as InfoPublication);
  await f.cards.ensureDeckData("alice", f.deckId, 1);
  assert.deepEqual(f.shown(await f.me("alice")).map(([id]) => id), [follower]);
  assert.deepEqual(f.shown(await f.standalone("alice")).map(([id]) => id), [follower]);
  // The owner route acts as the Follower identity: it cannot reach the Admin contribution at all.
  await assert.rejects(f.info.owner("alice", "alice-admin"), { code: "INFO_FORBIDDEN" });
  await assert.rejects(f.info.delete("alice", "alice-admin", 2), { code: "INFO_FORBIDDEN" });
  await assert.rejects(f.info.save("alice", "alice-admin", 2, draft("Edited"), "private"), { code: "INFO_FORBIDDEN" });
});

test("only the author edits and deletes; admins hide without deleting", async () => {
  const f = await fixture();
  const id = await f.note("bob", "Bob note");
  // An admin, another follower and an outsider can neither read, edit nor delete it.
  for (const actor of ["alice", "carol", "outsider"]) {
    await assert.rejects(f.info.owner(actor, id), { code: "INFO_FORBIDDEN" });
    await assert.rejects(f.info.save(actor, id, 2, draft("Taken"), "private"), { code: "INFO_FORBIDDEN" });
    await assert.rejects(f.info.delete(actor, id, 2), { code: "INFO_FORBIDDEN" });
    await assert.rejects(authorizeInfoMedia(f.info, actor, { infoCardId: id, kind: "publication", version: 1 }), { code: "INFO_MEDIA_FORBIDDEN" });
  }
  // Hiding is admin-only, within the originating Group, and changes neither the draft nor the revision.
  await assert.rejects(f.info.hideGroup("bob", f.experienceId, id, await f.epoch("bob")), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.info.hideGroup("alice", f.groupB, id, await f.epoch("alice", f.groupB)), { code: "INFO_FORBIDDEN" });
  await assert.rejects(f.info.hideGroup("alice", f.experienceId, id, 99), { code: "GROUP_ACCESS_CONFLICT" });
  const before = await f.info.owner("bob", id);
  assert.deepEqual(await f.info.hideGroup("alice", f.experienceId, id, await f.epoch("alice")), { infoCardId: id, experienceId: f.experienceId, groupVisible: false });
  await f.info.hideGroup("alice", f.experienceId, id, await f.epoch("alice"));
  const hidden = await f.info.owner("bob", id);
  assert.equal(hidden.groupVisible, false); assert.equal(hidden.revision, before.revision); assert.equal(hidden.latestVersion, 1);
  // The author edits and deletes as the Follower identity, from Me or the standalone Card (the owner route).
  await f.info.save("bob", id, 2, draft("Bob note, edited"), "private");
  assert.equal((await f.info.savePersonal("bob", id, 3) as InfoPublication).version, 2);
  assert.deepEqual(await f.info.delete("bob", id, 4), { deleted: true });
  assert.deepEqual(f.shown(await f.me("bob")).map(([value]) => value), ["bob-standalone"]);
});

test("the first Save rechecks membership; a departed author keeps their own contribution", async () => {
  const f = await fixture();
  const unsaved = await f.create("bob"), saved = await f.note("bob", "Saved before leaving");
  await f.info.save("bob", unsaved, 0, draft("Unsaved"), "private");
  const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: e.structureRevision, targetUserId: "bob", kind: "remove-follower" });
  await assert.rejects(f.info.savePersonal("bob", unsaved, 1), { code: "GROUP_FORBIDDEN" });
  assert.equal((await f.info.owner("bob", unsaved)).latestVersion, 0, "nothing new becomes visible in a Group the author left");
  await assert.rejects(f.me("bob"), { code: "GROUP_FORBIDDEN" }, "Me is for active followers");
  // Their saved contribution is still theirs, on the standalone Card, where they can still delete it.
  assert.ok(f.shown(await f.standalone("bob")).some(([id]) => id === saved));
  assert.deepEqual(await f.info.delete("bob", saved, 2), { deleted: true });
});

test("a Save while the video processes uses the same pending publication and never writes CardData", async () => {
  const f = await fixture();
  const before = JSON.stringify(await f.cards.users().find({}).toArray());
  const id = await f.create("bob"), root = await f.info.owner("bob", id);
  const clip: InfoMedia = { id: "clip", provider: "cloudflare-stream", mediaType: "video", assetId: "group-clip", src: "https://iframe.videodelivery.net/group-clip", description: "Video" };
  await f.info.save("bob", id, 0, draft("With video", clip), "private", await signInfoUpload(root, clip));
  f.setVideo("processing");
  assert.deepEqual(await f.info.savePersonal("bob", id, 1), { status: "pending", infoCardId: id, revision: 1 });
  assert.deepEqual((await resumingInfoConsultation(f.info, "bob", f.ids[0], { mode: "experience", version: 1, experienceId: f.experienceId })).publications,
    [{ infoCardId: id, title: "With video", kind: "personal", status: "pending" }]);
  f.setVideo("ready");
  const done = await resumingInfoConsultation(f.info, "bob", f.ids[0], { mode: "experience", version: 1, experienceId: f.experienceId });
  assert.deepEqual(done.publications, [{ infoCardId: id, title: "With video", kind: "personal", status: "published", version: 1 }]);
  assert.ok(f.shown(done).some(([value]) => value === id), "the saved note appears in Me");
  assert.equal(JSON.stringify(await f.cards.users().find({}).toArray()), before);
  assert.equal(await f.info.personalAssociation("bob", id), null, "no standalone list is reported for a Group note");
});

test("unsaved Group notes are recoverable from My Drafts and owner media delivery works", async () => {
  const f = await fixture();
  const id = await f.create("bob");
  await f.info.save("bob", id, 0, draft("Draft in Me"), "private");
  assert.ok((await f.info.drafts("bob")).items.some(item => item.infoCardId === id));
  assert.ok(!(await f.info.drafts("alice")).items.some(item => item.infoCardId === id));
  const image: InfoMedia = { id: "image", provider: "cloudflare-r2", mediaType: "image", assetId: `info-cards/bob/${id}/a.png`, src: "https://private.invalid/a.png", description: "Image" };
  await f.info.save("bob", id, 1, draft("Draft in Me", image), "private", await signInfoUpload(await f.info.owner("bob", id), image));
  assert.equal((await authorizeInfoMedia(f.info, "bob", { infoCardId: id, kind: "draft", revision: 2 })).assetId, image.assetId);
});
