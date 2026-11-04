import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";

type Fixture = { actor: { id: string } | null; denied: boolean; uncertain: boolean; calls: { method: string; args: unknown[] }[] };
async function route(path: string) {
  const bundle = await build({ entryPoints: [path], bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
    plugins: [{ name: "group-media-fixture", setup(b) {
      b.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ loader: "ts", contents: `export async function getCurrentUser() { return globalThis.__groupMediaRoute.actor; }` }));
      b.onLoad({ filter: /src\/lib\/cards\/repository\.ts$/ }, () => ({ loader: "ts", contents: `export class CardRepository { static async application() { return {}; } }` }));
      b.onLoad({ filter: /src\/lib\/groupExperiences\/repository\.ts$/ }, () => ({ loader: "ts", contents: `export class GroupExperienceRepository { constructor(cards) { this.cards = cards; } }` }));
      b.onLoad({ filter: /src\/lib\/groupExperiences\/media\/repository\.ts$/ }, () => ({ loader: "ts", contents: `
        import { requireCondition } from "../../cards/domain";
        import { GroupMediaAllocationUncertain } from "./contracts";
        export class GroupMediaRepository {
          constructor() { for (const name of ["allocate", "commit", "delete", "hide", "groupFeed", "ownerFeed", "status", "deliver"]) this[name] = async (...args) => {
            requireCondition(!globalThis.__groupMediaRoute.denied, "GROUP_MEDIA_FORBIDDEN");
            if (globalThis.__groupMediaRoute.uncertain) throw new GroupMediaAllocationUncertain("reserved-id");
            globalThis.__groupMediaRoute.calls.push({ method: name, args });
            return name === "deliver" ? new Response("protected bytes") : { ok: true };
          }; }
        }
      ` }));
    } }] });
  const fixtureModule = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve("package.json")), fixtureModule, fixtureModule.exports);
  return fixtureModule.exports as Record<string, (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>>;
}
function setup(t: TestContext) {
  const previous = process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED;
  process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = "1";
  const fixture: Fixture = { actor: { id: "bob" }, denied: false, uncertain: false, calls: [] };
  const global = globalThis as typeof globalThis & { __groupMediaRoute?: Fixture }; global.__groupMediaRoute = fixture;
  t.after(() => { delete global.__groupMediaRoute; if (previous === undefined) delete process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED; else process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = previous; });
  return fixture;
}
const context = { params: Promise.resolve({ contributionId: "contribution", experienceId: "group", cardTemplateId: "card" }) };

test("owner media route is authenticated, actor-bound, private and survives disabled Group entry", async t => {
  const f = setup(t), r = await route("src/app/api/group-media/[contributionId]/route.ts");
  process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = "0";
  const response = await r.GET(new Request("http://local/api/group-media/contribution"), context);
  assert.equal(await response.text(), "protected bytes"); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Vary"), "Cookie"); assert.deepEqual(f.calls[0].args.slice(0, 4), ["bob", "contribution", { kind: "owner" }, "playback"]);
  assert.equal((await r.GET(new Request("http://local/api/group-media/contribution?experienceId=group"), context)).status, 503);
  assert.equal((await r.GET(new Request("http://local/api/group-media/contribution", { headers: { "X-Group-Viewer": "alice" } }), context)).status, 409);
  f.actor = null; assert.equal((await r.GET(new Request("http://local/api/group-media/contribution"), context)).status, 401);
});

test("Group delivery context is explicit, download preparation uses POST, invalid queries and origins fail", async t => {
  const f = setup(t), r = await route("src/app/api/group-media/[contributionId]/route.ts");
  const url = "http://local/api/group-media/contribution?experienceId=group&subjectUserId=carol&action=download";
  assert.equal((await r.GET(new Request(url), context)).status, 200);
  assert.deepEqual(f.calls[0].args.slice(0, 4), ["bob", "contribution", { kind: "group", experienceId: "group", subjectUserId: "carol" }, "download"]);
  await r.POST(new Request(url, { method: "POST" }), context); assert.equal(f.calls[1].args[3], "prepare-download");
  assert.equal((await r.POST(new Request(url, { method: "POST", headers: { Origin: "https://foreign.invalid" } }), context)).status, 403);
  assert.equal((await r.GET(new Request(url + "&assetId=forged"), context)).status, 400);
  assert.equal((await r.GET(new Request("http://local/api/group-media/contribution?subjectUserId=carol"), context)).status, 403);
  f.denied = true; assert.equal((await r.GET(new Request(url), context)).status, 403); assert.equal(f.calls.length, 2);
});

test("allocation uncertainty returns only the owned reservation for safe retry or cancellation", async t => {
  const f = setup(t), r = await route("src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/media/route.ts");
  f.uncertain = true;
  const response = await r.POST(new Request("http://local/api/group-experiences/group/cards/card/media", { method: "POST", body: "{}" }), context);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "GROUP_MEDIA_ALLOCATION_UNCERTAIN", code: "GROUP_MEDIA_ALLOCATION_UNCERTAIN", contributionId: "reserved-id", outcome: "uncertain", retrySameOperation: true });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("Group mutations compare Origin with the actual incoming host when Next uses an internal request URL", async t => {
  const f = setup(t), r = await route("src/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/media/route.ts");
  const url = "http://localhost:4187/api/group-experiences/group/cards/card/media";
  assert.equal((await r.POST(new Request(url, { method: "POST", headers: { Host: "192.168.1.38:4187", Origin: "http://192.168.1.38:4187", "Sec-Fetch-Site": "same-origin" }, body: "{}" }), context)).status, 200);
  assert.equal(f.calls.length, 1);
  for (const headers of [
    { Host: "192.168.1.38:4187", Origin: "https://foreign.invalid", "X-Forwarded-Host": "foreign.invalid" },
    { Host: "192.168.1.38:4187", Origin: "http://192.168.1.38:4187", "Sec-Fetch-Site": "cross-site" },
  ] as Record<string, string>[]) assert.equal((await r.POST(new Request(url, { method: "POST", headers, body: "{}" }), context)).status, 403);
  assert.equal(f.calls.length, 1);
});

test("Group-scoped creator Remove binds origin, revision, current actor and membership epoch", async t => {
  const f = setup(t), r = await route("src/app/api/group-experiences/[experienceId]/media/[contributionId]/route.ts");
  const request = (data: unknown) => new Request("http://local/api/group-experiences/group/media/contribution", { method: "DELETE", body: JSON.stringify(data) });
  assert.equal((await r.DELETE(request({ expectedRevision: 2, accessEpoch: 4 }), context)).status, 200);
  assert.deepEqual(f.calls[0], { method: "delete", args: ["bob", "contribution", { expectedRevision: 2 }, { experienceId: "group", accessEpoch: 4 }] });
  assert.equal((await r.DELETE(request({ expectedRevision: 2 }), context)).status, 409);
  assert.equal((await r.DELETE(request({ expectedRevision: 2, accessEpoch: 4, authorUserId: "alice" }), context)).status, 400);
  f.denied = true; assert.equal((await r.DELETE(request({ expectedRevision: 2, accessEpoch: 4 }), context)).status, 403);
  assert.equal(f.calls.length, 1);
});
