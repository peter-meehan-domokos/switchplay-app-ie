import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedVideoGuard } from "../src/components/media/publishedVideo";
import type { CloudflareStreamVideoMediaItem } from "../src/lib/media";
const media = (assetId: string) => ({ id: assetId, assetId, mediaType: "video", provider: "cloudflare-stream", src: `https://videodelivery.net/${assetId}`, description: assetId }) satisfies CloudflareStreamVideoMediaItem;
test("prepared Library readiness is reused for introduction and three Steps", async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    calls.push(new URL(input, "http://local").searchParams.get("assetId")!); return Response.json({ status: "ready" });
  });
  const guard = publishedVideoGuard("card", "card", 1), signal = new AbortController().signal;
  await Promise.all(["intro", "step1", "step2", "step3"].map(id => guard.prepare!(media(id), signal)));
  for (const id of ["intro", "step1", "step2", "step3", "intro", "step1"]) await guard(media(id), signal);
  assert.deepEqual(calls, ["intro", "step1", "step2", "step3"]);
});
test("background processing checks never poll or mark a video ready prematurely", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ status: calls === 1 ? "processing" : "ready" }); });
  const guard = publishedVideoGuard("card", "card", 1), signal = new AbortController().signal;
  await guard.prepare!(media("a"), signal); assert.equal(calls, 1);
  await guard(media("a"), signal); assert.equal(calls, 2);
});
test("superseded preparation cannot seed readiness; failures remain retryable", async t => {
  let finish!: (response: Response) => void;
  t.mock.method(globalThis, "fetch", () => new Promise<Response>(resolve => { finish = resolve; }));
  const guard = publishedVideoGuard("card", "card", 1), abort = new AbortController();
  const pending = guard.prepare!(media("a"), abort.signal); abort.abort(); finish(Response.json({ status: "ready" }));
  await assert.rejects(pending, { name: "AbortError" });
  const retry = guard(media("a"), new AbortController().signal); finish(Response.json({ status: "ready" })); await retry;
});


test("selected Library playback joins its own preparation and never waits for another Step", async t => {
  const waits = new Map<string, (r: Response) => void>(); let calls = 0;
  t.mock.method(globalThis, "fetch", (input: string) => new Promise<Response>(resolve => {
    calls++; waits.set(new URL(input, "http://local").searchParams.get("assetId")!, resolve);
  }));
  const guard = publishedVideoGuard("card", "card", 1), lifetime = new AbortController();
  const intro = guard.prepare!(media("intro"), lifetime.signal), other = guard.prepare!(media("other"), lifetime.signal);
  const playing = guard(media("intro"), new AbortController().signal); assert.equal(calls, 2);
  waits.get("intro")!(Response.json({ status: "ready" })); await intro; await playing; assert.equal(calls, 2);
  waits.get("other")!(Response.json({ status: "ready" })); await other;
});
