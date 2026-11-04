import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import MediaCentreControl from "../src/components/media/MediaCentreControl";
import BackCardMediaCarousel from "../src/components/decks/BackCardMediaCarousel";
import { collectionDisplayItem } from "../src/lib/mediaCollection/presentation";
import { mediaRemoveOperation } from "../src/lib/mediaCollection/permissions";
import type { MediaCollectionItem } from "../src/lib/mediaCollection/contracts";
for (const count of [0, 1, 5, 6, 8]) test(`Media Centre has one icon control and correct count at ${count}`, () => {
  const html = renderToStaticMarkup(<MediaCentreControl total={count} onOpen={() => {}} />);
  assert.equal((html.match(/<button/g) ?? []).length, 1); assert.ok(html.includes('aria-label="Media Centre"')); assert.ok(!html.includes("Add media"));
  assert.ok(html.includes('class="media-centre-icon"')); assert.ok(html.includes('width="18" height="18" viewBox="0 0 40 40"')); assert.ok(html.includes('stroke-width="4.1667"'));
  assert.ok(html.includes('d="M25.5 31.5h12M31.5 25.5v12"')); assert.ok(html.includes('stroke-width="5"')); assert.ok(!html.includes("lucide-square-plus")); assert.ok(!html.includes("lucide-image-plus"));
  assert.equal(html.includes('class="media-centre-count"'), count > 5);
  if (count > 5) assert.ok(html.includes(`>${count}</span>`));
});
test("the existing subdued lock replaces Private text only below eligible own-Group thumbnails", () => {
  const context = { kind: "owner" as const, viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway" };
  const entry: MediaCollectionItem = { source: { kind: "group", experienceId: "origin", contributionId: "id" }, authorUserId: "bob", mediaType: "image", description: "Practice", uploadedAt: null, private: true, originName: "Galway U14" };
  const items = [collectionDisplayItem(entry, context)];
  const privateHtml = renderToStaticMarkup(<BackCardMediaCarousel items={items} showPrivate />);
  assert.ok(privateHtml.includes('class="media-private-label"')); assert.ok(privateHtml.includes('class="group-private-mark"')); assert.ok(privateHtml.includes('role="img" aria-label="Private"')); assert.ok(privateHtml.includes("🔒")); assert.ok(!privateHtml.includes(">Private</span>")); assert.ok(!privateHtml.includes("Galway U14"));
  assert.ok(!renderToStaticMarkup(<BackCardMediaCarousel items={items} />).includes('class="media-private-label"'));
});
test("Remove operation is source/creator based and requires server capabilities", () => {
  const item: MediaCollectionItem = { source: { kind: "group", experienceId: "galway", contributionId: "id" }, authorUserId: "bob", mediaType: "image", description: "Practice", uploadedAt: null, private: false, originName: null };
  const caps = { canUpload: false, canRemoveOwn: true, canHideOthers: true, canManage: true };
  assert.equal(mediaRemoveOperation("bob", item, caps, "galway"), "delete");
  assert.equal(mediaRemoveOperation("coach", item, caps, "galway"), "hide");
  assert.equal(mediaRemoveOperation("coach", item, caps, "another"), null);
  assert.equal(mediaRemoveOperation("peer", item, { ...caps, canHideOthers: false }, "galway"), null);
});
