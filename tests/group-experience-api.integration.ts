import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, completion } from "./helpers/groupExperiences";

type Context = { params: Promise<{ experienceId: string; cardTemplateId?: string }> };
type Route = Record<string, (request: Request, context?: Context) => Promise<Response>>;
const state = { actor: null as { id: string } | null, db: null as Db | null, client: null as MongoClient | null };
const global = globalThis as typeof globalThis & { __groupApi?: typeof state };
let mongo: MongoMemoryReplSet, fixture: Awaited<ReturnType<typeof groupFixture>>;
const routes: Record<string, Route> = {}, originalFlag = process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  state.client = await new MongoClient(mongo.getUri()).connect(); fixture = await groupFixture(state.client); state.db = fixture.cards.db;
  global.__groupApi = state; process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = "1";
  for (const path of ["", "/[experienceId]", "/[experienceId]/members", "/[experienceId]/open", "/[experienceId]/summary",
    "/[experienceId]/cards/[cardTemplateId]", "/[experienceId]/cards/[cardTemplateId]/perspectives",
    "/[experienceId]/cards/[cardTemplateId]/personal-learning", "/[experienceId]/cards/[cardTemplateId]/group-learning"]) {
    const bundle = await build({ entryPoints: [`src/app/api/group-experiences${path}/route.ts`], bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
      plugins: [{ name: "group-auth-and-disposable-db", setup(builder) {
        builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: "export async function getCurrentUser() { return globalThis.__groupApi.actor; }", loader: "ts" }));
        builder.onLoad({ filter: /src\/lib\/cards\/repository\.ts$/ }, async args => ({ contents: await readFile(args.path, "utf8")
          + "\nCardRepository.application = async () => new CardRepository(globalThis.__groupApi.db, globalThis.__groupApi.client);", loader: "ts" }));
      } }] });
    const fixtureModule = { exports: {} }; new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve("package.json")), fixtureModule, fixtureModule.exports);
    routes[path] = fixtureModule.exports as Route;
  }
});
after(async () => { delete global.__groupApi; if (originalFlag === undefined) delete process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED; else process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = originalFlag;
  await state.client?.close(); await mongo?.stop(); });
function req(path = "", method = "GET", body?: unknown, headers?: Record<string, string>) {
  return new Request(`http://local/api/group-experiences${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function context(cardTemplateId = fixture.ids[0]): Context { return { params: Promise.resolve({ experienceId: fixture.experienceId, cardTemplateId }) }; }
test("new APIs are disabled by default and all responses are private and uncached", async () => {
  delete process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED;
  const disabled = await routes[""].GET(req()); assert.equal(disabled.status, 503);
  process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = "1"; state.actor = null;
  const unauth = await routes[""].POST(req("", "POST", fixture.command)); assert.equal(unauth.status, 401);
  for (const response of [disabled, unauth]) { assert.equal(response.headers.get("Cache-Control"), "private, no-store"); assert.equal(response.headers.get("Vary"), "Cookie"); }
});
test("authenticated actor binding, strict fields and query validation reject forged operations", async () => {
  state.actor = { id: "alice" };
  assert.equal((await routes[""].GET(req("", "GET", undefined, { "X-Group-Viewer": "bob" }))).status, 409);
  assert.equal((await routes[""].POST(req("", "POST", { ...fixture.command, actor: "bob" }))).status, 400);
  assert.equal((await routes[""].GET(req("?actor=bob"))).status, 400);
  assert.equal((await routes[""].GET(req("?limit=1&limit=2"))).status, 400);
  const invalid = await routes["/[experienceId]/cards/[cardTemplateId]"].GET(req("/x?perspective=group&subjectUserId=bob"), context()); assert.equal(invalid.status, 400);
  const injection = await routes["/[experienceId]/members"].POST(req("/x", "POST", { operationId: "x", kind: "add-follower", targetUserId: { $ne: "alice" }, expectedStructureRevision: 0 }), context()); assert.equal(injection.status, 400);
});
test("direct APIs enforce own learning, admin writes and cross-group denial", async () => {
  const personal = routes["/[experienceId]/cards/[cardTemplateId]/personal-learning"], group = routes["/[experienceId]/cards/[cardTemplateId]/group-learning"];
  state.actor = { id: "alice" }; assert.equal((await personal.PATCH(req("/x", "PATCH", completion("a0")), context())).status, 403);
  state.actor = { id: "bob" }; assert.equal((await group.PATCH(req("/x", "PATCH", completion("a0")), context())).status, 403);
  assert.equal((await personal.PATCH(req("/x", "PATCH", { ...completion("a0"), subjectUserId: "carol" }), context())).status, 400);
  assert.equal((await personal.PATCH(req("/x", "PATCH", { ...completion("a0"), targetDate: "2027-01-01" }), context())).status, 400);
  assert.equal((await personal.PATCH(req("/x", "PATCH", completion("a0")), context())).status, 200);
  assert.equal((await routes["/[experienceId]/cards/[cardTemplateId]"].GET(req("/x?perspective=follower&subjectUserId=carol"), context())).status, 403);
  state.actor = { id: "outsider" };
  for (const path of ["/[experienceId]", "/[experienceId]/summary", "/[experienceId]/members", "/[experienceId]/cards/[cardTemplateId]/perspectives"]) {
    assert.equal((await routes[path].GET(req("/x"), context())).status, 403);
  }
  assert.equal((await personal.PATCH(req("/x", "PATCH", completion("a0")), context())).status, 403);
  assert.equal((await routes["/[experienceId]/open"].POST(req("/x", "POST", { accessEpoch: 0 }), context())).status, 403);
});
test("successful API creation, membership, open, projections and summaries retain server-selected identities", async () => {
  state.actor = { id: "alice" };
  const create = await routes[""].POST(req("", "POST", { ...fixture.command, operationId: "api-created" })); assert.equal(create.status, 200);
  assert.equal((await create.json()).viewerUserId, "alice"); assert.equal(create.headers.get("X-Group-Viewer"), "alice");
  const membership = await routes["/[experienceId]/members"].POST(req("/x", "POST", { operationId: "api-add", expectedStructureRevision: 0, kind: "add-follower", targetUserId: "dave" }), context()); assert.equal(membership.status, 200);
  const inspect = await routes["/[experienceId]/cards/[cardTemplateId]"].GET(req("/x?perspective=follower&subjectUserId=bob"), context());
  assert.equal(inspect.status, 200); const dto = await inspect.json(); assert.equal(dto.learning.items[0].completionStatus, "done"); assert.equal(dto.subjectUserId, "bob");
  const batch = await routes["/[experienceId]/cards/[cardTemplateId]/perspectives"].GET(req("/x?limit=2"), context()); assert.equal(batch.status, 200); assert.equal((await batch.json()).followers.length, 2);
  state.actor = { id: "dave" };
  assert.equal((await routes["/[experienceId]/open"].POST(req("/x", "POST", { accessEpoch: 0, cardTemplateId: fixture.ids[0] }), context())).status, 200);
  assert.equal((await routes["/[experienceId]/summary"].GET(req("/x"), context())).status, 200);
  assert.equal((await fixture.cards.getPersonalUser("dave"))!.cardsData[0].targetDate, null);
});
