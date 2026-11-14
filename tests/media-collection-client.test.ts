import assert from "node:assert/strict";
import { test } from "node:test";
import { MediaCollectionController, retainedMediaPreview } from "../src/lib/mediaCollection/controller";
import { workingCardStore } from "../src/lib/cards/workingCardStore";
import { notifyMediaCollectionChanged } from "../src/lib/mediaCollection/invalidation";
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

test("thumbnail refresh starts at newest while Gallery refresh retains its anchor", async () => {
  const requested: (string | undefined)[] = [];
  const first = { ...page(["old"], "older"), refresh: "anchor" };
  let inserted = false;
  const c = new MediaCollectionController(context, async (_ctx, cursor) => {
    requested.push(cursor);
    return inserted && cursor === undefined ? page(["old", "new"]) : first;
  }, 5);
  await c.load(); inserted = true;
  await c.refresh(); assert.deepEqual(c.snapshot().page!.items.map(i => i.description), ["old"]);
  await c.refresh(true); assert.deepEqual(c.snapshot().page!.items.map(i => i.description), ["old", "new"]);
  assert.deepEqual(requested, [undefined, "anchor", undefined]); c.dispose();
});

test("a known thumbnail opens from its authorised page while metadata is delayed, preserving selection after refresh", async () => {
  const seed = page(["6", "7", "8"]); let finish!: (value: MediaCollectionPage) => void;
  const c = new MediaCollectionController(context, () => new Promise(resolve => { finish = resolve; }), 30,
    { page: seed, selectedKey: collectionKey(seed.items[1]) });
  const pending = c.load();
  assert.equal(c.selected()!.description, "7"); assert.equal(c.snapshot().loading, true);
  finish(page(["1", "2", "3", "4", "5", "6", "7", "8"])); await pending;
  assert.equal(c.selected()!.description, "7"); assert.equal(c.snapshot().loading, false); c.dispose();
});
test("seeded Gallery data is cleared on denial, retained on server failure and cannot cross viewer or Group scope", async () => {
  const seed = page(["photo"]);
  for (const status of [403, 500]) {
    const c: MediaCollectionController = new MediaCollectionController(context, async () => { throw Object.assign(Error("Unavailable"), { status }); }, 30,
      { page: seed, selectedKey: collectionKey(seed.items[0]) });
    await c.load(); assert.equal(c.snapshot().page, status === 403 ? null : seed); assert.equal(c.selected()?.description ?? null, status === 403 ? null : "photo"); assert.ok(c.snapshot().error); c.dispose();
  }
  assert.throws(() => new MediaCollectionController({ ...context, viewerUserId: "another" }, async () => seed, 30,
    { page: seed, selectedKey: collectionKey(seed.items[0]) }));
});

test("Card preview remount reuses completed and in-flight data; account clearance prevents late resurrection", async () => {
  let finish!: (value: MediaCollectionPage) => void, calls = 0;
  const loader = async () => { calls++; return new Promise<MediaCollectionPage>(resolve => { finish = resolve; }); };
  const first = retainedMediaPreview(context, loader), read = first.load();
  const second = retainedMediaPreview(context, loader), again = second.load();
  assert.equal(first, second); assert.equal(calls, 1);
  finish(page(["photo"])); await Promise.all([read, again]);
  assert.equal(retainedMediaPreview(context, loader).snapshot().page!.items[0].description, "photo");
  const refresh = second.load(); workingCardStore.clearUser("bob"); finish(page(["late"])); await refresh;
  assert.equal(first.snapshot().page, null);
  assert.notEqual(retainedMediaPreview(context, loader), first);
  workingCardStore.clearUser("bob");
});

test("temporary refresh failure keeps known previews, confirmed Group scope loss clears them", async () => {
  let error: Error | undefined;
  const loader = async () => { if (error) throw error; return page(["photo"]); };
  const c = retainedMediaPreview(context, loader); await c.load();
  error = Error("Offline"); await c.load(); assert.equal(c.snapshot().page!.items.length, 1); assert.match(c.snapshot().error!, /Offline/);
  error = Object.assign(Error("Revoked"), { status: 403 }); await c.load(); assert.equal(c.snapshot().page, null);
  workingCardStore.clearUser("bob");
});
test("confirmed hiding removes the Group preview without deleting the owner copy or resurrecting a delayed page", async () => {
  const source = { kind: "group" as const, experienceId: "g", contributionId: "photo" };
  const item = { source, authorUserId: "bob", mediaType: "image" as const, description: "Photo", uploadedAt: null, originName: "Group", private: false };
  const groupContext: MediaCollectionContext = { kind: "group", viewerUserId: "coach", cardTemplateId: "card", experienceId: "g", accessEpoch: 2, adoptionRevision: 3 };
  const groupPage: MediaCollectionPage = { ...page([]), viewerUserId: "coach", experienceId: "g", accessEpoch: 2, adoptionRevision: 3, items: [item], total: 1 };
  let held = false, finish!: (page: MediaCollectionPage) => void;
  const c = retainedMediaPreview(groupContext, async () => held ? new Promise(resolve => { finish = resolve; }) : groupPage);
  const owner = retainedMediaPreview({ ...context, experienceId: "g" }, async () => ({ ...groupPage, viewerUserId: "bob" }));
  await c.load(); await owner.load(); held = true; const older = c.load();
  notifyMediaCollectionChanged("bob", "card", "g", { source, action: "hide" });
  assert.equal(c.snapshot().page!.items.length, 0); assert.equal(c.snapshot().page!.total, 0);
  assert.equal(owner.snapshot().page!.items.length, 1); assert.equal(owner.snapshot().page!.items[0].private, true);
  finish(groupPage); await older; assert.equal(c.snapshot().page!.items.length, 0);
  workingCardStore.clearUser("coach"); workingCardStore.clearUser("bob");
});
test("Gallery activation restores Strict Mode lifecycle checks but never revives a revoked seed", async () => {
  const seed = page(["photo"]), c = new MediaCollectionController(context, async () => seed, 30, { page: seed, selectedKey: collectionKey(seed.items[0]) });
  c.dispose(); c.activate(); await c.load(); assert.equal(c.selected()!.description, "photo");
  workingCardStore.clearUser("bob"); assert.equal(c.snapshot().page, null);
  c.activate(); await c.load(); assert.equal(c.snapshot().page, null);
});

test("composed media preparation cannot resurrect a removed item or replace a newer preview", async () => {
 const c = new MediaCollectionController(context, async () => page(["newer"]), 5);
 const token = c.preparationToken(); c.acceptPrepared(page(["initial"]), token);
 assert.equal(c.acceptPrepared(page(["older"]), token), false);
 const beforeRemoval = c.preparationToken(); c.invalidate(); c.removed(c.snapshot().page!.items[0].source, "delete");
 assert.equal(c.acceptPrepared(page(["initial"]), beforeRemoval), false);
 await c.load(); const source = c.snapshot().page!.items[0].source; assert.equal(source.kind === "personal" && source.mediaItemId, "newer");
 c.dispose(); assert.equal(c.acceptPrepared(page([])), false);
});
// Checkpoint 4.5b (V1): Me of a Group also holds that Group's Admin contributions; nothing else of another author.
test("a follower's Me page accepts this Group's Admin items only, never another follower's or another Group's", async () => {
  const me: MediaCollectionContext = { viewerUserId: "bob", cardTemplateId: "card", kind: "owner", experienceId: "galway" };
  const item = (contributionId: string, authorUserId: string, creationContext: "self" | "group", experienceId = "galway", isPrivate = false) => ({
    source: { kind: "group" as const, experienceId, contributionId }, authorUserId, mediaType: "image" as const, description: "Group image", uploadedAt: null, originName: "Galway", private: isPrivate, creationContext });
  const load = async (items: MediaCollectionPage["items"], ctx = me) => {
    const c = new MediaCollectionController(ctx, async () => ({ viewerUserId: "bob", cardTemplateId: "card", experienceId: "galway", total: items.length, olderCount: 0, older: null, newer: null, items }));
    await c.load(); const loaded = c.snapshot().page; c.dispose(); return loaded;
  };
  assert.ok(await load([item("own", "bob", "self"), item("coach", "alice", "group")]), "own items and this Group's Admin items");
  assert.equal(await load([item("peer", "carol", "self")]), null, "another follower's contribution");
  assert.equal(await load([item("elsewhere", "alice", "group", "other")]), null, "another Group's Admin item");
  assert.equal(await load([item("hidden", "alice", "group", "galway", true)]), null, "never a private Admin item");
  assert.equal(await load([item("coach", "alice", "group")], { viewerUserId: "bob", cardTemplateId: "card", kind: "owner" }), null, "never on the standalone Card");
});
