import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { actingOrigin, identityRole, infoCardOrigin, mediaOrigin, originLabel, sameOrigin, STANDALONE_ORIGIN } from "../src/lib/groupExperiences/media/contributionIdentity";
import { mediaRemoveOperation, outsideCreationContext, type MediaCapabilities } from "../src/lib/mediaCollection/permissions";
import { mediaCentreCreatedIn } from "../src/lib/mediaCollection/centreMetadata";
import { fetchMediaCollection } from "../src/lib/mediaCollection/transport";
import type { MediaCollectionItem } from "../src/lib/mediaCollection/contracts";
import { buildInfoCardMenuLayout } from "../src/components/info-cards/infoCardMenuLayout";
import { loadInfoConsultation, type ConsultationRequest } from "../src/components/info-cards/infoCardConsultationClient";
import { loadCreatorDraftEntries } from "../src/components/creator/creatorDraftEntries";
import UserCardMediaUploadPanel from "../src/components/media/UserCardMediaUploadPanel";
import { initialUserCardMediaUploadState } from "../src/components/media/useKeyedUserCardMediaUploadController";
import type { InfoConsultationSnapshot, PublishedInfo } from "../src/lib/infoCards/model";
import type { ImageMediaItem } from "../src/lib/media";

// Checkpoint 4.2b (C1, C2): creation-context management. The pure rule lives in contributionIdentity.ts and is
// shared by the Media Centre, the Info Card menu and the server.

test("creation origins come from the stored record: standalone, Group A Me, Group A Group, and legacy records", () => {
  const personal = { source: { kind: "personal" as const, cardTemplateId: "card", mediaItemId: "m" } };
  assert.deepEqual(mediaOrigin(personal), STANDALONE_ORIGIN);
  assert.deepEqual(mediaOrigin(item("ann", "group")), { kind: "group", experienceId: "A", identity: "group" });
  // A record without creationContext predates 4.0 and reads as a Follower contribution.
  assert.deepEqual(mediaOrigin(item("ann")), { kind: "group", experienceId: "A", identity: "self" });
  assert.deepEqual(infoCardOrigin({ kind: "group", experienceId: "A", creationContext: "self" }), { kind: "group", experienceId: "A", identity: "self" });
  assert.deepEqual(infoCardOrigin({ kind: "personal" }), STANDALONE_ORIGIN);
  assert.deepEqual(infoCardOrigin({}), STANDALONE_ORIGIN);
  // Same Group and identity only: Group A and Group B differ, and so do Me and the Group perspective.
  const meA = actingOrigin("A", "self");
  assert.ok(sameOrigin({ kind: "group", experienceId: "A", identity: "self" }, meA));
  assert.ok(!sameOrigin({ kind: "group", experienceId: "B", identity: "self" }, meA));
  assert.ok(!sameOrigin({ kind: "group", experienceId: "A", identity: "group" }, meA));
  assert.ok(!sameOrigin(STANDALONE_ORIGIN, meA));
  assert.ok(sameOrigin(STANDALONE_ORIGIN, actingOrigin(undefined, "self")));
  assert.equal(identityRole("group"), "admin"); assert.equal(identityRole("self"), "follower");
  assert.equal(originLabel(STANDALONE_ORIGIN), "Personal Card");
  assert.equal(originLabel({ kind: "group", experienceId: "A", identity: "self" }, "Galway U18"), "Galway U18 · Me");
  assert.equal(originLabel({ kind: "group", experienceId: "A", identity: "group" }, "Galway U18"), "Galway U18 · Group");
  assert.equal(originLabel({ kind: "group", experienceId: "A", identity: "self" }, null), "Group unavailable · Me");
});

const caps = (canHideOthers: boolean): MediaCapabilities => ({ canUpload: false, canRemoveOwn: true, canHideOthers, canManage: true });
const item = (authorUserId: string, creationContext?: "self" | "group", experienceId = "A"): MediaCollectionItem => ({ source: { kind: "group", experienceId, contributionId: "c" },
  authorUserId, mediaType: "image", description: "Image", uploadedAt: null, originName: experienceId === "A" ? "Group A" : "Group B", private: false, ...(creationContext ? { creationContext } : {}) });
const personalItem: MediaCollectionItem = { source: { kind: "personal", cardTemplateId: "card", mediaItemId: "m" }, authorUserId: "ann", mediaType: "image", description: "Image", uploadedAt: null, originName: "Personal", private: false };

test("Delete and Hide follow the creation context: every row of the table, including dual-role users", () => {
  // Author in the creation context: Delete.
  assert.equal(mediaRemoveOperation("ann", personalItem, caps(false)), "delete", "standalone media on the standalone Card");
  assert.equal(mediaRemoveOperation("ann", item("ann", "self"), caps(false), "A", "self"), "delete", "Follower contribution in Me of A");
  assert.equal(mediaRemoveOperation("ann", item("ann", "group"), caps(true), "A", "group"), "delete", "Admin contribution in the Group perspective of A");
  // Author outside it, unable to hide there: nothing, and the origin is shown.
  assert.equal(mediaRemoveOperation("ann", item("ann", "self"), caps(false)), null, "Follower contribution on the standalone Card");
  assert.equal(mediaRemoveOperation("ann", item("ann", "self", "B"), caps(false), "A", "self"), null, "another Group's contribution in Me of A");
  assert.equal(mediaRemoveOperation("ann", personalItem, caps(false), "A", "self"), null, "standalone media in Me");
  assert.equal(mediaRemoveOperation("ann", item("ann", "self"), caps(false), "A", "group"), null, "own Follower item in the Group perspective without admin rights");
  // A current admin in the Group perspective: Hide for anything else from this Group, including their own Follower item.
  assert.equal(mediaRemoveOperation("ann", item("ann", "self"), caps(true), "A", "group"), "hide", "dual-role admin, own Follower item");
  assert.equal(mediaRemoveOperation("ann", item("bea", "self"), caps(true), "A", "group"), "hide", "another follower's item");
  assert.equal(mediaRemoveOperation("ann", item("bea", "group"), caps(true), "A", "group"), "hide", "another admin's item");
  // Anyone else: nothing.
  assert.equal(mediaRemoveOperation("ann", item("bea", "self"), caps(true), "B", "group"), null, "an item from another Group");
  assert.equal(mediaRemoveOperation("ann", item("bea", "self"), caps(false), "A", "group"), null, "a follower viewing another author's item");
  assert.equal(mediaRemoveOperation("ann", item("ann", "group"), caps(true), "A", "self"), null, "own Admin item never in Me");
  // A legacy record without creationContext is a Follower contribution: deleted from Me, hidden from the Group perspective.
  assert.equal(mediaRemoveOperation("ann", item("ann"), caps(true), "A", "self"), "delete");
  assert.equal(mediaRemoveOperation("ann", item("ann"), caps(true), "A", "group"), "hide");
});

test("Media Centre names the origin of the viewer's own items outside their creation context, even where Hide applies", () => {
  assert.equal(mediaCentreCreatedIn("ann", item("ann", "self")), "Group A · Me", "standalone Card");
  assert.equal(mediaCentreCreatedIn("ann", item("ann", "self", "B"), "A", "self"), "Group B · Me", "Me of another Group");
  assert.equal(mediaCentreCreatedIn("ann", personalItem, "A", "self"), "Personal Card", "standalone media in Me");
  assert.equal(mediaCentreCreatedIn("ann", item("ann", "self"), "A", "group"), "Group A · Me", "dual-role admin: Hide and the origin together");
  assert.equal(mediaCentreCreatedIn("ann", item("ann", "group"), "A", "group"), null, "in the creation context Delete is shown instead");
  assert.equal(mediaCentreCreatedIn("ann", item("bea", "self"), "A", "group"), null, "never for another author's item");
  assert.equal(outsideCreationContext("ann", item("ann", "self"), "A", "self"), false);
});

test("the Media Centre tile shows Created in above the origin in place of Delete, with no disabled control", () => {
  const image = (id: string): ImageMediaItem => ({ id, mediaType: "image", src: `https://example.test/${id}.jpg`, description: `Image ${id}` } as ImageMediaItem);
  const html = renderToStaticMarkup(createElement(UserCardMediaUploadPanel, { images: [image("outside"), image("inside")], videos: [],
    target: { scope: "user-card", userId: "ann", cardId: "card", deckTemplateId: "deck" }, uploadState: initialUserCardMediaUploadState, removalStatesById: {},
    onAddImage() {}, onAddVideo() {}, onRemoveMedia() {}, canUpload: false,
    canRemoveMedia: media => media.id === "inside", getCreatedIn: media => media.id === "outside" ? "Group A · Me" : null }));
  const tiles = html.split('data-media-item-id="').slice(1);
  const outside = tiles.find(tile => tile.startsWith("outside"))!, inside = tiles.find(tile => tile.startsWith("inside"))!;
  assert.match(outside, /<span class="user-card-media-tile-created-in-label">Created in:<\/span><span>Group A · Me<\/span>/);
  assert.doesNotMatch(outside, /Remove/); assert.doesNotMatch(outside, /disabled/);
  assert.match(inside, />Remove</); assert.doesNotMatch(inside, /Created in/);
});

test("the Group feed transport keeps creationContext, so an own Admin upload offers Delete rather than Hide", async t => {
  const page = { capabilities: caps(true), viewerUserId: "ann", cardTemplateId: "card", experienceId: "A", subjectUserId: null, accessEpoch: 1, adoptionRevision: 0, structureRevision: 0,
    total: 2, start: 0, next: null, previous: null, refresh: null, items: [
      { contributionId: "admin", experienceId: "A", authorUserId: "ann", kind: "image", revision: 1, uploadedAt: "2026-11-13T00:00:00.000Z", originName: "Group A", creationContext: "group" },
      { contributionId: "follower", experienceId: "A", authorUserId: "ann", kind: "image", revision: 1, uploadedAt: "2026-11-12T00:00:00.000Z", originName: "Group A", creationContext: "self" }] };
  t.mock.method(globalThis, "fetch", async () => Response.json(page, { headers: { "X-Group-Viewer": "ann" } }));
  const result = await fetchMediaCollection({ kind: "group", viewerUserId: "ann", cardTemplateId: "card", experienceId: "A", accessEpoch: 1, adoptionRevision: 0 });
  const byId = new Map(result.items.map(value => [value.source.kind === "group" ? value.source.contributionId : "", value]));
  assert.equal(byId.get("admin")?.creationContext, "group"); assert.equal(byId.get("follower")?.creationContext, "self");
  assert.equal(mediaRemoveOperation("ann", byId.get("admin")!, caps(true), "A", "group"), "delete");
  assert.equal(mediaRemoveOperation("ann", byId.get("follower")!, caps(true), "A", "group"), "hide");
});

test("the Info Card menu keeps + New everywhere and shows Edit and Remove only in the creation context", () => {
  const card = (changes: object) => ({ id: "n", title: "Note", body: "Body", seriesTitle: "S", creatorUsername: "ann", seriesCreatorUsername: "ann", personal: true, ...changes });
  assert.deepEqual(buildInfoCardMenuLayout(card({ personalSource: { cardTemplateId: "card", personalInfoRevision: 0 } })), { manage: true, origin: null });
  assert.deepEqual(buildInfoCardMenuLayout(card({ groupNote: { experienceId: "A", editable: true }, origin: "Group A · Me" })), { manage: true, origin: null });
  assert.deepEqual(buildInfoCardMenuLayout(card({ groupNote: { experienceId: "A", editable: false }, origin: "Group A · Me" })), { manage: false, origin: "Group A · Me" });
  assert.deepEqual(buildInfoCardMenuLayout(card({ origin: "Personal Card" })), { manage: false, origin: "Personal Card" });
  assert.deepEqual(buildInfoCardMenuLayout(card({ personal: false })), { manage: false, origin: null }, "Creator Info Cards are unchanged");
  assert.deepEqual(buildInfoCardMenuLayout({ id: "gone", unavailable: true }), { manage: false, origin: null });
  assert.deepEqual(buildInfoCardMenuLayout(undefined), { manage: false, origin: null });
});

const note = (id: string, experienceId: string): PublishedInfo => ({ infoCardId: id, version: 1, visibility: "private", ownerUserId: "ann", creatorUsername: "ann", kind: "group",
  creationContext: "self", experienceId, originCardTemplateId: "main", content: { title: id, body: "Body", seriesId: "s", mediaItem: null },
  series: { seriesId: "s", title: "S", createdByUserId: "ann", creatorUsername: "ann" } } as PublishedInfo);
const standaloneNote: PublishedInfo = { ...note("standalone", "A"), kind: "personal", creationContext: undefined, experienceId: undefined } as PublishedInfo;
async function consultation(t: { mock: { method: (...args: never[]) => unknown } }, request: ConsultationRequest) {
  const snapshot: InfoConsultationSnapshot = { mainCardId: "main", mainCardVersion: 3, personalSources: [{ cardTemplateId: "main", personalInfoRevision: 0 }], entries: [
    { status: "available", key: "inA", source: "group", info: note("inA", "A"), originName: "Group A", ...(request.mode === "experience" ? { private: false } : {}) },
    { status: "available", key: "inB", source: "group", info: note("inB", "B"), originName: "Group B", ...(request.mode === "experience" ? { private: true } : {}) },
    { status: "available", key: "standalone", source: "personal", sourceCardTemplateId: "main", info: standaloneNote, ...(request.mode === "experience" ? { private: true } : {}) }] };
  (t.mock.method as (object: object, name: string, fn: (url: string) => Promise<Response>) => unknown)(globalThis, "fetch", async (url: string) => url === "/api/auth/me"
    ? Response.json({ user: { id: "ann" } }) : Response.json(snapshot, { headers: { "X-Personal-Viewer": "ann" } }));
  const cards = await loadInfoConsultation(request, new AbortController().signal);
  return new Map(cards.flatMap(card => card.unavailable ? [] : [[card.id, card] as const]));
}

test("a Group note is editable only in Me of its own Group; elsewhere it carries its origin", async t => {
  const working = await consultation(t, { actor: "ann", mainCardId: "main", version: 3, mode: "working", deckTemplateId: "deck", attachmentIds: [] });
  assert.equal(working.get("inA")?.groupNote?.editable, false, "not on the standalone Card");
  assert.equal(working.get("inA")?.origin, "Group A · Me");
  assert.ok(working.get("standalone")?.personalSource, "a standalone note stays editable on the standalone Card");
  assert.deepEqual(buildInfoCardMenuLayout(working.get("standalone")), { manage: true, origin: null });
  const meA = await consultation(t, { actor: "ann", mainCardId: "main", version: 3, mode: "experience", experienceId: "A", attachmentIds: [] });
  assert.equal(meA.get("inA")?.groupNote?.editable, true);
  assert.deepEqual(buildInfoCardMenuLayout(meA.get("inA")), { manage: true, origin: null });
  assert.equal(meA.get("inB")?.groupNote?.editable, false);
  assert.deepEqual(buildInfoCardMenuLayout(meA.get("inB")), { manage: false, origin: "Group B · Me" });
  assert.deepEqual(buildInfoCardMenuLayout(meA.get("standalone")), { manage: false, origin: "Personal Card" });
});

test("My Drafts entries name the originating context of unsaved Group drafts", async () => {
  const roots = [{ infoCardId: "g", ownerUserId: "ann", kind: "group", experienceId: "A", creationContext: "self", originCardTemplateId: "main", draft: { title: "Group draft", body: "", seriesId: null, mediaItem: null }, updatedAt: "2026-11-13T00:00:00.000Z", latestVersion: 0 },
    { infoCardId: "c", ownerUserId: "ann", draft: { title: "Creator draft", body: "", seriesId: null, mediaItem: null }, updatedAt: "2026-11-12T00:00:00.000Z", latestVersion: 0 }];
  const request = (async (url: string) => url.startsWith("/api/creator/drafts") ? [] : { items: roots, nextOffset: null, groupNames: { A: "Galway U18" } }) as Parameters<typeof loadCreatorDraftEntries>[0];
  const { items } = await loadCreatorDraftEntries(request);
  const group = items.find(entry => entry.kind === "infoCard" && entry.infoCardId === "g"), creator = items.find(entry => entry.kind === "infoCard" && entry.infoCardId === "c");
  assert.equal(group?.kind === "infoCard" && group.origin, "Galway U18 · Me");
  assert.equal(creator?.kind === "infoCard" ? creator.origin : "missing", undefined, "Creator drafts are unchanged");
});
