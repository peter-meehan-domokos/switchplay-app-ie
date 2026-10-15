import assert from "node:assert/strict";
import { test } from "node:test";
import { createCardVideoThumbnails } from "../src/lib/cardVideoThumbnails";

const grant = (assetId: string, token = "first") => ({ assetId, thumbnailUrl: `https://videodelivery.net/${token}/${assetId}.jpg`, reuseUntil: 600_000, expiresAt: 3600_000 });
function fixture() {
  let time = 0, changes = 0;
  const images: { node: HTMLImageElement; complete: () => void; fail: () => void; removed: number; assignments: number }[] = [];
  const cache = createCardVideoThumbnails(() => changes++, () => {
    let resolve!: () => void, reject!: () => void;
    const decoded = new Promise<void>((done, failed) => { resolve = done; reject = () => failed(new Error("Image unavailable")); });
    const entry = { node: null as unknown as HTMLImageElement, complete: () => resolve(), fail: () => reject(), removed: 0, assignments: 0 };
    entry.node = { set src(_value: string) { entry.assignments++; }, setAttribute() {}, removeAttribute() {},
      remove() { entry.removed++; }, decode: () => decoded } as unknown as HTMLImageElement;
    images.push(entry); return entry.node;
  }, () => time);
  return { cache, images, changes: () => changes, advance: (ms: number) => { time += ms; } };
}
test("each grant starts an independent image; decode completes before it becomes displayable", async () => {
  const f = fixture();
  for (const id of ["intro", "step1", "step2", "step3"]) f.cache.prepare(grant(id));
  assert.equal(f.images.length, 4); assert.equal(f.cache.peek(grant("intro"))?.state, "loading");
  f.images[0].complete(); await Promise.resolve();
  assert.equal(f.cache.peek(grant("intro"))?.state, "ready");
  assert.equal(f.cache.peek(grant("step1"))?.state, "loading"); assert.equal(f.changes(), 1);
  for (const id of ["intro", "step1", "intro"]) f.cache.prepare(grant(id));
  assert.strictEqual(f.cache.peek(grant("intro"))?.image, f.images[0].node);
  assert.equal(f.images.length, 4); assert.ok(f.images.every(image => image.assignments === 1));
  f.cache.clear();
});
test("failed images settle without affecting independently prepared images or causing retry loops", async () => {
  const f = fixture(); f.cache.prepare(grant("intro")); f.cache.prepare(grant("step1"));
  f.images[0].fail(); f.images[1].complete(); await Promise.resolve();
  assert.equal(f.cache.peek(grant("intro"))?.state, "failed"); assert.equal(f.cache.peek(grant("step1"))?.state, "ready");
  f.cache.prepare(grant("intro")); assert.equal(f.images.length, 2); f.cache.clear();
});
test("renewed signed URLs discard superseded images and ignore their late decoding", async () => {
  const f = fixture(); f.cache.prepare(grant("intro")); f.cache.prepare(grant("intro", "renewed"));
  assert.equal(f.images[0].removed, 1); assert.equal(f.cache.peek(grant("intro")), undefined);
  f.images[0].complete(); await Promise.resolve(); assert.equal(f.changes(), 0);
  f.images[1].complete(); await Promise.resolve(); assert.equal(f.cache.peek(grant("intro", "renewed"))?.state, "ready");
  f.advance(600_000); assert.equal(f.cache.peek(grant("intro", "renewed")), undefined); f.cache.clear();
});
test("hiding cancels pending images, retains ready images and allows preparation on return", async () => {
  const f = fixture(); f.cache.prepare(grant("intro")); f.cache.prepare(grant("step1"));
  f.images[0].complete(); await Promise.resolve(); f.cache.cancelPending();
  assert.equal(f.images[0].removed, 0); assert.equal(f.images[1].removed, 1);
  f.images[1].complete(); await Promise.resolve(); assert.equal(f.changes(), 1);
  assert.equal(f.cache.peek(grant("step1")), undefined);
  f.cache.prepare(grant("step1")); assert.equal(f.images.length, 3); f.cache.clear();
});
test("Card/learner caches do not share images, clear invalidates pending decodes and token expiry is respected", async () => {
  const first = fixture(), second = fixture(); first.cache.prepare(grant("intro")); second.cache.prepare(grant("intro"));
  assert.notStrictEqual(first.cache.peek(grant("intro"))?.image, second.cache.peek(grant("intro"))?.image);
  first.cache.clear(); first.images[0].complete(); await Promise.resolve();
  assert.equal(first.changes(), 0); assert.equal(first.cache.peek(grant("intro")), undefined);
  const short = { ...grant("short"), expiresAt: 40_000 }; second.cache.prepare(short); second.advance(10_000);
  assert.equal(second.cache.peek(short), undefined); second.cache.prepare(short); assert.equal(second.images.length, 2); second.cache.clear();
});
