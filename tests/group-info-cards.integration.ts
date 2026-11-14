import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { InfoCardRepository, createInfoCardIndexes } from "../src/lib/infoCards/repository";
import { groupDraftAccess, mainInfoConsultation, resumingInfoConsultation } from "../src/lib/infoCards/queries";
import { authorizeInfoMedia, createInfoUpload, signInfoUpload, type InfoMediaReadiness } from "../src/lib/infoCards/media";
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
  const setAdmin = async (target: string, isAdmin: boolean) => {
    const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
    await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: e.structureRevision, targetUserId: target, kind: "set-admin", isAdmin });
  };
  const membership = async (target: string, kind: "add-follower" | "remove-follower") => {
    const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
    await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: e.structureRevision, targetUserId: target, kind });
  };
  return { ...f, info, groupB, epoch, create, note, me, standalone, canonical, shown, membership, setAdmin, setVideo: (value: InfoMediaReadiness) => { video = value; } };
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

test("the server authorises creation exactly as a Group media upload from the same perspective", async () => {
  const f = await fixture();
  // Checkpoint 4.3: an Admin contribution comes only from a current admin; a follower-only user has no Admin identity.
  await assert.rejects(f.create("bob", f.experienceId, { creationContext: "group" }), { code: "GROUP_MEDIA_PERSPECTIVE_FORBIDDEN" });
  await assert.rejects(f.create("bob", f.experienceId, { creationContext: "admin" }), { code: "INVALID_GROUP_MEDIA_PERSPECTIVE" });
  await assert.rejects(f.info.createGroup("outsider", randomUUID(), f.experienceId, f.ids[0], { accessEpoch: 0, version: 1, creationContext: "self" }), { code: "GROUP_FORBIDDEN" });
  const adminOnly = (await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "Admin only", followerIds: ["bob"] })).experienceId;
  await assert.rejects(f.create("alice", adminOnly), { code: "GROUP_MEDIA_PERSPECTIVE_FORBIDDEN" });
  await assert.rejects(f.create("bob", f.experienceId, { accessEpoch: 99 }), { code: "GROUP_ACCESS_CONFLICT" });
  await assert.rejects(f.create("bob", f.experienceId, { version: 2 }), { code: "GROUP_MEDIA_SCOPE_CONFLICT" });
  await assert.rejects(f.info.createGroup("bob", randomUUID(), f.experienceId, "not-in-group", { accessEpoch: 0, version: 1, creationContext: "self" }));
  assert.equal(await f.info.roots().countDocuments({ kind: "group" }), 0);
  // An admin who is not a follower creates Admin contributions only.
  assert.equal((await f.info.owner("alice", await f.create("alice", adminOnly, { creationContext: "group" }))).creationContext, "group");
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

test("a dual-role user sees Admin contributions in Me only as Group content, never on the standalone Card", async () => {
  const f = await fixture();
  const follower = await f.note("alice", "Alice as follower");
  // An Admin contribution root (created in the Group perspective, checkpoint 4.3), stored as the mapping defines.
  const now = new Date(), admin: InfoRoot = { infoCardId: "alice-admin", ownerUserId: "alice", kind: "group", originCardTemplateId: f.ids[0], experienceId: f.experienceId,
    creationContext: "group", groupVisible: true, visibility: "private", draftVisibility: "private", draft: null, latestVersion: 1, revision: 2, referenceRevision: 0, createdAt: now, updatedAt: now };
  await f.info.roots().insertOne({ ...admin });
  const followerVersion = (await f.info.versions().findOne({ infoCardId: follower }))!;
  await f.info.versions().insertOne({ ...followerVersion, _id: undefined, infoCardId: "alice-admin" } as InfoPublication);
  await f.cards.ensureDeckData("alice", f.deckId, 1);
  // Since V1 (checkpoint 4.5) Me also shows the Group's Admin contributions, as Group content with no visibility
  // marker; it is never mixed into the author's Follower identity, and never reaches the standalone Card.
  assert.deepEqual(f.shown(await f.me("alice")).map(([id]) => id).toSorted(), [follower, "alice-admin"].toSorted());
  const adminInMe = (await f.me("alice")).entries.find(entry => entry.status === "available" && entry.info.infoCardId === "alice-admin");
  assert.ok(adminInMe?.status === "available" && adminInMe.info.creationContext === "group" && adminInMe.private === undefined);
  assert.deepEqual(f.shown(await f.standalone("alice")).map(([id]) => id), [follower]);
  // Checkpoint 4.3: its author reads it, and writes it only while a current admin of its Group (manageable, C1).
  assert.equal((await f.info.owner("alice", "alice-admin")).creationContext, "group");
  await f.setAdmin("bob", true); await f.setAdmin("alice", false);
  await assert.rejects(f.info.save("alice", "alice-admin", 2, draft("Edited"), "private"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.info.delete("alice", "alice-admin", 2), { code: "GROUP_FORBIDDEN" });
  const afterDemotion = (await f.me("alice")).entries.find(entry => entry.status === "available" && entry.info.infoCardId === "alice-admin");
  assert.ok(afterDemotion?.status === "available" && afterDemotion.info.creationContext === "group" && afterDemotion.private === undefined, "demotion never reclassifies");
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
  // The author edits and deletes as the Follower identity while an active follower of its Group (C1: from Me of
  // that Group; the interface offers Edit and Remove nowhere else).
  await f.info.save("bob", id, 2, draft("Bob note, edited"), "private");
  assert.equal((await f.info.savePersonal("bob", id, 3) as InfoPublication).version, 2);
  assert.deepEqual(await f.info.delete("bob", id, 4), { deleted: true });
  assert.deepEqual(f.shown(await f.me("bob")).map(([value]) => value), ["bob-standalone"]);
});

// Checkpoint 4.2b (C4): leaving the Group ends editing and deletion of its Follower contributions; the saved
// contribution stays visible where the visibility rules allow, and rejoining restores management.
test("the first Save rechecks membership; a departed author can no longer edit or delete until rejoining", async () => {
  const f = await fixture();
  const unsaved = await f.create("bob"), saved = await f.note("bob", "Saved before leaving");
  await f.info.save("bob", unsaved, 0, draft("Unsaved"), "private");
  const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: e.structureRevision, targetUserId: "bob", kind: "remove-follower" });
  await assert.rejects(f.info.savePersonal("bob", unsaved, 1), { code: "GROUP_FORBIDDEN" });
  assert.equal((await f.info.owner("bob", unsaved)).latestVersion, 0, "nothing new becomes visible in a Group the author left");
  await assert.rejects(f.me("bob"), { code: "GROUP_FORBIDDEN" }, "Me is for active followers");
  // Their saved contribution stays visible on the standalone Card, but is no longer theirs to edit or delete.
  assert.ok(f.shown(await f.standalone("bob")).some(([id]) => id === saved));
  await assert.rejects(f.info.save("bob", unsaved, 1, draft("Unsaved, edited"), "private"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.info.save("bob", saved, 2, draft("Edited after leaving"), "private"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.info.delete("bob", saved, 2), { code: "GROUP_FORBIDDEN" });
  assert.equal((await f.info.owner("bob", saved)).revision, 2, "nothing changed");
  await f.membership("bob", "add-follower");
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

// Checkpoint 4.2b: every Info Card write is authorised from the creation context stored on the record
// (InfoCardRepository.manageable), never from anything the client declares.
test("every write checks the author's current role in the stored creation context and fences the membership", async () => {
  const f = await fixture();
  const id = await f.create("bob");
  const fence = async () => (await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }))!.writeFence ?? 0;
  const before = await fence();
  await f.info.save("bob", id, 0, draft("Autosaved in Me"), "private");
  assert.ok(await fence() > before, "autosave fences the current membership record");
  // Only the author: another follower, an admin and an outsider are refused.
  for (const actor of ["carol", "alice", "outsider"]) await assert.rejects(f.info.save(actor, id, 1, draft("Taken"), "private"), { code: "INFO_FORBIDDEN" });
  // Leaving refuses autosave, Save, upload and Remove; nothing is written and no provider upload is created.
  await f.membership("bob", "remove-follower");
  await assert.rejects(f.info.save("bob", id, 1, draft("After leaving"), "private"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.info.savePersonal("bob", id, 1), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(createInfoUpload(f.info, "bob", id, "image", "image/png"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.info.delete("bob", id, 1), { code: "GROUP_FORBIDDEN" });
  const root = await f.info.owner("bob", id);
  assert.equal(root.revision, 1); assert.equal(root.draft?.title, "Autosaved in Me"); assert.equal(root.latestVersion, 0);
  // Rejoining restores every write, and the first Save still checks the Card is selected in the Group.
  await f.membership("bob", "add-follower");
  await f.info.save("bob", id, 1, draft("After rejoining"), "private");
  assert.equal((await f.info.savePersonal("bob", id, 2) as InfoPublication).version, 1);
  // Standalone Personal Info Cards keep their owner-only rule, with no Group involved.
  await f.info.save("bob", "bob-standalone", 2, draft("Standalone, edited"), "private");
});

test("a pending Save completes only while the author can act in the creation context, and fails after leaving", async () => {
  const f = await fixture();
  const clip: InfoMedia = { id: "clip", provider: "cloudflare-stream", mediaType: "video", assetId: "leaving-clip", src: "https://iframe.videodelivery.net/leaving-clip", description: "Video" };
  const id = await f.create("bob");
  await f.info.save("bob", id, 0, draft("Pending when leaving", clip), "private", await signInfoUpload(await f.info.owner("bob", id), clip));
  f.setVideo("processing");
  assert.deepEqual(await f.info.savePersonal("bob", id, 1), { status: "pending", infoCardId: id, revision: 1 });
  assert.deepEqual(await f.info.completePendingPublication("bob", id), { infoCardId: id, title: "Pending when leaving", kind: "personal", status: "pending" });
  await f.membership("bob", "remove-follower");
  // Failed at once, without waiting for the video, and recorded so every interface shows it.
  assert.deepEqual(await f.info.completePendingPublication("bob", id), { infoCardId: id, title: "Pending when leaving", kind: "personal", status: "failed", code: "GROUP_FORBIDDEN" });
  f.setVideo("ready");
  assert.deepEqual(await f.info.resumePendingPublications("bob"), [{ infoCardId: id, title: "Pending when leaving", kind: "personal", status: "failed", code: "GROUP_FORBIDDEN" }]);
  const root = await f.info.owner("bob", id);
  assert.equal(root.pendingPublication, undefined); assert.equal(root.lastPublicationFailure?.code, "GROUP_FORBIDDEN"); assert.equal(root.latestVersion, 0);
  assert.equal(await f.info.versions().countDocuments({ infoCardId: id }), 0, "no version is created");
});

test("My Drafts lists only unsaved Group drafts the author can still continue, identified by their Group", async () => {
  const f = await fixture();
  const unsaved = await f.create("bob"), saved = await f.note("bob", "Saved note"), otherGroup = await f.create("bob", f.groupB);
  await f.info.save("bob", unsaved, 0, draft("Unsaved in A"), "private");
  await f.info.save("bob", otherGroup, 0, draft("Unsaved in B"), "private");
  await f.info.save("bob", saved, 2, draft("Saved note, unsaved edit"), "private");
  const listed = async () => { const page = await f.info.drafts("bob"); return { ids: page.items.map(item => item.infoCardId), names: page.groupNames ?? {} }; };
  let page = await listed();
  assert.ok(page.ids.includes(unsaved) && page.ids.includes(otherGroup));
  assert.ok(!page.ids.includes(saved), "a saved Group note with unsaved edits is continued in its creation context, not My Drafts");
  assert.equal(page.names[f.groupB], "Group B");
  assert.ok(page.ids.includes("bob-standalone") === false, "a clean standalone note is not a draft");
  // Opening from My Drafts: editable only while unsaved and the author can act in the creation context.
  const name = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!.name;
  assert.deepEqual(await groupDraftAccess(f.info, "bob", await f.info.owner("bob", unsaved)), { origin: `${name} · Me`, editable: true });
  assert.deepEqual(await groupDraftAccess(f.info, "bob", await f.info.owner("bob", saved)), { origin: `${name} · Me`, editable: false });
  // After leaving Group A its draft leaves My Drafts and cannot be continued; Group B is unaffected.
  await f.membership("bob", "remove-follower");
  page = await listed();
  assert.ok(!page.ids.includes(unsaved) && page.ids.includes(otherGroup));
  assert.deepEqual(await groupDraftAccess(f.info, "bob", await f.info.owner("bob", unsaved)), { origin: `${name} · Me`, editable: false });
  assert.equal((await f.info.owner("bob", unsaved)).draft?.title, "Unsaved in A", "the draft itself is retained");
  await f.membership("bob", "add-follower");
  assert.ok((await listed()).ids.includes(unsaved));
});

test("the author's Group contributions carry their originating Group name for the menu origin", async () => {
  const f = await fixture();
  const inA = await f.note("bob", "In A"), inB = await f.note("bob", "In B", f.groupB);
  const name = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!.name;
  for (const snapshot of [await f.me("bob"), await f.standalone("bob")]) {
    const originName = (id: string) => snapshot.entries.flatMap(entry => entry.status === "available" && entry.info.infoCardId === id ? [entry] : [])[0]?.originName;
    assert.equal(originName(inA), name);
    assert.equal(originName(inB), "Group B");
    assert.equal(originName("bob-standalone"), undefined, "only Group contributions carry a Group name");
  }
});
