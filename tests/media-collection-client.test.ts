import assert from "node:assert/strict";
import { test } from "node:test";
import { MediaCollectionController } from "../src/lib/mediaCollection/controller";
import { collectionKey, type MediaCollectionPage, type MediaCollectionContext } from "../src/lib/mediaCollection/contracts";
const context: MediaCollectionContext = { viewerUserId: "bob", cardTemplateId: "card", kind: "owner" };
const page = (ids: string[], older: string | null = null, newer: string | null = null): MediaCollectionPage => ({ viewerUserId: "bob", cardTemplateId: "card", total: 8, olderCount: 3, older, newer,
  items: ids.map(id => ({ source: { kind: "personal", cardTemplateId: "card", mediaItemId: id }, authorUserId: "bob", mediaType: "image", description: id, uploadedAt: null, originName: "Personal", private: false })) });
test("gallery loads adjacent bounded pages, keeps typed selection, and returns to newer items", async () => {
  const requests: (string | undefined)[] = [];
  const c = new MediaCollectionController(context, async (_ctx, cursor) => { requests.push(cursor); return cursor === "older" ? page(["1", "2", "3"], null, "newer") : page(["4", "5", "6", "7", "8"], "older"); });
  await c.load(); c.select(collectionKey(c.snapshot().page!.items[0])); await c.navigate(-1);
  assert.equal(c.selected()!.description, "3"); await c.navigate(1); assert.equal(c.selected()!.description, "4");
  assert.deepEqual(requests, [undefined, "older", "newer"]); c.dispose();
});
test("refresh preserves selected identity after insert and uses next surviving index after deletion", async () => {
  let value = page(["1", "2", "3"]); const c = new MediaCollectionController(context, async () => value);
  await c.load(); c.select(collectionKey(value.items[1])); value = page(["0", "1", "2", "3"]); await c.refresh();
  assert.equal(c.selected()!.description, "2"); value = page(["0", "1", "3"]); await c.refresh(); assert.equal(c.selected()!.description, "3"); c.dispose();
});
test("late responses and wrong viewer/context data cannot populate the collection", async () => {
  let finish!: (value: MediaCollectionPage) => void;
  const c = new MediaCollectionController(context, () => new Promise(r => { finish = r; }));
  const pending = c.load(); c.dispose(); finish(page(["secret"])); await pending; assert.equal(c.snapshot().page, null);
  const wrong = new MediaCollectionController(context, async () => ({ ...page(["secret"]), viewerUserId: "alice" }));
  await wrong.load(); assert.equal(wrong.snapshot().page, null); assert.ok(wrong.snapshot().error); wrong.dispose();
});
test("foreign cache identity includes subject and refuses private or Personal payloads", async () => {
  const ctx: MediaCollectionContext = { kind: "group", viewerUserId: "coach", cardTemplateId: "card", experienceId: "galway", subjectUserId: "bob", accessEpoch: 2, adoptionRevision: 3 };
  const metadata = { viewerUserId: "coach", experienceId: "galway", accessEpoch: 2, adoptionRevision: 3, subjectUserId: "carol" };
  const c = new MediaCollectionController(ctx, async () => ({ ...page(["secret"]), ...metadata }));
  await c.load(); assert.equal(c.snapshot().page, null); c.dispose();
  const d = new MediaCollectionController(ctx, async () => ({ ...page(["secret"]), ...metadata, subjectUserId: "bob" }));
  await d.load(); assert.equal(d.snapshot().page, null); d.dispose();
});
test("presentation-only Group references retain typed identity and cannot become stored media", async () => {
  const { collectionDisplayItem } = await import("../src/lib/mediaCollection/presentation");
  const { personalMediaKey } = await import("../src/lib/cards/personalHistoryProjection");
  const { assertNoGroupMediaReferences } = await import("../src/lib/groupExperiences/media/registry");
  const item = { source: { kind: "group" as const, experienceId: "galway", contributionId: "video" }, authorUserId: "bob", mediaType: "video" as const, uploadedAt: null, description: "Practice", originName: "Galway U18", private: false };
  const display = collectionDisplayItem(item, context);
  assert.equal(personalMediaKey(display), collectionKey(item)); assert.ok(display.src.startsWith("/api/group-media/"));
  const db = { collection() { throw Error("Contextual URL denial must precede any generic grant lookup"); } } as unknown as import("mongodb").Db;
  await assert.rejects(assertNoGroupMediaReferences(db, display), { code: "MEDIA_FORBIDDEN" });
});
