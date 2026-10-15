import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeckVideoPreparation, introductionWindow, type DeckVideoCard } from "../src/lib/deckVideoPreparation";

function cards(length: number, actor = "alice", version = 1): DeckVideoCard[] {
  return Array.from({ length }, (_, i) => ({
    key: `${actor}:${version}:${i}`,
    context: { viewerUserId: actor, cardTemplateId: `card${i}`, version, mode: "working" },
    intro: { id: `intro${i}`, assetId: `intro${i}`, mediaType: "video", provider: "cloudflare-stream", src: `https://videodelivery.net/intro${i}`, description: "Introduction" },
  }));
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let time = 1_000_000;
  const calls: { asset: string; actor: string; version: string }[] = [];
  const images: { node: HTMLImageElement; url: string; finish: () => void; removed: boolean }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const q = new URL(String(input), "http://fixture").searchParams, actor = new Headers(init?.headers).get("X-Personal-Viewer")!;
    const asset = q.get("identity")!; calls.push({ asset, actor, version: q.get("version")! });
    return Response.json({ viewerUserId: actor, assetId: asset, expiresAt: time + 3600_000, reuseUntil: time + 600_000,
      manifestUrl: `https://videodelivery.net/${asset}/manifest/video.m3u8`, thumbnailUrl: `https://videodelivery.net/${asset}/thumbnails/thumbnail.jpg?t=${time}` });
  };
  const manager = createDeckVideoPreparation({ fetch: fetcher, now: () => time, createImage: () => {
    let finish!: () => void;
    const decoded = new Promise<void>(resolve => { finish = resolve; });
    const entry = { node: null as unknown as HTMLImageElement, url: "", finish: () => finish(), removed: false };
    entry.node = { set src(value: string) { entry.url = value; }, setAttribute() {},
      removeAttribute() { entry.removed = true; }, remove() {}, decode: () => decoded } as unknown as HTMLImageElement;
    images.push(entry); return entry.node;
  } });
  const finish = async () => { for (let i = 0; i < 10; i++) { for (const image of images) image.finish(); await tick(); } };
  return { manager, calls, images, finish, advance: () => { time += 600_001; } };
}

test("all four Cards fit at every active position; large Deck boundaries shift unused capacity", () => {
  for (let i = 0; i < 4; i++) assert.deepEqual(introductionWindow(4, i), [0, 1, 2, 3]);
  assert.deepEqual(introductionWindow(20, 7), [5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(introductionWindow(20, 8), [6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(introductionWindow(20, 0), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(introductionWindow(20, 19), [13, 14, 15, 16, 17, 18, 19]);
  assert.deepEqual(introductionWindow(0, 0), []);
});

test("cold active thumbnail gates all background work; at most two jobs include image decoding", async () => {
  const f = fixture(), deck = cards(100); f.manager.update(deck, 0);
  await tick(); assert.equal(f.calls.length, 0); assert.equal(f.images.length, 0);
  f.manager.settled(deck[0].key); await tick();
  assert.equal(f.calls.length, 2); assert.equal(f.images.length, 2);
  await tick(); assert.equal(f.calls.length, 2);
  f.images[0].finish(); await tick(); assert.equal(f.calls.length, 3);
  await f.finish(); assert.equal(f.calls.length, 6);
  assert.ok(f.calls.every(call => Number(call.asset.slice(5)) < 7));
  f.manager.dispose(); assert.ok(f.images.every(image => image.removed));
});

test("four-Card Decks prepare every neighbour at every opening position", async () => {
  for (let active = 0; active < 4; active++) {
    const f = fixture(), deck = cards(4); f.manager.update(deck, active); f.manager.settled(deck[active].key);
    await f.finish(); assert.equal(f.images.length, 3);
    assert.deepEqual(f.calls.map(call => call.asset).sort(), deck.filter((_, i) => i !== active).map(card => card.intro!.assetId).sort());
    f.manager.dispose();
  }
});

test("sliding in both directions reuses overlap, releases images outside seven and keeps valid grants", async () => {
  const f = fixture(), deck = cards(100); f.manager.update(deck, 7); f.manager.settled(deck[7].key); await f.finish();
  const original = f.manager.resource(deck[8]), grant = original.introGrant()!;
  const image = original.thumbnails.peek(grant)!.image;
  f.manager.update(deck, 8); await f.finish();
  assert.strictEqual(original.thumbnails.peek(grant)!.image, image);
  assert.equal(f.calls.length, 8); // Entering Card plus the former cold active.
  f.manager.update(deck, 20); f.manager.settled(deck[20].key); await f.finish();
  assert.equal(original.thumbnails.peek(grant), undefined);
  assert.strictEqual(original.grants!.peek("intro8"), grant);
  const authorizations = f.calls.length;
  f.manager.update(deck, 8); await f.finish();
  assert.equal(f.calls.length, authorizations); // All six neighbours already have valid grants.
  assert.ok(f.images.filter(image => !image.removed).length <= 7);
  f.manager.dispose();
});

test("video entry cancels background work; focused intro is shared and Steps are released on close", async () => {
  const f = fixture(), deck = cards(4); f.manager.update(deck, 0); f.manager.settled(deck[0].key); await tick();
  f.manager.setVideoOpen(true); assert.ok(f.images.every(image => image.removed));
  const count = f.calls.length; await f.finish(); assert.equal(f.calls.length, count);
  f.manager.setVideoOpen(false); await f.finish();
  const resource = f.manager.resource(deck[1]), grant = resource.introGrant()!, image = resource.thumbnails.peek(grant)!.image;
  f.manager.focus(deck[1].key);
  assert.strictEqual(resource.thumbnails.peek(grant)!.image, image);
  const step = { ...grant, assetId: "step", thumbnailUrl: "https://videodelivery.net/step/thumbnails/thumbnail.jpg" };
  resource.thumbnails.prepare(step); await f.finish();
  f.manager.focus(null);
  assert.equal(resource.thumbnails.peek(step), undefined); assert.strictEqual(resource.thumbnails.peek(grant)!.image, image);
  f.manager.dispose();
});

test("expiry, learner/version replacement, no-intro Cards and obsolete completion stay isolated", async () => {
  const f = fixture(), deck = cards(4); deck[0].intro = null;
  f.manager.update(deck, 0); await f.finish(); assert.equal(f.calls.length, 3);
  const old = f.manager.resource(deck[1]), oldGrant = old.introGrant()!;
  f.advance(); f.manager.update(deck, 0); await f.finish(); assert.equal(f.calls.length, 6);
  assert.equal(old.thumbnails.peek(oldGrant), undefined);
  const newer = cards(4, "bob", 2); newer[0].intro = null;
  f.manager.update(newer, 0); await f.finish(); assert.equal(f.calls.length, 9);
  assert.ok(f.calls.slice(-3).every(call => call.actor === "bob" && call.version === "2"));
  assert.equal(old.grants!.peek("intro1"), undefined);
  f.manager.setHidden(true); f.manager.update(cards(100), 40); f.manager.settled("alice:1:40");
  await tick(); assert.equal(f.calls.length, 9);
  f.manager.dispose(); await f.finish(); assert.equal(f.calls.length, 9);
});

test("late authorization after a rapid jump cannot prepare obsolete images; foreground never waits for the queue", async () => {
  const pending: { asset: string; actor: string; signal: AbortSignal; finish: () => void }[] = [];
  let imageRequests = 0;
  const manager = createDeckVideoPreparation({ fetch: (input, init) => new Promise(resolve => {
    const asset = new URL(String(input), "http://fixture").searchParams.get("identity")!;
    const actor = new Headers(init?.headers).get("X-Personal-Viewer")!;
    pending.push({ asset, actor, signal: init!.signal!, finish: () => resolve(Response.json({ assetId: asset, viewerUserId: actor,
      expiresAt: Date.now() + 3600000, reuseUntil: Date.now() + 600000,
      manifestUrl: `https://videodelivery.net/${asset}/manifest/video.m3u8`, thumbnailUrl: `https://videodelivery.net/${asset}/thumbnails/thumbnail.jpg` })) });
  }), createImage: () => { imageRequests++; throw new Error("Obsolete work must not reach image preparation"); } });
  const deck = cards(100); manager.update(deck, 0); manager.settled(deck[0].key);
  assert.equal(pending.length, 2);
  manager.update(deck, 50);
  assert.ok(pending.every(request => request.signal.aborted));
  // A focused consumer uses its reader directly, even while the new active
  // image gate is unresolved and no background slot has been made available.
  const foreground = manager.resource(deck[50]).grants!.read(deck[50].intro!, new AbortController().signal);
  assert.equal(pending.length, 3); assert.equal(pending[2].asset, "intro50");
  for (const request of pending) request.finish();
  await foreground; await tick();
  assert.equal(imageRequests, 0); assert.equal(manager.resource(deck[1]).grants!.peek("intro1"), undefined);
  manager.dispose();
});

test("one denied neighbour stops retrying without blocking the other introductions", async () => {
  const calls: string[] = [];
  const manager = createDeckVideoPreparation({ fetch: async input => {
    calls.push(String(input)); return Response.json({}, { status: 403 });
  } });
  const deck = cards(4); manager.update(deck, 0); manager.settled(deck[0].key);
  await tick(); await tick();
  assert.equal(calls.length, 3);
  await tick(); assert.equal(calls.length, 3);
  manager.dispose();
});
