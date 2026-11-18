import assert from "node:assert/strict";
import test from "node:test";
import { instructionalImageUrl, readInstructionalImageContext, type InstructionalImageContext } from "../src/lib/instructionalImageContext";
import { createInstructionalImageHandler, MAX_INSTRUCTIONAL_IMAGE_BYTES } from "../src/lib/instructionalImages";
import type { ImageMediaItem } from "../src/lib/media";
import { r2Location } from "../src/lib/cards/protectedMedia";

const context: InstructionalImageContext = { viewerUserId: "learner", cardTemplateId: "card", version: 2, mode: "canonical", deckTemplateId: "deck", deckVersion: 1, stepId: "intro", attachmentId: "legacy:diagram" };
const item: ImageMediaItem = { id: "diagram", mediaType: "image", provider: "cloudflare-r2", src: "https://r2.invalid/main/diagram.png", assetId: "main/diagram.png", description: "Diagram" };
const request = (query = instructionalImageUrl(context), signal?: AbortSignal) => new Request(`https://app.invalid${query}`, { signal });
function fixture(overrides: Partial<Parameters<typeof createInstructionalImageHandler>[0]> = {}) {
  const calls: string[] = [];
  const deps = { enabled: true, currentUser: async () => ({ id: "learner" }), consumeBudget: () => true,
    resolve: async (actor: string, target: InstructionalImageContext) => { calls.push("resolve"); assert.equal(actor, context.viewerUserId); assert.deepEqual(target, context); return item; },
    read: async (media: ImageMediaItem) => { calls.push("read"); assert.equal(media, item); return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png", "Cache-Control": "public", "Content-Disposition": "attachment" } }); }, ...overrides };
  return { handle: createInstructionalImageHandler(deps), calls };
}
test("instructional image URLs contain bounded exact context, including legacy attachment IDs, and no provider URL", () => {
  const url = new URL(instructionalImageUrl(context), "https://app.invalid");
  assert.deepEqual(readInstructionalImageContext(url.searchParams), context); assert.equal(url.searchParams.has("src"), false);
  for (const query of [url.searchParams + "&src=https://private.invalid", url.searchParams + "&version=2", "viewerUserId=learner",
    url.searchParams.toString().replace("version=2", "version=0"), url.searchParams.toString().replace("version=2", "version=02"),
    url.searchParams.toString().replace("mode=canonical", "mode=guest"), url.searchParams.toString().replace("attachmentId=legacy%3Adiagram", `attachmentId=${"a".repeat(201)}`)]) {
    assert.equal(readInstructionalImageContext(new URLSearchParams(query)), null);
  }
});
test("authorized raster bytes are private, bounded and inline with no upstream URL or cache header exposure", async () => {
  const { handle, calls } = fixture(), response = await handle(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Vary"), "Cookie"); assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Content-Disposition"), "inline"); assert.equal(response.headers.get("Content-Length"), "3");
  assert.equal(response.headers.get("Location"), null); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([1, 2, 3]));
  assert.deepEqual(calls, ["resolve", "read"]);
});
test("feature gate, missing authentication, actor changes and malformed queries cannot reach storage or provider", async () => {
  for (const [overrides, status] of [[{ enabled: false }, 404], [{ currentUser: async () => null }, 401], [{ currentUser: async () => ({ id: "other" }) }, 403], [{ consumeBudget: () => false }, 429]] as const) {
    const { handle, calls } = fixture(overrides); assert.equal((await handle(request())).status, status); assert.deepEqual(calls, []);
  }
  const { handle, calls } = fixture(); assert.equal((await handle(request(instructionalImageUrl(context) + "&src=forged"))).status, 400); assert.deepEqual(calls, []);
});
test("SVG, HTML, empty bytes, provider errors and oversized streams fail before successful delivery", async () => {
  for (const read of [async () => new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
    async () => new Response("<html/>", { headers: { "Content-Type": "text/html" } }),
    async () => new Response(new Uint8Array(), { headers: { "Content-Type": "image/png" } })]) {
    assert.equal((await fixture({ read }).handle(request())).status, 502);
  }
  assert.equal((await fixture({ read: async () => new Response(null, { status: 404 }) }).handle(request())).status, 404);
  let cancelled = false;
  const oversized = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MAX_INSTRUCTIONAL_IMAGE_BYTES + 1)); }, cancel() { cancelled = true; } });
  const response = await fixture({ read: async () => new Response(oversized, { headers: { "Content-Type": "image/png", "Content-Length": "1" } }) }).handle(request());
  assert.equal(response.status, 413); assert.equal(cancelled, true);
});
test("concurrent response buffering is bounded until the body drains, cancels or the request aborts", async () => {
  const { handle } = fixture(), controller = new AbortController();
  const responses = [await handle(request(undefined, controller.signal))];
  for (let i = 0; i < 3; i++) responses.push(await handle(request()));
  assert.equal((await handle(request())).status, 429);
  controller.abort(); await assert.rejects(responses[0].arrayBuffer());
  const again = await handle(request()); assert.equal(again.status, 200); await again.body!.cancel();
  for (const response of responses.slice(1)) await response.body!.cancel();
  const final = await handle(request()); assert.equal(final.status, 200); await final.arrayBuffer();
});
test("stored image references still need a configured R2 origin and matching safe object key", async () => {
  const env = { CLOUDFLARE_R2_PUBLIC_BASE_URL: "https://r2.invalid", CLOUDFLARE_R2_BUCKET_NAME: "main" };
  assert.deepEqual(r2Location(item, env), { bucket: "main", key: "main/diagram.png" });
  for (const changed of [{ ...item, src: "https://external.invalid/private.png" }, { ...item, src: "https://r2.invalid/main/other.png" },
    { ...item, src: "https://r2.invalid/main/%2e%2e/private.png" }]) {
    assert.throws(() => r2Location(changed, env));
    const { handle } = fixture({ read: async () => { r2Location(changed, env); return new Response(); } });
    assert.equal((await handle(request())).status, 502);
  }
});
