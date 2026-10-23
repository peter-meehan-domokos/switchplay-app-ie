import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";
import { createInfoCardIndexes } from "../src/lib/infoCards/repository";

type Route = Record<string, (request: Request, context?: { params: Promise<{ infoCardId: string }> }) => Promise<Response>>;
const fixture = { actor: null as { id: string } | null, db: null as Db | null, client: null as MongoClient | null };
const global = globalThis as typeof globalThis & { __infoApi?: typeof fixture };
let server: MongoMemoryReplSet;
const routes: Record<string, Route> = {};
before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  fixture.client = await new MongoClient(server.getUri()).connect(); fixture.db = fixture.client.db("switchplay_info_api_tests");
  await createInfoCardIndexes(fixture.db); global.__infoApi = fixture;
  for (const name of ["info-cards", "info-cards/[infoCardId]", "info-cards/[infoCardId]/publish", "info-cards/[infoCardId]/publication", "info-cards/[infoCardId]/upload", "info-cards/[infoCardId]/media", "info-card-series", "library/info-cards", "media/card", "media/protected"]) {
    const bundle = await build({ entryPoints: [`src/app/api/${name}/route.ts`], bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
      plugins: [{ name: "info-api-auth-and-disposable-db", setup(builder) {
        builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: "export async function getCurrentUser() { return globalThis.__infoApi.actor; }", loader: "ts" }));
        builder.onLoad({ filter: /src\/lib\/cards\/repository\.ts$/ }, async args => ({ contents: await readFile(args.path, "utf8")
          + "\nCardRepository.application = async () => new CardRepository(globalThis.__infoApi.db, globalThis.__infoApi.client);", loader: "ts" }));
      } }] });
    const fixtureModule = { exports: {} };
    new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve("package.json")), fixtureModule, fixtureModule.exports);
    routes[name] = fixtureModule.exports as Route;
  }
});
after(async () => { delete global.__infoApi; await fixture.client?.close(); await server?.stop(); });
function request(path: string, method = "GET", body?: unknown, headers?: Record<string, string>) {
  return new Request(`http://local/api/${path}`, { method, headers: { ...headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const context = { params: Promise.resolve({ infoCardId: "a" }) };
test("real route boundaries reject unauthenticated, actor-switched and injected requests", async () => {
  const collection = routes["info-cards"];
  const unauth = await collection.POST(request("info-cards", "POST", { infoCardId: "a" }));
  assert.equal(unauth.status, 401); assert.equal(unauth.headers.get("Cache-Control"), "private, no-store");
  fixture.actor = { id: "alice" };
  assert.equal((await collection.POST(request("info-cards", "POST", { infoCardId: "a" }, { "X-Creator-Actor": "bob" }))).status, 409);
  assert.equal((await collection.POST(request("info-cards", "POST", { infoCardId: { $ne: null } }))).status, 400);
  assert.equal((await collection.POST(request("info-cards", "POST", { infoCardId: "a", ownerUserId: "bob" }))).status, 400);
  assert.equal((await collection.POST(request("info-cards", "POST", { infoCardId: "a" }))).status, 200);
  assert.equal((await routes["library/info-cards"].GET(request("library/info-cards", "GET", undefined, { "X-Library-Viewer": "bob" }))).status, 409);
  assert.equal((await routes["library/info-cards"].GET(request("library/info-cards?actor=bob"))).status, 400);
});
test("real APIs save incomplete drafts, expose actionable capacity errors, publish and recover", async () => {
  fixture.actor = { id: "alice" };
  const series = await routes["info-card-series"].POST(request("info-card-series", "POST", { seriesId: "s", title: "Basics" })); assert.equal(series.status, 200);
  const content = { title: "", body: "", seriesId: "s", mediaItem: null };
  const entity = routes["info-cards/[infoCardId]"];
  assert.equal((await entity.PATCH(request("info-cards/a", "PATCH", { revision: 0, content, visibility: "private" }), context)).status, 200);
  const publish = routes["info-cards/[infoCardId]/publish"];
  const capacity = await publish.POST(request("info-cards/a/publish", "POST", { revision: 1 }), context);
  assert.equal(capacity.status, 422); assert.equal((await capacity.json()).capacity.fits, false);
  assert.equal((await entity.PATCH(request("info-cards/a", "PATCH", { revision: 0, content, visibility: "public" }), context)).status, 409);
  await entity.PATCH(request("info-cards/a", "PATCH", { revision: 1, content: { ...content, title: "Signs", body: "Keep signs attached." }, visibility: "public" }), context);
  const published = await publish.POST(request("info-cards/a/publish", "POST", { revision: 2 }), context);
  assert.equal(published.status, 200); assert.equal((await published.json()).version, 1);
  assert.equal((await (await publish.POST(request("info-cards/a/publish", "POST", { revision: 2 }), context)).json()).version, 1);
  const editor = await entity.GET(request("info-cards/a"), context); const data = await editor.json();
  assert.equal(data.root.draft, null); assert.equal(data.publication.version, 1); assert.equal(data.selectedSeries.title, "Basics");
  assert.equal(editor.headers.get("Vary"), "Cookie");
});
test("foreign editor access is forbidden while public snapshots remain available", async () => {
  fixture.actor = { id: "bob" };
  assert.equal((await routes["info-cards/[infoCardId]"].GET(request("info-cards/a"), context)).status, 403);
  const snapshot = await routes["info-cards/[infoCardId]/publication"].GET(request("info-cards/a/publication"), context);
  assert.equal(snapshot.status, 200); assert.equal((await snapshot.json()).version, 1);
  assert.equal((await routes["info-cards/[infoCardId]/upload"].POST(request("info-cards/a/upload", "POST", { kind: "image", contentType: "image/png" }), context)).status, 403);
  assert.equal((await routes["info-cards/[infoCardId]/media"].GET(request("info-cards/a/media?version=1&revision=3"), context)).status, 403);
  assert.equal((await routes["info-cards/[infoCardId]/media"].GET(request("info-cards/a/media?version=1"), context)).status, 403);
});
test("real deletion API reveals only blocker categories and fails safely", async () => {
  fixture.actor = { id: "alice" };
  await fixture.db!.collection("cardTemplateVersions").insertOne({ cardTemplateId: "hidden-main", ownerUserId: "bob", content: { infoCardIds: ["a"], title: "SECRET" } });
  const response = await routes["info-cards/[infoCardId]"].DELETE(request("info-cards/a", "DELETE", { revision: 3 }), context);
  assert.equal(response.status, 409); const data = await response.json();
  assert.deepEqual(data.blockers, { draft: false, historical: true }); assert(!JSON.stringify(data).includes("SECRET"));
});

test("forged personal/main references cannot route private info assets through legacy media APIs", async t => {
  fixture.actor = { id: "bob" }; t.mock.method(console, "error", () => {});
  const oldFlag = process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA;
  process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA = "1";
  t.after(() => { if (oldFlag === undefined) delete process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA; else process.env.NEXT_PUBLIC_SWITCHPLAY_PROTECTED_MEDIA = oldFlag; });
  const media = { id: "forged", mediaType: "video", provider: "cloudflare-stream", assetId: "private-info-video", src: "https://iframe.videodelivery.net/private-info-video", description: "copied" };
  await fixture.db!.collection("infoCardMediaAssets").insertOne({ provider: media.provider, assetId: media.assetId, src: media.src, infoCardId: "private-info", ownerUserId: "alice" });
  await fixture.db!.collection("users").insertOne({ _id: "bob", cardsData: [{ cardTemplateId: "forged-main", mediaItems: [media] }], decksData: [] } as never);
  const personal = await routes["media/card"].GET(request("media/card?action=playback&viewerUserId=bob&cardTemplateId=forged-main&sourceCardTemplateId=forged-main&mediaItemId=forged"));
  assert.equal(personal.status, 403);
  const broad = await routes["media/protected"].GET(request("media/protected?provider=stream&identity=private-info-video&format=manifest"));
  assert.equal(broad.status, 403);
  const exact = await routes["media/protected"].GET(request("media/protected?provider=stream&identity=private-info-video&format=grant&cardTemplateId=forged-main&version=1&mode=working", "GET", undefined, { "X-Personal-Viewer": "bob" }));
  assert.equal(exact.status, 403);
  const image = await routes["media/protected"].GET(request("media/protected?provider=r2&identity=https%3A%2F%2Fassets.invalid%2Finfo-cards%2Falice%2Fa%2Fprivate.png&format=image"));
  assert.equal(image.status, 403);
});
