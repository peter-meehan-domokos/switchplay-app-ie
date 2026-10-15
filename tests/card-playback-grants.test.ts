import assert from "node:assert/strict";
import { test } from "node:test";
import { createCardPlaybackGrants, type CardPlaybackContext } from "../src/lib/cardPlaybackGrants";
import type { CloudflareStreamVideoMediaItem } from "../src/lib/media";
const item = { id: "a", assetId: "a", mediaType: "video", provider: "cloudflare-stream", src: "https://videodelivery.net/a", description: "a" } satisfies CloudflareStreamVideoMediaItem;
const context: CardPlaybackContext = { viewerUserId: "alice", cardTemplateId: "card", version: 1, mode: "working" };
const signal = () => new AbortController().signal;
function fixture() {
  let time = 1_000_000;
  const calls: { viewer: string | null; version: string | null }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const query = new URL(String(input), "http://local").searchParams;
    const viewer = new Headers(init?.headers).get("X-Personal-Viewer");
    calls.push({ viewer, version: query.get("version") });
    return Response.json({ viewerUserId: viewer, assetId: query.get("identity"),
      manifestUrl: "https://videodelivery.net/token/manifest/video.m3u8", thumbnailUrl: "https://videodelivery.net/token/thumbnails/thumbnail.jpg",
      expiresAt: time + 3600_000, reuseUntil: time + 600_000 });
  };
  return { calls, fetcher, now: () => time, advance: (ms: number) => { time += ms; } };
}
test("A → B → A reuses the grant without a fetch; exactly ten minutes triggers fresh authorization", async () => {
  const f = fixture(), cache = createCardPlaybackGrants(context, f.fetcher, f.now);
  const a = await cache.read(item, signal()); await cache.read({ ...item, assetId: "b" }, signal());
  f.advance(599_999); assert.strictEqual(await cache.read(item, signal()), a); assert.equal(f.calls.length, 2);
  f.advance(1); assert.equal(cache.peek("a"), undefined); await cache.read(item, signal()); assert.equal(f.calls.length, 3);
});
test("learners and versions have separate in-memory grants; clearing forces a new request", async () => {
  const f = fixture();
  for (const c of [context, { ...context, viewerUserId: "bob" }, { ...context, version: 2 }]) await createCardPlaybackGrants(c, f.fetcher, f.now).read(item, signal());
  assert.deepEqual(f.calls, [{ viewer: "alice", version: "1" }, { viewer: "bob", version: "1" }, { viewer: "alice", version: "2" }]);
  const cache = createCardPlaybackGrants(context, f.fetcher, f.now); await cache.read(item, signal()); cache.clear(); await cache.read(item, signal()); assert.equal(f.calls.length, 5);
});
test("short token lifetime and request latency cap reuse; an expired grant is never cached", async () => {
  const f = fixture(); const fetcher: typeof fetch = async (...args) => { const body = await (await f.fetcher(...args)).json(); body.expiresAt = f.now() + 40_000; return Response.json(body); };
  const cache = createCardPlaybackGrants(context, fetcher, f.now); await cache.read(item, signal()); f.advance(10_000); assert.equal(cache.peek("a"), undefined);
  const expired = createCardPlaybackGrants(context, async (...args) => { const r = await f.fetcher(...args); f.advance(600_001); return r; }, f.now);
  await assert.rejects(expired.read(item, signal()), /expired/); assert.equal(expired.peek("a"), undefined);
});
test("aborted or cleared late responses never populate the cache", async () => {
  for (const action of ["abort", "clear"]) {
    const f = fixture(); let finish!: (r: Response) => void;
    const cache = createCardPlaybackGrants(context, () => new Promise(resolve => { finish = resolve; }), f.now);
    const abort = new AbortController(), pending = cache.read(item, abort.signal);
    if (action === "abort") abort.abort(); else cache.clear();
    finish(await f.fetcher("http://local?identity=a", { headers: { "X-Personal-Viewer": "alice" } }));
    await assert.rejects(pending, { name: "AbortError" }); assert.equal(cache.peek("a"), undefined);
  }
});
test("wrong actor, asset, URL, failed authorization and provider failures are not cached", async () => {
  for (const change of [{ viewerUserId: "bob" }, { assetId: "b" }, { manifestUrl: "https://evil.invalid/manifest/video.m3u8" }]) {
    const f = fixture(); const cache = createCardPlaybackGrants(context, async (...args) => Response.json({ ...await (await f.fetcher(...args)).json(), ...change }), f.now);
    await assert.rejects(cache.read(item, signal())); assert.equal(cache.peek("a"), undefined);
  }
  for (const status of [401, 403, 503]) { const cache = createCardPlaybackGrants(context, async () => Response.json({}, { status })); await assert.rejects(cache.read(item, signal())); assert.equal(cache.peek("a"), undefined); }
});


function delayedFixture() {
  const f = fixture();
  const waits = new Map<string, { finish: () => Promise<void>; signal?: AbortSignal }>();
  const fetcher: typeof fetch = (input, init) => new Promise(resolve => {
    const id = new URL(String(input), "http://local").searchParams.get("identity")!;
    waits.set(id, { signal: init?.signal ?? undefined, finish: async () => resolve(await f.fetcher(input, init)) });
  });
  return { ...f, waits, fetcher };
}
test("four grants prepare independently; selecting intro joins its request without waiting for Steps", async () => {
  const f = delayedFixture(), cache = createCardPlaybackGrants(context, f.fetcher, f.now), lifetime = new AbortController();
  const items = [item, ...["b", "c", "d"].map(assetId => ({ ...item, assetId }))];
  const arrived: string[] = [];
  const prepared = cache.prepare([...items, item], lifetime.signal, grant => arrived.push(grant.assetId));
  assert.equal(f.waits.size, 4);
  const intro = cache.read(item, signal()); await f.waits.get("a")!.finish(); await intro;
  assert.deepEqual(arrived, ["a"]);
  assert.equal(cache.peek("b"), undefined); assert.equal(f.calls.length, 1);
  for (const id of ["b", "c", "d"]) await f.waits.get(id)!.finish();
  await prepared;
  for (const video of items) await cache.read(video, signal());
  assert.equal(f.calls.length, 4);
});
test("rapid foreground cancellation leaves Card-owned preparation alive; leaving cancels everything", async () => {
  const f = delayedFixture(), cache = createCardPlaybackGrants(context, f.fetcher, f.now), lifetime = new AbortController();
  const prepared = cache.prepare([item, { ...item, assetId: "b" }], lifetime.signal);
  const selection = new AbortController(), foreground = cache.read(item, selection.signal); selection.abort();
  await assert.rejects(foreground, { name: "AbortError" }); assert.equal(f.waits.get("a")!.signal!.aborted, false);
  lifetime.abort(); cache.clear();
  assert.equal(f.waits.get("a")!.signal!.aborted, true); assert.equal(f.waits.get("b")!.signal!.aborted, true);
  await f.waits.get("a")!.finish(); await f.waits.get("b")!.finish(); await prepared;
  assert.equal(cache.peek("a"), undefined); assert.equal(cache.peek("b"), undefined);
});
test("near-expiry preparation refreshes in background while navigation uses the valid old grant", async () => {
  const f = delayedFixture(), cache = createCardPlaybackGrants(context, f.fetcher, f.now);
  const first = cache.read(item, signal()); await f.waits.get("a")!.finish(); const original = await first;
  f.advance(540_000); const refresh = cache.prepare([item], signal());
  assert.strictEqual(await cache.read(item, signal()), original);
  await f.waits.get("a")!.finish(); await refresh; assert.equal(f.calls.length, 2);
  assert.notStrictEqual(cache.peek("a"), original);
});
test("preparation failure does not withhold other grants; denied refresh clears old permissions", async () => {
  const f = fixture(); let deny = false;
  const cache = createCardPlaybackGrants(context, async (input, init) => {
    const id = new URL(String(input), "http://local").searchParams.get("identity");
    return id === "b" ? Response.json({}, { status: 503 }) : deny ? Response.json({}, { status: 403 }) : f.fetcher(input, init);
  }, f.now);
  const results = await cache.prepare([item, { ...item, assetId: "b" }], signal());
  assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected"); assert.ok(cache.peek("a"));
  deny = true; f.advance(540_000); await cache.prepare([item], signal()); assert.equal(cache.peek("a"), undefined);
});
