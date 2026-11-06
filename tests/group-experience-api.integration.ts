import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, completion, publishGroupCard } from "./helpers/groupExperiences";

type Context = { params: Promise<{ experienceId: string; cardTemplateId?: string; userId?: string }> };
type Route = Record<string, (request: Request, context?: Context) => Promise<Response>>;
const state = { actor: null as { id: string } | null, db: null as Db | null, client: null as MongoClient | null };
const global = globalThis as typeof globalThis & { __groupApi?: typeof state };
let mongo: MongoMemoryReplSet, fixture: Awaited<ReturnType<typeof groupFixture>>;
const routes: Record<string, Route> = {};
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  state.client = await new MongoClient(mongo.getUri()).connect(); fixture = await groupFixture(state.client); state.db = fixture.cards.db;
  global.__groupApi = state;
  for (const path of ["", "/[experienceId]", "/[experienceId]/members", "/[experienceId]/open", "/[experienceId]/summary",
    "/[experienceId]/cards/[cardTemplateId]", "/[experienceId]/cards/[cardTemplateId]/perspectives",
    "/[experienceId]/cards/[cardTemplateId]/personal-learning", "/[experienceId]/cards/[cardTemplateId]/group-learning",
    "/[experienceId]/updates", "/[experienceId]/members/[userId]/snapshot", "/[experienceId]/settings", "/[experienceId]/navigation", "/[experienceId]/perspectives",
    "/[experienceId]/authority", "/[experienceId]/presentation", "/[experienceId]/aggregates", "/[experienceId]/management", "/tiles"]) {
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
after(async () => { delete global.__groupApi;
  await state.client?.close(); await mongo?.stop(); });
function req(path = "", method = "GET", body?: unknown, headers?: Record<string, string>) {
  return new Request(`http://local/api/group-experiences${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function context(cardTemplateId = fixture.ids[0]): Context { return { params: Promise.resolve({ experienceId: fixture.experienceId, cardTemplateId }) }; }
test("management route validates complete commands, binds actors and acknowledges only their committed self-removal", async t => {
  const original = fixture;
  t.after(() => { fixture = original; state.db = original.cards.db; });
  fixture = await groupFixture(state.client!); state.db = fixture.cards.db;
  const route = routes["/[experienceId]/management"];
  const body = { operationId: "form", expectedStructureRevision: 0, name: "Edited", adminIds: ["dave"], followerIds: [], allowFollowerInspection: true };
  state.actor = null; assert.equal((await route.PATCH(req("/x", "PATCH", body), context())).status, 401);
  state.actor = { id: "bob" }; assert.equal((await route.PATCH(req("/x", "PATCH", body), context())).status, 403);
  state.actor = { id: "alice" };
  assert.equal((await route.PATCH(req("/x", "PATCH", body, { "X-Group-Viewer": "bob" }), context())).status, 409);
  assert.equal((await route.PATCH(req("/x", "PATCH", { ...body, extra: true }), context())).status, 400);
  const saved = await route.PATCH(req("/x", "PATCH", body), context()); assert.equal(saved.status, 200); assert.equal((await saved.json()).hasAccess, false);
  const retry = await route.PATCH(req("/x", "PATCH", body), context()); assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { viewerUserId: "alice", experienceId: fixture.experienceId, structureRevision: 1, outcome: "already-applied", hasAccess: false });
  assert.equal(retry.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await routes["/[experienceId]"].GET(req("/x"), context())).status, 403);
});
test("Group APIs are available by default and all responses remain authenticated, private and uncached", async () => {
  state.actor = { id: "alice" };
  const available = await routes[""].GET(req()); assert.equal(available.status, 200);
  state.actor = null;
  const unauth = await routes[""].POST(req("", "POST", fixture.command)); assert.equal(unauth.status, 401);
  for (const response of [available, unauth]) { assert.equal(response.headers.get("Cache-Control"), "private, no-store"); assert.equal(response.headers.get("Vary"), "Cookie"); }
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
test("Update APIs require the actual admin/group perspective and return an actionable exact-review conflict", async () => {
  fixture = await groupFixture(state.client!); state.db = fixture.cards.db;
  await publishGroupCard(fixture, 0, ["b0", "a0", "c0"]);
  const path = `/x?kind=card&entityId=${fixture.ids[0]}&perspective=group`, updates = routes["/[experienceId]/updates"];
  state.actor = { id: "bob" }; assert.equal((await updates.GET(req(path), context())).status, 403);
  state.actor = { id: "creator" }; assert.equal((await updates.GET(req(path), context())).status, 403);
  state.actor = { id: "alice" }; assert.equal((await updates.GET(req(path.replace("perspective=group", "perspective=self")), context())).status, 403);
  const review = await (await updates.GET(req(path), context())).json(); assert.equal(review.review.command.targetVersion, 2);
  const command = { operationId: "api-update", review: review.review.command };
  state.actor = { id: "bob" };
  assert.equal((await updates.POST(req("/x", "POST", { ...command, review: { ...command.review, viewerUserId: "bob" } }), context())).status, 403);
  state.actor = { id: "alice" }; await publishGroupCard(fixture, 0, ["a0", "b0", "d0"]);
  const conflict = await updates.POST(req("/x", "POST", command), context()); assert.equal(conflict.status, 409);
  const refreshed = await conflict.json(); assert.equal(refreshed.refreshRequired, true); assert.equal(refreshed.latestReview.review.command.targetVersion, 3);
  assert.equal(conflict.headers.get("Cache-Control"), "private, no-store");
  const exact = { operationId: "api-latest", review: refreshed.latestReview.review.command };
  assert.equal((await updates.POST(req("/x", "POST", exact), context())).status, 200);
  assert.equal((await (await updates.POST(req("/x", "POST", exact), context())).json()).outcome, "already-adopted");
});
test("policy and navigation APIs bind actual actors and permit only the selected active peer scope", async () => {
  fixture = await groupFixture(state.client!); state.db = fixture.cards.db;
  const settings = routes["/[experienceId]/settings"], navigation = routes["/[experienceId]/navigation"];
  const policy = { operationId: "allow-peers", expectedStructureRevision: 0, allowFollowerInspection: true };
  state.actor = { id: "bob" }; assert.equal((await settings.PATCH(req("/x", "PATCH", policy), context())).status, 403);
  state.actor = { id: "alice" }; assert.equal((await settings.PATCH(req("/x", "PATCH", { ...policy, actor: "alice" }), context())).status, 400);
  assert.equal((await settings.PATCH(req("/x", "PATCH", policy), context())).status, 200);
  state.actor = { id: "bob" };
  const selected = { accessEpoch: 0, expectedStructureRevision: 1, selection: { perspective: "follower", subjectUserId: "carol" } };
  const saved = await navigation.PATCH(req("/x", "PATCH", selected), context()); assert.equal(saved.status, 200);
  assert.equal(saved.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await routes["/[experienceId]/cards/[cardTemplateId]"].GET(req("/x?perspective=follower&subjectUserId=carol"), context())).status, 200);
  assert.equal((await routes["/[experienceId]/members/[userId]/snapshot"].GET(req("/x"), { params: Promise.resolve({ experienceId: fixture.experienceId, userId: "carol" }) })).status, 403);
  state.actor = { id: "alice" }; await settings.PATCH(req("/x", "PATCH", { ...policy, operationId: "deny-peers", expectedStructureRevision: 1, allowFollowerInspection: false }), context());
  state.actor = { id: "bob" };
  assert.equal((await routes["/[experienceId]/cards/[cardTemplateId]"].GET(req("/x?perspective=follower&subjectUserId=carol"), context())).status, 403);
  assert.deepEqual((await (await routes["/[experienceId]/perspectives"].GET(req("/x"), context())).json()).followers.map((row: { userId: string }) => row.userId), ["bob"]);
});
test("removal and rejoin APIs revoke every fresh group grant, expose frozen snapshots only to admins and reject old epochs", async () => {
  fixture = await groupFixture(state.client!); state.db = fixture.cards.db;
  await fixture.repo.writeLearning("bob", fixture.experienceId, fixture.ids[0], "personal", completion("a0"));
  const members = routes["/[experienceId]/members"], snapshot = routes["/[experienceId]/members/[userId]/snapshot"];
  const snapshotContext = { params: Promise.resolve({ experienceId: fixture.experienceId, userId: "bob" }) };
  const removal = { kind: "remove-follower", targetUserId: "bob", expectedStructureRevision: 0, operationId: "api-remove" };
  state.actor = { id: "alice" }; assert.equal((await members.POST(req("/x", "POST", removal), context())).status, 200);
  const historical = await snapshot.GET(req("/x"), snapshotContext); assert.equal(historical.status, 200);
  assert.equal((await historical.json()).learning[0].items[0].completionStatus, "done");
  state.actor = { id: "bob" };
  assert.equal((await snapshot.GET(req("/x"), snapshotContext)).status, 403);
  assert.equal((await routes["/[experienceId]/cards/[cardTemplateId]"].GET(req("/x?perspective=self"), context())).status, 403);
  assert.equal((await routes["/[experienceId]/cards/[cardTemplateId]/personal-learning"].PATCH(req("/x", "PATCH", completion("a0")), context())).status, 403);
  assert.equal((await routes["/[experienceId]/summary"].GET(req("/x"), context())).status, 403);
  state.actor = { id: "alice" }; assert.equal((await members.POST(req("/x", "POST", { kind: "add-follower", targetUserId: "bob", expectedStructureRevision: 1, operationId: "api-rejoin" }), context())).status, 200);
  assert.equal((await (await members.POST(req("/x", "POST", removal), context())).json()).outcome, "superseded");
  state.actor = { id: "bob" };
  const personal = routes["/[experienceId]/cards/[cardTemplateId]/personal-learning"];
  assert.equal((await personal.PATCH(req("/x", "PATCH", completion("a0")), context())).status, 409);
  assert.equal((await personal.PATCH(req("/x", "PATCH", completion("a0", "todo", 2)), context())).status, 200);
});


test("narrow authority endpoint is private, actor-bound and denies revoked/nonmember access", async () => {
  const route = routes["/[experienceId]/authority"];
  state.actor = null; assert.equal((await route.GET(req("/x/authority"), context())).status, 401);
  state.actor = { id: "outsider" }; assert.equal((await route.GET(req("/x/authority"), context())).status, 403);
  state.actor = { id: "alice" };
  assert.equal((await route.GET(req("/x/authority?actor=bob"), context())).status, 400);
  assert.equal((await route.GET(req("/x/authority", "GET", undefined, { "X-Group-Viewer": "bob" }), context())).status, 409);
  const response = await route.GET(req("/x/authority"), context()); assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const value = await response.json(); assert.equal(value.viewerUserId, "alice");
  assert.deepEqual(Object.keys(value).sort(), ["accessEpoch", "adoptionRevision", "experienceId", "structureRevision", "viewerUserId"]);
});
