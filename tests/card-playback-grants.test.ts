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
      expiresAt: time + 3600_000, reuseUntil: time + 300_000 });
  };
  return { calls, fetcher, now: () => time, advance: (ms: number) => { time += ms; } };
}
test("A → B → A reuses the grant without a fetch; exactly five minutes triggers fresh authorization", async () => {
  const f = fixture(), cache = createCardPlaybackGrants(context, f.fetcher, f.now);
  const a = await cache.read(item, signal()); await cache.read({ ...item, assetId: "b" }, signal());
  f.advance(299_999); assert.strictEqual(await cache.read(item, signal()), a); assert.equal(f.calls.length, 2);
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
  const expired = createCardPlaybackGrants(context, async (...args) => { const r = await f.fetcher(...args); f.advance(300_001); return r; }, f.now);
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
