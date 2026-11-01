import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { groupFixture, publishGroupDeck, reviewedUpdate } from "./helpers/groupExperiences";
import { personalGroupAssessments } from "../src/lib/groupExperiences/personalAssessments";
import { AssessmentConflict, type AssessmentCommand, type AssessmentSource } from "../src/lib/assessments/contracts";
import { readAssessmentList } from "../src/lib/assessments/repository";
import { frameworkCataloguePlugin } from "./helpers/frameworkCataloguePlugin";

let mongo: MongoMemoryReplSet, client: MongoClient;
const originalFlag = process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = "1"; });
after(async () => { if (originalFlag === undefined) delete process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED; else process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = originalFlag; await client?.close(); await mongo?.stop(); });
const catalogue = (id: string) => [{ id: "skills", title: "Skills", areas: [{ id: "area", title: "Area", items: [{ id: "goal", title: "Goal", cardTemplateIds: [id] }, { id: "outside", title: "Outside", cardTemplateIds: [] }] }] }];
const add = (source: AssessmentSource, deckTemplateId?: string): AssessmentCommand => ({ action: "add", viewerUserId: "bob", source, expectedRevision: 0, id: "test", date: "2026-11-01", result: true, ...(source.kind === "card" ? { deckTemplateId } : {}) });
type Route = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
async function routes(f: Awaited<ReturnType<typeof groupFixture>>) {
  const bundle = await build({ stdin: { contents: `
    export { GET as read, POST as add } from "@/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/personal-tests/route";
    export { PATCH as edit, DELETE as remove } from "@/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/personal-tests/[testId]/route";
    export { POST as addItem } from "@/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/items/[frameworkItemId]/personal-tests/route";
    export { CardRepository } from "@/lib/cards/repository";
    export { setActor } from "@/lib/auth";
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{ name: "fixture-auth", setup(builder) { builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: 'let actor = "bob"; export function setActor(value) { actor=value; } export async function getCurrentUser() { return actor ? { id:actor } : null; }', loader: "ts" })); } }, frameworkCataloguePlugin(catalogue(f.ids[0]))] });
  const fixtureModule = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve("package.json")), fixtureModule, fixtureModule.exports);
  const api = fixtureModule.exports as { read: Route; add: Route; edit: Route; remove: Route; addItem: Route; setActor: (actor: string | null) => void; CardRepository: { application: () => unknown } };
  api.CardRepository.application = async () => f.cards;
  return api;
}
const context = (f: Awaited<ReturnType<typeof groupFixture>>, extra: Record<string, string> = {}) => ({ params: Promise.resolve({ experienceId: f.experienceId, cardTemplateId: f.ids[0], testId: "test", frameworkId: "skills", frameworkItemId: "goal", ...extra }) });
const request = (method = "GET", body?: unknown, actor = "bob") => new Request("http://192.168.1.10/api/fixture", { method, headers: { "Content-Type": "application/json", "X-Group-Viewer": actor }, ...(body ? { body: JSON.stringify(body) } : {}) });

test("real HTTP routes initialise only the actual owner, preserve no-date scheduling and enforce direct API permissions", async () => {
  const f = await groupFixture(client), api = await routes(f), source = { kind: "card", cardTemplateId: f.ids[0] } as const;
  const first = await api.read(request(), context(f)); assert.equal(first.status, 200); assert.deepEqual((await first.json()).tests, []);
  assert.equal((await f.cards.getPersonalUser("bob"))!.cardsData.length, 0);
  const saved = await api.add(request("POST", add(source, f.deckId)), context(f)); assert.equal(saved.status, 200);
  assert.equal(saved.headers.get("X-Personal-Viewer"), "bob"); assert.equal(saved.headers.get("Cache-Control"), "private, no-store");
  const body = await saved.json(); assert.equal(body.target.cardTemplateId, f.ids[0]); assert.equal(body.owner.userId, "bob");
  assert.equal(body.tests[0].provenance.groupExperienceId, f.experienceId);
  const user = (await f.cards.getPersonalUser("bob"))!;
  assert.equal(user.cardsData.length, 1); assert.equal(user.cardsData[0].targetDate, null); assert.equal(user.decksData.length, 0);
  assert.equal((await api.add(request("POST", add(source, f.deckId)), context(f))).status, 200);
  assert.equal((await api.add(request("POST", { ...add(source, f.deckId), viewerUserId: "carol" }), context(f))).status, 409);
  assert.equal((await api.add(request("POST", { ...add(source, f.deckId), provenance: { enteredByUserId: "carol" } }), context(f))).status, 400);
  api.setActor("alice"); assert.equal((await api.read(request("GET", undefined, "alice"), context(f))).status, 403);
  api.setActor("outsider"); assert.equal((await api.read(request("GET", undefined, "outsider"), context(f))).status, 403);
  api.setActor(null); assert.equal((await api.read(request(), context(f))).status, 401);
});

test("direct Item API uses current mapped scope, no Card materialisation, and the existing personal list", async () => {
  const f = await groupFixture(client), api = await routes(f), source = { kind: "item", itemId: "goal" } as const;
  const saved = await api.addItem(request("POST", add(source)), context(f)); assert.equal(saved.status, 200);
  const body = await saved.json(); assert.deepEqual(body.target, { frameworkItemId: "goal" });
  assert.equal(body.tests[0].provenance.deckTemplateId, null);
  assert.equal((await f.cards.getPersonalUser("bob"))!.cardsData.length, 0);
  assert.equal((await readAssessmentList(f.cards, "bob", source)).tests.length, 1);
  assert.equal((await api.addItem(request("POST", add({ kind: "item", itemId: "outside" })), context(f, { frameworkItemId: "outside" }))).status, 403);
  assert.equal((await api.addItem(request("POST", add(source)), context(f, { frameworkId: "forged" }))).status, 403);
});

test("personal results share A/B storage and preserve original entry origin through later Group edits", async () => {
  const f = await groupFixture(client), source = { kind: "card", cardTemplateId: f.ids[0] } as const;
  const other = await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "B" });
  const saved = await personalGroupAssessments(f.repo, "bob", f.experienceId, source, add(source, f.deckId));
  const edit: AssessmentCommand = { action: "update", viewerUserId: "bob", source, expectedRevision: 1, id: "test", date: "2026-11-02", result: false };
  const updated = await personalGroupAssessments(f.repo, "bob", other.experienceId, source, edit);
  assert.deepEqual(updated.tests[0].provenance, saved.tests[0].provenance); assert.equal(updated.tests[0].createdAt, saved.tests[0].createdAt);
  assert.equal((await f.cards.getPersonalUser("bob"))!.cardsData[0].tests.length, 1);
  await assert.rejects(personalGroupAssessments(f.repo, "bob", other.experienceId, source, add(source, f.deckId)), AssessmentConflict);
  await personalGroupAssessments(f.repo, "bob", other.experienceId, source, { action: "delete", viewerUserId: "bob", source, expectedRevision: 2, id: "test" });
  await assert.rejects(personalGroupAssessments(f.repo, "bob", f.experienceId, source, add(source, f.deckId)), AssessmentConflict);
});

test("first personal insertion rolls back with a failed assessment write and required ordinary rows are never repaired silently", async () => {
  const f = await groupFixture(client), source = { kind: "card", cardTemplateId: f.ids[0] } as const, before = await f.cards.getPersonalUser("bob");
  await f.cards.db.command({ collMod: "users", validator: { "cardsData.testsRevision": { $exists: false } }, validationLevel: "strict" });
  await assert.rejects(personalGroupAssessments(f.repo, "bob", f.experienceId, source, add(source, f.deckId)));
  assert.deepEqual(await f.cards.getPersonalUser("bob"), before);
  await f.cards.db.command({ collMod: "users", validator: {} });
  await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.cards.users().updateOne({ _id: "bob" }, { $pull: { cardsData: { cardTemplateId: f.ids[0] } } });
  const broken = await f.cards.getPersonalUser("bob");
  await assert.rejects(personalGroupAssessments(f.repo, "bob", f.experienceId, source, add(source, f.deckId)), { code: "MISSING_CARD_DATA" });
  assert.deepEqual(await f.cards.getPersonalUser("bob"), broken);
});

test("adopted removal denies Group personal commands while retaining owner assessments", async () => {
  const f = await groupFixture(client), source = { kind: "card", cardTemplateId: f.ids[0] } as const;
  await personalGroupAssessments(f.repo, "bob", f.experienceId, source, add(source, f.deckId));
  await publishGroupDeck(f, [f.ids[1]]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  await assert.rejects(personalGroupAssessments(f.repo, "bob", f.experienceId, source), { code: "GROUP_ASSESSMENT_SOURCE_FORBIDDEN" });
  assert.equal((await readAssessmentList(f.cards, "bob", source)).tests.length, 1);
});

for (const change of ["membership", "adoption"] as const) test(`${change} revocation racing an assessment Add cannot commit stale personal data`, async t => {
  const f = await groupFixture(client), source = { kind: "card", cardTemplateId: f.ids[0] } as const;
  let observed!: () => void, resume!: () => void, pause = true;
  const read = new Promise<void>(resolve => { observed = resolve; }), gate = new Promise<void>(resolve => { resume = resolve; });
  const fence = f.repo.fence.bind(f.repo);
  t.mock.method(f.repo, "fence", async (...args: Parameters<typeof fence>) => {
    if (pause) { pause = false; observed(); await gate; }
    return fence(...args);
  });
  const writing = personalGroupAssessments(f.repo, "bob", f.experienceId, source, add(source, f.deckId));
  const rejected = assert.rejects(writing, { code: change === "membership" ? "GROUP_FORBIDDEN" : "GROUP_ASSESSMENT_SOURCE_FORBIDDEN" });
  await read;
  try {
    if (change === "membership") await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "remove-follower", targetUserId: "bob" });
    else { await publishGroupDeck(f, [f.ids[1]]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId)); }
  } finally { resume(); }
  await rejected;
  assert.equal((await f.cards.getPersonalUser("bob"))!.cardsData.length, 0);
});

test("concurrent first scalar learning and assessment writes preserve one personal row and both values", async () => {
  const f = await groupFixture(client), source = { kind: "card", cardTemplateId: f.ids[0] } as const;
  await Promise.all([
    personalGroupAssessments(f.repo, "bob", f.experienceId, source, add(source, f.deckId)),
    f.repo.writeLearning("bob", f.experienceId, f.ids[0], "personal", { accessEpoch: 0, version: 1, change: { kind: "completion", stepId: "a0", completionStatus: "done" } }),
  ]);
  const user = (await f.cards.getPersonalUser("bob"))!;
  assert.equal(user.cardsData.length, 1); assert.equal(user.cardsData[0].tests.length, 1);
  assert.equal(user.cardsData[0].items[0].completionStatus, "done"); assert.equal(user.cardsData[0].targetDate, null);
});
