import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { InfoCardRepository, createInfoCardIndexes } from "../src/lib/infoCards/repository";
import { groupDraftAccess, mainInfoConsultation, resumingInfoConsultation } from "../src/lib/infoCards/queries";
import { authorizeInfoMedia, signInfoUpload, type InfoMediaReadiness } from "../src/lib/infoCards/media";
import type { InfoConsultationSnapshot, InfoDraft, InfoMedia, InfoPublication } from "../src/lib/infoCards/model";

// Checkpoint 4.3: Group Info Cards in the Group perspective. An Admin contribution (creationContext "group") is
// created by a current admin in the Group perspective and belongs only to that Group perspective; the Group
// perspective also shows the Follower contributions shared with the Group, exactly as the Group media feed does.
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { process.env.SESSION_SECRET = "group-admin-info-cards-disposable-test-only"; mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });

const draft = (title: string, seriesId: string, mediaItem: InfoMedia | null = null): InfoDraft => ({ title, body: "Shared with the squad.", seriesId, mediaItem });
// alice administers Group A and Group B and follows both (dual role); bob and carol follow both.
async function fixture() {
  const f = await groupFixture(client, { followers: ["alice", "bob", "carol"] }); await createInfoCardIndexes(f.cards.db);
  let video: InfoMediaReadiness = "ready";
  const info = new InfoCardRepository(f.cards.db, client, { async readiness() { return video; } });
  for (const actor of ["alice", "bob", "carol"]) await info.createSeries(actor, `notes-${actor}`, "Notes");
  const groupB = (await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "Group B" })).experienceId;
  const epoch = async (actor: string, experienceId = f.experienceId) => (await f.repo.members().findOne({ experienceId, userId: actor }))!.accessEpoch;
  const create = async (actor: string, creationContext: "self" | "group", experienceId = f.experienceId) => {
    const id = randomUUID();
    await info.createGroup(actor, id, experienceId, f.ids[0], { accessEpoch: await epoch(actor, experienceId), version: 1, creationContext });
    return id;
  };
  // A saved contribution: created, a draft autosaved, then the first Save publishes it privately.
  const saved = async (actor: string, creationContext: "self" | "group", title: string, experienceId = f.experienceId) => {
    const id = await create(actor, creationContext, experienceId);
    await info.save(actor, id, 0, draft(title, `notes-${actor}`), "private");
    await info.savePersonal(actor, id, 1);
    return id;
  };
  await f.repo.experiences().updateOne({ experienceId: f.experienceId }, { $set: { allowFollowerInspection: true } });
  // bob also holds the Card in a standalone Deck, with a standalone Personal Info Card on it.
  await f.cards.ensureDeckData("bob", f.deckId, 1);
  const standaloneContext = { deckTemplateId: f.deckId, version: 1, personalInfoRevision: 0 };
  await info.createPersonal("bob", "bob-standalone", f.ids[0], standaloneContext);
  await info.save("bob", "bob-standalone", 0, draft("Standalone note", "notes-bob"), "private");
  await info.savePersonal("bob", "bob-standalone", 1, standaloneContext);
  await f.cards.ensureDeckData("alice", f.deckId, 1);
  const group = (actor: string, experienceId = f.experienceId, subjectUserId?: string) =>
    mainInfoConsultation(info, actor, f.ids[0], { mode: "group", version: 1, experienceId, ...(subjectUserId ? { subjectUserId } : {}) });
  const me = (actor: string, experienceId = f.experienceId) => mainInfoConsultation(info, actor, f.ids[0], { mode: "experience", version: 1, experienceId });
  const standalone = (actor: string) => mainInfoConsultation(info, actor, f.ids[0], { mode: "working", version: 1, deckTemplateId: f.deckId });
  const shownIds = (snapshot: InfoConsultationSnapshot) => snapshot.entries.flatMap(entry => entry.status === "available" ? [entry.info.infoCardId] : []).toSorted();
  const change = async (target: string, command: { kind: "set-admin"; isAdmin: boolean } | { kind: "add-follower" | "remove-follower" }) => {
    const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
    await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: e.structureRevision, targetUserId: target, ...command });
  };
  return { ...f, info, groupB, epoch, create, saved, group, me, standalone, shownIds, change, setVideo: (value: InfoMediaReadiness) => { video = value; } };
}

test("a current admin creates, autosaves and saves an Admin Info Card in the Group perspective, never touching CardData", async () => {
  const f = await fixture();
  const before = JSON.stringify(await f.cards.users().find({}).toArray());
  const id = await f.create("alice", "group");
  await f.info.save("alice", id, 0, draft("Squad plan", "notes-alice"), "private");
  assert.equal((await f.info.owner("alice", id)).draft?.title, "Squad plan", "autosaved as a draft");
  assert.equal((await f.info.savePersonal("alice", id, 1) as InfoPublication).version, 1);
  const root = await f.info.owner("alice", id);
  assert.deepEqual({ kind: root.kind, creationContext: root.creationContext, experienceId: root.experienceId, originCardTemplateId: root.originCardTemplateId,
    groupVisible: root.groupVisible, visibility: root.visibility, latestVersion: root.latestVersion, draft: root.draft },
  { kind: "group", creationContext: "group", experienceId: f.experienceId, originCardTemplateId: f.ids[0], groupVisible: true, visibility: "private", latestVersion: 1, draft: null });
  assert.equal(JSON.stringify(await f.cards.users().find({}).toArray()), before, "CardData is untouched");
  assert.equal(await f.info.personalAssociation("alice", id), null);
  // Follower creation stays in Me, and a follower-only user has no Admin identity.
  await assert.rejects(f.create("bob", "group"), { code: "GROUP_MEDIA_PERSPECTIVE_FORBIDDEN" });
  assert.equal((await f.info.owner("bob", await f.create("bob", "self"))).creationContext, "self");
  // The stored identity is immutable: a retried creation cannot change it.
  const retry = randomUUID();
  await f.info.createGroup("alice", retry, f.experienceId, f.ids[0], { accessEpoch: await f.epoch("alice"), version: 1, creationContext: "group" });
  await assert.rejects(f.info.createGroup("alice", retry, f.experienceId, f.ids[0], { accessEpoch: await f.epoch("alice"), version: 1, creationContext: "self" }), { code: "INFO_CREATE_RECOVERY_CONFLICT" });
});

test("an Admin contribution appears only in the Group perspective of its originating Group", async () => {
  const f = await fixture();
  const admin = await f.saved("alice", "group", "Admin note"), aliceFollower = await f.saved("alice", "self", "Alice as follower");
  // Every member sees it in the Group perspective, alongside the Follower contributions shared with the Group.
  for (const viewer of ["alice", "bob", "carol"]) assert.deepEqual(f.shownIds(await f.group(viewer)), [admin, aliceFollower].toSorted(), viewer);
  // Never on the standalone Card, in Me, in another Group, or when inspecting the admin as a follower.
  assert.ok(!f.shownIds(await f.standalone("alice")).includes(admin));
  assert.ok(!f.shownIds(await f.me("alice")).includes(admin));
  assert.ok(!f.shownIds(await f.group("alice", f.groupB)).includes(admin));
  assert.ok(!f.shownIds(await f.me("alice", f.groupB)).includes(admin));
  assert.deepEqual(f.shownIds(await f.group("bob", f.experienceId, "alice")), [aliceFollower], "inspection lists Follower contributions only");
  assert.ok(!f.shownIds(await mainInfoConsultation(f.info, "bob", f.ids[0], { mode: "canonical", version: 1 })).includes(admin));
  // The entry names its Group, and the snapshot says whether the viewer may hide.
  const entry = (await f.group("bob")).entries.find(item => item.status === "available" && item.info.infoCardId === admin);
  assert.ok(entry?.status === "available" && entry.source === "group" && entry.info.creationContext === "group" && entry.private === undefined);
  assert.equal(entry?.status === "available" ? entry.originName : undefined, (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!.name);
  assert.equal((await f.group("alice")).canHide, true); assert.equal((await f.group("bob")).canHide, false);
});

test("Follower contributions appear in their originating Group perspective under the Group sharing and hiding rules", async () => {
  const f = await fixture();
  const inA = await f.saved("bob", "self", "Bob in A"), inB = await f.saved("bob", "self", "Bob in B", f.groupB), hidden = await f.saved("carol", "self", "Carol hidden");
  await f.info.hideGroup("alice", f.experienceId, hidden, await f.epoch("alice"));
  assert.deepEqual(f.shownIds(await f.group("carol")), [inA]);
  assert.deepEqual(f.shownIds(await f.group("carol", f.groupB)), [inB]);
  // Standalone Personal Info Cards never reach the Group perspective or inspection.
  for (const snapshot of [await f.group("carol"), await f.group("carol", f.experienceId, "bob"), await f.group("bob")]) assert.ok(!f.shownIds(snapshot).includes("bob-standalone"));
  // Inspection shows only that follower's shared Follower contributions, where the Group allows it.
  assert.deepEqual(f.shownIds(await f.group("carol", f.experienceId, "bob")), [inA]);
  assert.deepEqual(f.shownIds(await f.group("bob", f.experienceId, "carol")), [], "a hidden contribution is not shared");
  await assert.rejects(f.group("carol", f.groupB, "bob"), { code: "GROUP_FORBIDDEN" }, "Group B does not allow inspection");
  await assert.rejects(f.group("outsider"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.group("carol", f.experienceId, "outsider"), { code: "GROUP_FORBIDDEN" });
  // Former members' contributions stay in their Group perspective, as Group media do.
  await f.change("bob", { kind: "remove-follower" });
  assert.deepEqual(f.shownIds(await f.group("carol")), [inA]);
});

test("members receive the media of a contribution shared with their Group; nobody else does", async () => {
  const f = await fixture();
  const id = await f.create("alice", "group");
  const image: InfoMedia = { id: "image", provider: "cloudflare-r2", mediaType: "image", assetId: `info-cards/alice/${id}/a.png`, src: "https://private.invalid/a.png", description: "Image" };
  await f.info.save("alice", id, 0, draft("With image", "notes-alice", image), "private", await signInfoUpload(await f.info.owner("alice", id), image));
  await f.info.savePersonal("alice", id, 1);
  const read = (actor: string, experienceId?: string) => authorizeInfoMedia(f.info, actor, { infoCardId: id, kind: "publication", version: 1, ...(experienceId ? { experienceId } : {}) });
  assert.equal((await read("carol", f.experienceId)).assetId, image.assetId);
  assert.equal((await read("alice")).assetId, image.assetId, "the owner as before");
  await assert.rejects(read("carol"), { code: "INFO_MEDIA_FORBIDDEN" }, "without the Group, a private note reaches its owner only");
  await assert.rejects(read("carol", f.groupB), { code: "INFO_MEDIA_FORBIDDEN" });
  await assert.rejects(read("outsider", f.experienceId), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(authorizeInfoMedia(f.info, "carol", { infoCardId: id, kind: "draft", revision: 2 }), { code: "INFO_MEDIA_FORBIDDEN" });
  await f.info.hideGroup("alice", f.experienceId, id, await f.epoch("alice"));
  await assert.rejects(read("carol", f.experienceId), { code: "INFO_MEDIA_FORBIDDEN" }, "a hidden contribution is no longer shared");
});

test("only the author edits and permanently removes; any current admin hides without deleting", async () => {
  const f = await fixture();
  await f.change("bob", { kind: "set-admin", isAdmin: true });
  const admin = await f.saved("alice", "group", "Alice admin note"), carol = await f.saved("carol", "self", "Carol note");
  // Another admin, a follower and an outsider can neither edit nor remove it.
  for (const actor of ["bob", "carol", "outsider"]) {
    await assert.rejects(f.info.save(actor, admin, 2, draft("Taken", `notes-${actor}`), "private"), { code: "INFO_FORBIDDEN" });
    await assert.rejects(f.info.delete(actor, admin, 2), { code: "INFO_FORBIDDEN" });
  }
  // Hide: any current admin, for any contribution of their Group, their own included. It never deletes.
  for (const [actor, id] of [["bob", admin], ["alice", carol]] as const) await f.info.hideGroup(actor, f.experienceId, id, await f.epoch(actor));
  await assert.rejects(f.info.hideGroup("carol", f.experienceId, admin, await f.epoch("carol")), { code: "GROUP_FORBIDDEN" });
  for (const [owner, id] of [["alice", admin], ["carol", carol]] as const) {
    const root = await f.info.owner(owner, id);
    assert.equal(root.groupVisible, false); assert.equal(root.deletedAt, undefined); assert.equal(root.latestVersion, 1);
  }
  assert.deepEqual(f.shownIds(await f.group("bob")), []);
  // The author still edits and permanently removes their own, in its creation context.
  await f.info.save("alice", admin, 2, draft("Alice admin note, edited", "notes-alice"), "private");
  assert.equal((await f.info.savePersonal("alice", admin, 3) as InfoPublication).version, 2);
  assert.deepEqual(await f.info.delete("alice", admin, 4), { deleted: true });
  assert.ok((await f.info.roots().findOne({ infoCardId: admin }))?.deletedAt instanceof Date);
  assert.equal(await f.info.versions().countDocuments({ infoCardId: admin }), 0, "Remove is permanent");
});

test("losing the admin role ends management of Admin contributions until it is restored; visibility is unchanged", async () => {
  const f = await fixture();
  const admin = await f.saved("alice", "group", "Admin note"), unsaved = await f.create("alice", "group");
  await f.info.save("alice", unsaved, 0, draft("Unsaved admin draft", "notes-alice"), "private");
  await f.change("bob", { kind: "set-admin", isAdmin: true });
  await f.change("alice", { kind: "set-admin", isAdmin: false });
  await assert.rejects(f.info.save("alice", admin, 2, draft("After demotion", "notes-alice"), "private"), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.info.delete("alice", admin, 2), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(f.info.savePersonal("alice", unsaved, 1), { code: "GROUP_FORBIDDEN" });
  assert.ok(f.shownIds(await f.group("carol")).includes(admin), "still shown in its Group perspective");
  assert.ok(!f.shownIds(await f.me("alice")).includes(admin), "demotion never reclassifies it into Me");
  // Promoted again, alice manages it again.
  const e = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  await f.repo.changeMember("bob", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: e.structureRevision, targetUserId: "alice", kind: "set-admin", isAdmin: true });
  assert.deepEqual(await f.info.delete("alice", admin, 2), { deleted: true });
});

test("unsaved Admin drafts are listed in My Drafts as Group drafts, reopen directly and leave the list once saved", async () => {
  const f = await fixture();
  const name = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!.name;
  const unsaved = await f.create("alice", "group"), saved = await f.saved("alice", "group", "Saved admin note");
  await f.info.save("alice", unsaved, 0, draft("Admin draft", "notes-alice"), "private");
  await f.info.save("alice", saved, 2, draft("Saved admin note, unsaved edit", "notes-alice"), "private");
  const page = await f.info.drafts("alice");
  const listed = page.items.map(item => item.infoCardId);
  assert.ok(listed.includes(unsaved)); assert.ok(!listed.includes(saved), "a saved Group Info Card is continued in its Group perspective");
  assert.equal(page.groupNames?.[f.experienceId], name);
  assert.deepEqual(await groupDraftAccess(f.info, "alice", await f.info.owner("alice", unsaved)), { origin: `${name} · Group`, editable: true });
  assert.deepEqual(await groupDraftAccess(f.info, "alice", await f.info.owner("alice", saved)), { origin: `${name} · Group`, editable: false });
  assert.ok(!(await f.info.drafts("bob")).items.some(item => item.infoCardId === unsaved), "the author's drafts only");
  // Saving from My Drafts uses the existing Save, after which it leaves the list.
  await f.info.savePersonal("alice", unsaved, 1);
  assert.ok(!(await f.info.drafts("alice")).items.some(item => item.infoCardId === unsaved));
  // After demotion, an unsaved Admin draft leaves My Drafts and cannot be continued.
  const later = await f.create("alice", "group");
  await f.info.save("alice", later, 0, draft("Later draft", "notes-alice"), "private");
  await f.change("bob", { kind: "set-admin", isAdmin: true }); await f.change("alice", { kind: "set-admin", isAdmin: false });
  assert.ok(!(await f.info.drafts("alice")).items.some(item => item.infoCardId === later));
  assert.equal((await groupDraftAccess(f.info, "alice", await f.info.owner("alice", later))).editable, false);
});

test("a pending Admin Save completes from the Group perspective exactly once, and fails after the admin role is lost", async () => {
  const f = await fixture();
  const clip = (asset: string): InfoMedia => ({ id: asset, provider: "cloudflare-stream", mediaType: "video", assetId: asset, src: `https://iframe.videodelivery.net/${asset}`, description: "Video" });
  const id = await f.create("alice", "group");
  await f.info.save("alice", id, 0, draft("Admin video", "notes-alice", clip("admin-clip")), "private", await signInfoUpload(await f.info.owner("alice", id), clip("admin-clip")));
  f.setVideo("processing");
  assert.deepEqual(await f.info.savePersonal("alice", id, 1), { status: "pending", infoCardId: id, revision: 1 });
  const groupView = () => resumingInfoConsultation(f.info, "alice", f.ids[0], { mode: "group", version: 1, experienceId: f.experienceId });
  assert.deepEqual((await groupView()).publications, [{ infoCardId: id, title: "Admin video", kind: "personal", status: "pending" }]);
  f.setVideo("ready");
  const [first, second] = await Promise.all([groupView(), groupView()]);
  const outcomes = [first, second].flatMap(view => view.publications ?? []);
  assert.ok(outcomes.some(state => state.status === "published"));
  assert.equal(await f.info.versions().countDocuments({ infoCardId: id }), 1, "no duplicate version");
  assert.ok(f.shownIds(await f.group("carol")).includes(id), "the saved card appears in the Group perspective");
  // Another viewer's Group perspective never completes someone else's request.
  const other = await f.create("alice", "group");
  await f.info.save("alice", other, 0, draft("Other video", "notes-alice", clip("other-clip")), "private", await signInfoUpload(await f.info.owner("alice", other), clip("other-clip")));
  f.setVideo("processing"); await f.info.savePersonal("alice", other, 1); f.setVideo("ready");
  assert.equal((await resumingInfoConsultation(f.info, "carol", f.ids[0], { mode: "group", version: 1, experienceId: f.experienceId })).publications, undefined);
  // Losing the admin role fails the request on return, with no version.
  await f.change("bob", { kind: "set-admin", isAdmin: true }); await f.change("alice", { kind: "set-admin", isAdmin: false });
  assert.deepEqual((await groupView()).publications, [{ infoCardId: other, title: "Other video", kind: "personal", status: "failed", code: "GROUP_FORBIDDEN" }]);
  assert.equal(await f.info.versions().countDocuments({ infoCardId: other }), 0);
});

test("Creator Info Cards and standalone Personal Info Cards are unchanged", async () => {
  const f = await fixture();
  const admin = await f.saved("alice", "group", "Admin note");
  // The standalone Card still shows the standalone note and edits it through its CardData path.
  assert.deepEqual(f.shownIds(await f.standalone("bob")), ["bob-standalone"]);
  await f.info.save("bob", "bob-standalone", 2, draft("Standalone, edited", "notes-bob"), "private");
  assert.equal((await f.info.savePersonal("bob", "bob-standalone", 3) as InfoPublication).version, 2);
  // A Creator Info Card keeps its owner-only Publish path, with no Group involved.
  await f.info.create("carol", "creator-card");
  await f.info.save("carol", "creator-card", 0, draft("Creator card", "notes-carol"), "private");
  assert.equal((await f.info.publish("carol", "creator-card", 1) as InfoPublication).version, 1);
  await assert.rejects(f.info.savePersonal("carol", "creator-card", 2), { code: "INFO_FORBIDDEN" });
  assert.ok(!(await f.info.drafts("carol")).items.some(item => item.infoCardId === admin));
});
