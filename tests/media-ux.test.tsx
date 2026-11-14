import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import MediaCentreControl from "../src/components/media/MediaCentreControl";
import BackCardMediaCarousel from "../src/components/decks/BackCardMediaCarousel";
import { collectionDisplayItem } from "../src/lib/mediaCollection/presentation";
import { mediaRemoveOperations } from "../src/lib/mediaCollection/permissions";
import type { MediaCollectionItem } from "../src/lib/mediaCollection/contracts";
for (const count of [0, 1, 5, 6, 8]) test(`Media Centre has one icon control and correct count at ${count}`, () => {
  const html = renderToStaticMarkup(<MediaCentreControl total={count} onOpen={() => {}} />);
  assert.equal((html.match(/<button/g) ?? []).length, 1); assert.ok(html.includes('aria-label="Media Centre"')); assert.ok(!html.includes("Add media"));
  assert.ok(html.includes('class="media-centre-icon"')); assert.ok(html.includes('width="18" height="18" viewBox="0 0 40 40"')); assert.ok(html.includes('stroke-width="4.1667"'));
  assert.ok(html.includes('d="M25.5 31.5h12M31.5 25.5v12"')); assert.ok(html.includes('stroke-width="5"')); assert.ok(!html.includes("lucide-square-plus")); assert.ok(!html.includes("lucide-image-plus"));
  assert.equal(html.includes('class="media-centre-count"'), count > 5);
  if (count > 5) assert.ok(html.includes(`>${count}</span>`));
});
test("own Group thumbnails each have one correctly chosen visibility icon, absent outside Groups", () => {
  const context = { kind: "owner" as const, viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway" };
  const entry: MediaCollectionItem = { source: { kind: "group", experienceId: "galway", contributionId: "id" }, authorUserId: "bob", mediaType: "image", description: "Practice", uploadedAt: null, private: true, originName: "Galway U18" };
  const items = [entry, { ...entry, source: { kind: "group" as const, experienceId: "galway", contributionId: "shared" }, private: false }].map(i => collectionDisplayItem(i, context));
  const html = renderToStaticMarkup(<BackCardMediaCarousel items={items} showPrivate />);
  assert.equal((html.match(/class="media-private-label"/g) ?? []).length, 2);
  assert.ok(html.includes('lucide-eye-off')); assert.ok(html.includes('lucide-eye"'));
  assert.ok(html.includes('aria-label="Private in this Group"')); assert.ok(html.includes('aria-label="Visible to this Group"'));
  assert.ok(!html.includes("🔒"));
  assert.ok(!renderToStaticMarkup(<BackCardMediaCarousel items={items} />).includes("group-visibility-icon"));
});
test("Remove operation is source/creator based and requires server capabilities", () => {
  const item: MediaCollectionItem = { source: { kind: "group", experienceId: "galway", contributionId: "id" }, authorUserId: "bob", mediaType: "image", description: "Practice", uploadedAt: null, private: false, originName: null };
  const caps = { canUpload: false, canRemoveOwn: true, canHideOthers: true, canManage: true };
  assert.deepEqual(mediaRemoveOperations("bob", item, caps, "galway"), ["delete"]);
  // C1 (checkpoint 4.2b): a Follower contribution is no longer deleted from the standalone Card.
  assert.deepEqual(mediaRemoveOperations("bob", item, caps), []);
  assert.deepEqual(mediaRemoveOperations("bob", item, caps, "another"), []);
  assert.deepEqual(mediaRemoveOperations("bob", { ...item, private: true }, caps, "galway"), ["delete"]);
  const personal = { ...item, source: { kind: "personal" as const, cardTemplateId: "card", mediaItemId: "personal" } };
  assert.deepEqual(mediaRemoveOperations("bob", personal, caps), ["delete"]);
  assert.deepEqual(mediaRemoveOperations("bob", personal, caps, "galway"), []);
  assert.deepEqual(mediaRemoveOperations("coach", item, caps, "galway"), ["hide"]);
  assert.deepEqual(mediaRemoveOperations("coach", item, caps, "another"), []);
  assert.deepEqual(mediaRemoveOperations("peer", item, { ...caps, canHideOthers: false }, "galway"), []);
});

test("Media Centre metadata uses original filenames and real origin, with honest legacy fallback", async () => {
  const { mediaCentreMetadata } = await import("../src/lib/mediaCollection/centreMetadata");
  const context = { kind: "owner" as const, viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway" };
  for (const mediaType of ["image", "video"] as const) {
    const value: MediaCollectionItem = { source: { kind: "group", experienceId: "galway", contributionId: "id" }, authorUserId: "bob", mediaType, description: "Group image", originalFilename: mediaType === "image" ? "footwork-practice.jpg" : "shooting-drill.mp4", uploadedAt: null, private: false, originName: "Galway U18" };
    assert.deepEqual(mediaCentreMetadata(collectionDisplayItem(value, context)), { filename: value.originalFilename, origin: "Galway U18" });
    assert.deepEqual(mediaCentreMetadata(collectionDisplayItem({ ...value, private: true }, context)), { filename: value.originalFilename, origin: "Galway U18" });
    assert.deepEqual(mediaCentreMetadata(collectionDisplayItem({ ...value, originalFilename: undefined }, context)), { filename: "Filename unavailable", origin: "Galway U18" });
  }
  assert.deepEqual(mediaCentreMetadata({ id: "personal", mediaType: "image", src: "image", description: "Training photo 1", originalFilename: "solo-practice.png" }), { filename: "solo-practice.png", origin: "Personal" });
  assert.deepEqual(mediaCentreMetadata({ id: "legacy-filename", mediaType: "image", src: "image", description: "existing-upload.jpg" }), { filename: "existing-upload.jpg", origin: "Personal" });
});

test("Media Centre renders filename and In separately for images, videos and legacy items", async () => {
  const { default: Panel } = await import("../src/components/media/UserCardMediaUploadPanel");
  const { mediaCentreMetadata } = await import("../src/lib/mediaCollection/centreMetadata");
  const { initialUserCardMediaUploadState } = await import("../src/components/media/useKeyedUserCardMediaUploadController");
  const context = { kind: "owner" as const, viewerUserId: "bob", cardTemplateId: "card" };
  const value: MediaCollectionItem = { source: { kind: "group", experienceId: "galway", contributionId: "id" }, authorUserId: "bob", mediaType: "video", description: "Group video", originalFilename: "defensive-positioning.mp4", uploadedAt: null, private: false, originName: "Galway U18" };
  const video = collectionDisplayItem(value, context);
  assert.equal(video.mediaType, "video"); if (video.mediaType !== "video") return;
  const html = renderToStaticMarkup(<Panel images={[{ id: "image", mediaType: "image", src: "image.png", description: "Training photo", originalFilename: "shooting-drill.png" }, { id: "legacy", mediaType: "image", src: "old.png", description: "Old picture" }]} videos={[video]} target={{ scope: "user-card", userId: "bob", cardId: "card", deckTemplateId: "deck" }} uploadState={initialUserCardMediaUploadState} removalStatesById={{}} onAddImage={() => {}} onAddVideo={() => {}} onRemoveMedia={() => {}} getMetadata={mediaCentreMetadata} />);
  assert.ok(html.includes('title="shooting-drill.png">shooting-drill.png</p>'));
  assert.ok(html.includes('title="defensive-positioning.mp4">defensive-positioning.mp4</p>'));
  assert.ok(html.includes('title="Filename unavailable">Filename unavailable</p>'));
  assert.ok(html.includes("In: Personal")); assert.ok(html.includes("In: Galway U18"));
});

test("Group Media Centre identifies the original uploader; outside Groups retains upload origin", async () => {
  const { mediaCentreMetadata } = await import("../src/lib/mediaCollection/centreMetadata");
  const context = { kind: "owner" as const, viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway" };
  const value: MediaCollectionItem = { source: { kind: "group", experienceId: "galway", contributionId: "id" }, authorUserId: "bob", authorName: "Aoife Kelly", mediaType: "image", description: "Practice", originalFilename: "practice.png", uploadedAt: null, private: false, originName: "Galway U18" };
  for (const privateValue of [false, true]) {
    const item = collectionDisplayItem({ ...value, private: privateValue }, context);
    assert.equal(mediaCentreMetadata(item, true).uploader, "Aoife Kelly");
    assert.equal(mediaCentreMetadata(item).origin, "Galway U18");
    assert.equal(mediaCentreMetadata(item).uploader, undefined);
  }
  assert.equal(mediaCentreMetadata(collectionDisplayItem({ ...value, authorName: undefined }, context), true).uploader, "Unknown user");
});

test("both visibility icons use identical outline dimensions and stroke", async () => {
  const { default: Indicator } = await import("../src/components/media/VisibilityIndicator");
  for (const visible of [false, true]) {
    const html = renderToStaticMarkup(<Indicator visible={visible} />);
    assert.ok(html.includes('width="9" height="9"')); assert.ok(html.includes('stroke-width="2"'));
    assert.ok(html.includes('fill="none"')); assert.ok(!html.includes("<button"));
  }
});
test("the same private date indicator is present on both Group Card faces without making dates editable or exposing foreign dates", async () => {
  const { default: Anchors } = await import("../src/components/decks/CardSemanticAnchors");
  const card = { surface: "experience", id: "card", label: "Card 1", ownerDate: "2027-09-10", confidence: null, completion: null, steps: [] } as unknown as import("../src/components/decks/presentation").PresentedCard;
  for (const variant of ["front", "back", "focused"] as const) {
    const html = renderToStaticMarkup(<Anchors card={card} dateLabel="" variant={variant} />);
    assert.ok(html.includes("10 Sept")); assert.equal((html.match(/lucide-eye-off/g) ?? []).length, 1);
    assert.ok(!html.includes("Move target date")); assert.ok(!html.includes("🔒"));
    const hidden = renderToStaticMarkup(<Anchors card={{ ...card, ownerDate: undefined } as typeof card} dateLabel="" variant={variant} />);
    assert.ok(!hidden.includes("group-visibility-icon"));
  }
});

test("image and video Media Centre rows reserve an indicator for each visibility state and retain By metadata", async () => {
  const { default: Panel } = await import("../src/components/media/UserCardMediaUploadPanel");
  const { mediaCentreMetadata } = await import("../src/lib/mediaCollection/centreMetadata");
  const { initialUserCardMediaUploadState } = await import("../src/components/media/useKeyedUserCardMediaUploadController");
  const context = { kind: "owner" as const, viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway" };
  const items = ["image", "video"].flatMap(kind => [false, true].map(privateValue => collectionDisplayItem({ source: { kind: "group", experienceId: "galway", contributionId: `${kind}-${privateValue}` }, authorUserId: "bob", authorName: "Aoife Kelly", mediaType: kind as "image" | "video", description: "Practice", originalFilename: `practice.${kind === "image" ? "png" : "mp4"}`, uploadedAt: null, originName: "Galway U18", private: privateValue }, context)));
  const html = renderToStaticMarkup(<Panel images={items.filter(i => i.mediaType === "image")} videos={items.filter(i => i.mediaType === "video")} target={{ scope: "user-card", userId: "bob", cardId: "card", deckTemplateId: "deck" }} uploadState={initialUserCardMediaUploadState} removalStatesById={{}} onAddImage={() => {}} onAddVideo={() => {}} onRemoveMedia={() => {}} showPrivate getMetadata={item => mediaCentreMetadata(item, true)} />);
  assert.equal((html.match(/class="media-centre-private-label"/g) ?? []).length, 4);
  assert.equal((html.match(/lucide-eye-off/g) ?? []).length, 2); assert.equal((html.match(/lucide-eye"/g) ?? []).length, 2);
  assert.equal((html.match(/By: Aoife Kelly/g) ?? []).length, 4); assert.ok(!html.includes("Uploaded by"));
  assert.ok(html.includes("user-card-media-rail--videos"));
});

test("Media Centre labels exactly two actions: Delete and Hide from Group", async () => {
  const { default: Panel } = await import("../src/components/media/UserCardMediaUploadPanel");
  const { initialUserCardMediaUploadState } = await import("../src/components/media/useKeyedUserCardMediaUploadController");
  const images = [{ id: "own", mediaType: "image" as const, src: "a.png", description: "Own" }, { id: "other", mediaType: "image" as const, src: "b.png", description: "Other" }];
  const html = renderToStaticMarkup(<Panel images={images} videos={[]} target={{ scope: "user-card", userId: "bob", cardId: "card", deckTemplateId: "deck" }} uploadState={initialUserCardMediaUploadState} removalStatesById={{}} onAddImage={() => {}} onAddVideo={() => {}} onRemoveMedia={() => {}} getRemoveActions={item => item.id === "other" ? ["hide"] : ["delete"]} />);
  assert.ok(html.includes('aria-label="Delete image Own (own)"') && html.includes(">Delete</button>"));
  assert.ok(html.includes('aria-label="Hide image Other (other) from Group"') && html.includes(">Hide from Group</button>"));
  assert.ok(!html.includes("Remove"));
});
// Checkpoint 4.5b (V1): an Admin contribution in a follower's Me is Group content, read through the Group.
test("Admin media in Me is delivered through the Group and keeps its slot without a visibility icon", () => {
  const context = { kind: "owner" as const, viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway" };
  const own: MediaCollectionItem = { source: { kind: "group", experienceId: "galway", contributionId: "own" }, authorUserId: "bob", mediaType: "image", description: "Practice", uploadedAt: null, private: false, originName: "Galway", creationContext: "self" };
  const admin: MediaCollectionItem = { ...own, source: { kind: "group", experienceId: "galway", contributionId: "coach" }, authorUserId: "alice", creationContext: "group" };
  const [ownItem, adminItem] = [own, admin].map(i => collectionDisplayItem(i, context));
  assert.equal(ownItem.src, "/api/group-media/own?action=playback", "the viewer's own item through the owner route, as before");
  assert.equal(adminItem.src, "/api/group-media/coach?action=playback&experienceId=galway");
  const html = renderToStaticMarkup(<BackCardMediaCarousel items={[ownItem, adminItem]} showPrivate />);
  assert.equal((html.match(/class="media-private-label"/g) ?? []).length, 2, "both keep the slot, so the geometry is unchanged");
  assert.equal((html.match(/group-visibility-icon|lucide-eye/g) ?? []).length > 0, true);
  assert.equal((html.match(/aria-label="Visible to this Group"/g) ?? []).length, 1, "only the viewer's own item has the indicator");
  // Never Delete or Hide in Me on another author's Admin item, even for an admin (canHideOthers is off in Me).
  assert.deepEqual(mediaRemoveOperations("bob", admin, { canUpload: false, canRemoveOwn: true, canHideOthers: false, canManage: true }, "galway", "self"), []);
});
test("an Admin item included in an inspection is delivered as Group content, without the subject", () => {
  const context = { kind: "group" as const, viewerUserId: "coach", cardTemplateId: "card", experienceId: "galway", subjectUserId: "bob", accessEpoch: 1, adoptionRevision: 1, includeAdminContent: true as const };
  const own: MediaCollectionItem = { source: { kind: "group", experienceId: "galway", contributionId: "own" }, authorUserId: "bob", mediaType: "image", description: "Practice", uploadedAt: null, private: false, originName: "Galway", creationContext: "self" };
  const admin: MediaCollectionItem = { ...own, source: { kind: "group", experienceId: "galway", contributionId: "coach" }, authorUserId: "alice", creationContext: "group" };
  assert.equal(collectionDisplayItem(own, context).src, "/api/group-media/own?action=playback&experienceId=galway&subjectUserId=bob");
  assert.equal(collectionDisplayItem(admin, context).src, "/api/group-media/coach?action=playback&experienceId=galway");
});

// Refinement after 4.5c: an admin's own Admin item in the Group perspective offers Delete with Hide from Group
// beneath it; every other rule is unchanged.
test("an own Admin item in the Group perspective has Delete then Hide from Group; other admins' items Hide only; followers neither", () => {
  const groupCaps = { canUpload: true, canRemoveOwn: true, canHideOthers: true, canManage: true }, followerCaps = { ...groupCaps, canUpload: false, canHideOthers: false };
  const admin: MediaCollectionItem = { source: { kind: "group", experienceId: "galway", contributionId: "coach" }, authorUserId: "alice", mediaType: "image", description: "Drill", uploadedAt: null, private: false, originName: "Galway", creationContext: "group" };
  assert.deepEqual(mediaRemoveOperations("alice", admin, groupCaps, "galway", "group"), ["delete", "hide"], "the author, in the creation context");
  assert.deepEqual(mediaRemoveOperations("dee", admin, groupCaps, "galway", "group"), ["hide"], "another admin: Hide, never Delete");
  assert.deepEqual(mediaRemoveOperations("bob", admin, followerCaps, "galway", "group"), [], "a follower in the Group perspective");
  assert.deepEqual(mediaRemoveOperations("bob", admin, followerCaps, "galway", "self"), [], "a follower in Me");
  assert.deepEqual(mediaRemoveOperations("alice", admin, { ...groupCaps, canHideOthers: false }, "galway", "group"), ["delete"], "the author without hide rights");
  assert.deepEqual(mediaRemoveOperations("alice", admin, groupCaps, "galway", "self"), [], "the dual-role author in Me or an inspection: neither");
  assert.deepEqual(mediaRemoveOperations("alice", admin, groupCaps, "other", "group"), [], "never from another Group");
  const follower: MediaCollectionItem = { ...admin, source: { kind: "group", experienceId: "galway", contributionId: "own" }, creationContext: "self" };
  assert.deepEqual(mediaRemoveOperations("alice", follower, groupCaps, "galway", "group"), ["hide"], "own Follower item in the Group perspective: Hide only, as before");
});
test("the Media Centre stacks Hide from Group beneath Delete in one cell, and only the acting button shows progress", async () => {
  const { default: Panel } = await import("../src/components/media/UserCardMediaUploadPanel");
  const { initialUserCardMediaUploadState } = await import("../src/components/media/useKeyedUserCardMediaUploadController");
  const images = [{ id: "both", mediaType: "image" as const, src: "a.png", description: "Both" }, { id: "single", mediaType: "image" as const, src: "b.png", description: "Single" }];
  const render = (removalStatesById = {}) => renderToStaticMarkup(<Panel images={images} videos={[]} target={{ scope: "user-card", userId: "alice", cardId: "card", deckTemplateId: "deck" }}
    uploadState={initialUserCardMediaUploadState} removalStatesById={removalStatesById} onAddImage={() => {}} onAddVideo={() => {}} onRemoveMedia={() => {}}
    getRemoveActions={item => item.id === "both" ? ["delete", "hide"] : ["delete"]} />);
  const html = render(), tiles = html.split('data-media-item-id="').slice(1);
  const both = tiles.find(tile => tile.startsWith("both"))!, single = tiles.find(tile => tile.startsWith("single"))!;
  assert.match(both, /<div class="user-card-media-tile-actions"><button aria-label="Delete image Both \(both\)"[^>]*>Delete<\/button><button aria-label="Hide image Both \(both\) from Group"[^>]*>Hide from Group<\/button><\/div>/);
  assert.ok(!single.includes("user-card-media-tile-actions"), "a single action keeps the established single button");
  assert.match(single, />Delete<\/button>/);
  const hiding = render({ both: { isRemoving: true, action: "hide", error: null } }).split('data-media-item-id="').find(tile => tile.startsWith("both"))!;
  assert.match(hiding, />Delete<\/button>/); assert.match(hiding, />Hiding…<\/button>/);
  assert.equal((hiding.match(/disabled=""/g) ?? []).length, 2, "both stay disabled while one runs");
});
test("own Me with Include admin content asks owner history for it, and keeps a separate preview cache key", async t => {
  const { fetchMediaCollection } = await import("../src/lib/mediaCollection/transport");
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => { urls.push(url); return Response.json({ viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway", total: 0, olderCount: 0, items: [], older: null, newer: null }); });
  await fetchMediaCollection({ kind: "owner", viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway", includeAdminContent: true });
  await fetchMediaCollection({ kind: "owner", viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway" });
  await fetchMediaCollection({ kind: "owner", viewerUserId: "bob", cardTemplateId: "card", includeAdminContent: true });
  assert.equal(urls[0], "/api/media/history?cardTemplateId=card&experienceId=galway&includeAdminContent=1&limit=30");
  assert.equal(urls[1], "/api/media/history?cardTemplateId=card&experienceId=galway&limit=30");
  assert.equal(urls[2], "/api/media/history?cardTemplateId=card&limit=30", "never on the standalone Card");
  const { retainedMediaPreview } = await import("../src/lib/mediaCollection/controller");
  const on = retainedMediaPreview({ kind: "owner", viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway", includeAdminContent: true });
  const off = retainedMediaPreview({ kind: "owner", viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway" });
  assert.notEqual(on, off); on.dispose(); off.dispose();
});
test("own Me is prepared in the role-default state of Include admin content", async () => {
  const { ownMeMediaContext } = await import("../src/lib/cards/preparationClient");
  assert.deepEqual(ownMeMediaContext("bob", "card", "galway", { isAdmin: false }), { kind: "owner", viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway", includeAdminContent: true });
  assert.deepEqual(ownMeMediaContext("alice", "card", "galway", { isAdmin: true }), { kind: "owner", viewerUserId: "alice", cardTemplateId: "card", experienceId: "galway" });
});
