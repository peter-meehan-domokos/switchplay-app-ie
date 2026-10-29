import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";

// Exercise the real route with fixture auth/provider boundaries, following the
// existing API-test bundling convention. No MongoDB or provider requests occur.
async function routeFixture() {
  const bundle = await build({ entryPoints: ["src/app/api/media/protected/route.ts"], bundle: true,
    platform: "node", format: "cjs", packages: "external", write: false,
    plugins: [{ name: "protected-media-fixture", setup(builder) {
      builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: "export async function getCurrentUser() { return globalThis.__mediaRouteFixture.actor; }", loader: "ts" }));
      builder.onLoad({ filter: /src\/lib\/cards\/repository\.ts$/ }, () => ({ contents: "export class CardRepository { static async application() { return {}; } }", loader: "ts" }));
      builder.onLoad({ filter: /src\/lib\/cards\/protectedMedia\.ts$/ }, () => ({ contents: `
        import { requireCondition } from "./domain";
        export async function authorizeProtectedMedia() {
          requireCondition(!globalThis.__mediaRouteFixture.denied, "MEDIA_FORBIDDEN");
          return {};
        }
        export async function readProtectedImage() {
          globalThis.__mediaRouteFixture.providerCalls++;
          throw new Error("private provider failure details");
        }
        export async function authorizeCardPlayback(_repo, _actor, context, assetId) {
          requireCondition(!globalThis.__mediaRouteFixture.denied, "MEDIA_FORBIDDEN");
          globalThis.__mediaRouteFixture.context = { ...context, assetId };
        }
        export async function streamPlaybackGrant(assetId) {
          globalThis.__mediaRouteFixture.grantCalls++;
          return { assetId, manifestUrl: 'https://videodelivery.net/signed/manifest/video.m3u8',
            thumbnailUrl: 'https://videodelivery.net/signed/thumbnails/thumbnail.jpg', expiresAt: Date.now()+3600000, reuseUntil: Date.now()+300000 };
        }
        export async function streamTokenUrl() { throw new Error("Unexpected Stream request"); }
      `, loader: "ts" }));
    } }] });
  const fixtureModule = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve("package.json")), fixtureModule, fixtureModule.exports);
  return fixtureModule.exports as { GET(request: Request): Promise<Response> };
}

test("protected image route catches asynchronous failures and returns a private sanitized response", async (t) => {
  const previous = process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA;
  process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA = "1";
  const fixture: { actor: { id: string } | null; denied: boolean; providerCalls: number } = { actor: { id: "fixture" }, denied: false, providerCalls: 0 };
  const global = globalThis as typeof globalThis & { __mediaRouteFixture?: typeof fixture };
  global.__mediaRouteFixture = fixture;
  t.after(() => { delete global.__mediaRouteFixture; if (previous === undefined) delete process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA; else process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA = previous; });
  t.mock.method(console, "error", () => {});
  const { GET } = await routeFixture();
  const response = await GET(new Request("http://local/api/media/protected?provider=r2&identity=fixture&format=image"));
  assert.equal(fixture.providerCalls, 1);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Vary"), "Cookie");
  assert.deepEqual(await response.json(), { error: "Media could not be loaded" });
  fixture.denied = true;
  assert.equal((await GET(new Request("http://local/api/media/protected?provider=r2&identity=fixture&format=image"))).status, 403);
  assert.equal(fixture.providerCalls, 1);
  fixture.actor = null;
  assert.equal((await GET(new Request("http://local/api/media/protected?provider=r2&identity=fixture&format=image"))).status, 401);
  assert.equal(fixture.providerCalls, 1);
});


test("Card playback descriptor is private, actor-bound and mints one grant for manifest and thumbnail", async (t) => {
  const previous = process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA;
  process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA = "1";
  const fixture = { actor: { id: "alice" } as { id: string } | null, denied: false, grantCalls: 0, context: {} };
  const global = globalThis as typeof globalThis & { __mediaRouteFixture?: typeof fixture };
  global.__mediaRouteFixture = fixture;
  t.after(() => { delete global.__mediaRouteFixture; if (previous === undefined) delete process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA; else process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA = previous; });
  t.mock.method(console, "error", () => {});
  const { GET } = await routeFixture();
  const url = "http://local/api/media/protected?provider=stream&identity=video&format=grant&cardTemplateId=card&version=2&mode=working";
  const response = await GET(new Request(url, { headers: { "X-Personal-Viewer": "alice" } }));
  assert.equal(response.status, 200); assert.equal(fixture.grantCalls, 1);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store"); assert.equal(response.headers.get("Vary"), "Cookie");
  const body = await response.json(); assert.equal(body.viewerUserId, "alice");
  assert.equal(new URL(body.manifestUrl).pathname.split("/")[1], new URL(body.thumbnailUrl).pathname.split("/")[1]);
  assert.deepEqual(fixture.context, { cardTemplateId: "card", version: 2, mode: "working", assetId: "video" });
  assert.equal((await GET(new Request(url, { headers: { "X-Personal-Viewer": "bob" } }))).status, 403);
  fixture.denied = true;
  assert.equal((await GET(new Request(url, { headers: { "X-Personal-Viewer": "alice" } }))).status, 403);
  fixture.actor = null; assert.equal((await GET(new Request(url))).status, 401); assert.equal(fixture.grantCalls, 1);
});
