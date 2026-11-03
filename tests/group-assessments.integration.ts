import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { groupFixture, publishGroupDeck, reviewedUpdate } from "./helpers/groupExperiences";
import { mutateGroupAssessment, readGroupAssessments, readGroupAssessmentHistory } from "../src/lib/groupExperiences/assessments";
import { assertGroupAssessmentCommand, type GroupAssessmentCommand } from "../src/lib/groupExperiences/assessmentContracts";
import { AssessmentConflict, assessmentTarget, type AssessmentSource } from "../src/lib/assessments/contracts";
import { frameworkCataloguePlugin } from "./helpers/frameworkCataloguePlugin";
import { personalGroupAssessments } from "../src/lib/groupExperiences/personalAssessments";

let mongo: MongoMemoryReplSet, client: MongoClient;
const originalFlag = process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = "1"; });
after(async () => { if (originalFlag === undefined) delete process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED; else process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = originalFlag; await client?.close(); await mongo?.stop(); });
const catalogue = (ids: string[]) => [{ id: "skills", title: "Skills", areas: [{ id: "area", title: "Area", items: [{ id: "goal", title: "Goal", cardTemplateIds: [ids[0]] }, { id: "other", title: "Other", cardTemplateIds: [ids[1]] }, { id: "outside", title: "Outside", cardTemplateIds: [] }] }] }];
const cardSource = (id: string): AssessmentSource => ({ kind: "card", cardTemplateId: id });
const itemSource: AssessmentSource = { kind: "item", itemId: "goal" };
const add = (source: AssessmentSource, id = "test", actor = "alice", expectedRevision = 0): GroupAssessmentCommand & { action: "add" } => ({ viewerUserId: actor, target: assessmentTarget(source), action: "add", expectedRevision, id, date: "2026-11-01", result: true });
const edit = (source: AssessmentSource, expectedRevision: number, actor = "alice"): GroupAssessmentCommand & { action: "update" } => ({ viewerUserId: actor, target: assessmentTarget(source), action: "update", expectedRevision, id: "test", date: "2026-11-02", result: false });
const remove = (source: AssessmentSource, expectedRevision: number, actor = "alice"): GroupAssessmentCommand => ({ viewerUserId: actor, target: assessmentTarget(source), action: "delete", expectedRevision, id: "test" });

test("Group Card and direct Item storage is independent, server-stamped and preserves learning fields", async () => {
  const f = await groupFixture(client), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  await f.repo.writeLearning("alice", f.experienceId, f.ids[0], "group", { accessEpoch: 0, version: 1, change: { kind: "completion", stepId: "a0", completionStatus: "done" } });
  const before = await f.repo.cardData().findOne({ experienceId: f.experienceId, cardTemplateId: f.ids[0] });
  const people = await f.cards.users().find({}).toArray();
  const saved = await mutateGroupAssessment(f.repo, "alice", f.experienceId, source, add(source), frameworks);
  assert.equal(saved.owner.kind, "group"); assert.equal(saved.tests[0].origin?.label, f.command.name); assert.equal(saved.tests[0].provenance, undefined);
  const raw = (await f.repo.cardData().findOne({ experienceId: f.experienceId, cardTemplateId: f.ids[0] }))!;
  assert.equal(raw.tests![0].provenance!.enteredByUserId, "alice"); assert.equal(raw.tests![0].provenance!.deckTemplateId, f.deckId);
  assert.deepEqual(raw.items, before!.items); assert.equal(raw.revision, before!.revision);
  const updated = await mutateGroupAssessment(f.repo, "alice", f.experienceId, source, edit(source, 1), frameworks);
  assert.equal(updated.tests[0].createdAt, saved.tests[0].createdAt);
  const direct = await mutateGroupAssessment(f.repo, "alice", f.experienceId, itemSource, add(itemSource), frameworks);
  assert.deepEqual(direct.target, { frameworkItemId: "goal" });
  const experience = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  assert.equal(experience.itemTests![0].frameworkItemId, "goal"); assert.equal(experience.itemTests![0].provenance!.deckTemplateId, null);
  assert.equal(experience.structureRevision, 0); assert.deepEqual(experience.itemAssessmentSourceIds, ["goal"]);
  assert.deepEqual(await f.cards.users().find({}).toArray(), people);
});

test("member reads follow current scope; peer On never grants Group test writes or extrema capability", async () => {
  const f = await groupFixture(client), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, source, add(source), frameworks);
  for (const policy of [false, true]) {
    await f.repo.experiences().updateOne({ experienceId: f.experienceId }, { $set: { allowFollowerInspection: policy } });
    const read = await readGroupAssessments(f.repo, "bob", f.experienceId, source, frameworks);
    assert.equal(read.groupCapabilities.canInspectFollowers, policy); assert.equal(read.groupCapabilities.canViewConfidenceExtrema, false);
    assert.equal(read.groupCapabilities.canManageGroupAssessments, false); assert.equal(read.tests[0].provenance, undefined);
    await assert.rejects(mutateGroupAssessment(f.repo, "bob", f.experienceId, source, add(source, "forged", "bob", 1), frameworks), { code: "GROUP_FORBIDDEN" });
  }
  await assert.rejects(readGroupAssessments(f.repo, "outsider", f.experienceId, source, frameworks), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(mutateGroupAssessment(f.repo, "alice", f.experienceId, source, add(source, "foreign", "bob", 1), frameworks), { code: "ASSESSMENT_SESSION_CONFLICT" });
  await assert.rejects(mutateGroupAssessment(f.repo, "alice", f.experienceId, { kind: "item", itemId: "outside" }, add({ kind: "item", itemId: "outside" }), frameworks), { code: "GROUP_ASSESSMENT_SOURCE_FORBIDDEN" });
});

test("current Item history combines only mapped Group Card and direct Item events, never personal history", async t => {
  const f = await groupFixture(client), frameworks = catalogue(f.ids);
  await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.tests": [{ id: "PRIVATE-personal-test", date: "2026-11-01", result: true, createdAt: new Date() }], "cardsData.0.reflection": "PRIVATE-reflection" } });
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, cardSource(f.ids[0]), add(cardSource(f.ids[0]), "card"), frameworks);
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, cardSource(f.ids[1]), add(cardSource(f.ids[1]), "unrelated-card"), frameworks);
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, itemSource, add(itemSource, "direct"), frameworks);
  t.mock.method(f.cards, "getPersonalUser", () => { throw Error("Must never retrieve personal assessment storage"); });
  const result = await readGroupAssessmentHistory(f.repo, "bob", f.experienceId, itemSource, frameworks);
  assert.deepEqual(result.history.results.map(row => row.id).sort(), ["card", "direct"]);
  assert.ok(result.history.results.every(row => !row.canMutate && row.provenance === undefined));
  assert.equal(result.history.sources.length, 2);
  assert.ok(result.history.results.every(row => row.origin?.label === f.command.name));
});

test("removed Card and Item sources retain exact Admin management, reject new entry and remain outside current histories", async () => {
  const f = await groupFixture(client), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  const cardCommand = add(source), itemCommand = add(itemSource);
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, source, cardCommand, frameworks);
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, itemSource, itemCommand, frameworks);
  await publishGroupDeck(f, [f.ids[1]]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  for (const target of [source, itemSource]) {
    assert.equal((await readGroupAssessments(f.repo, "alice", f.experienceId, target, [])).tests.length, 1);
    await assert.rejects(readGroupAssessments(f.repo, "bob", f.experienceId, target, frameworks), { code: "GROUP_ASSESSMENT_SOURCE_FORBIDDEN" });
    await assert.rejects(readGroupAssessmentHistory(f.repo, "alice", f.experienceId, target, frameworks), { code: "GROUP_ASSESSMENT_SOURCE_FORBIDDEN" });
    await assert.rejects(mutateGroupAssessment(f.repo, "alice", f.experienceId, target, add(target, "new", "alice", 1), frameworks), { code: "GROUP_ASSESSMENT_SOURCE_FORBIDDEN" });
    assert.equal((await mutateGroupAssessment(f.repo, "alice", f.experienceId, target, edit(target, 1), [])).revision, 2);
    const deleting = remove(target, 2);
    await mutateGroupAssessment(f.repo, "alice", f.experienceId, target, deleting, []);
    assert.equal((await mutateGroupAssessment(f.repo, "alice", f.experienceId, target, deleting, [])).outcome, "already-absent");
    assert.equal((await readGroupAssessments(f.repo, "alice", f.experienceId, target, [])).tests.length, 0);
  }
  const other = await readGroupAssessmentHistory(f.repo, "alice", f.experienceId, { kind: "item", itemId: "other" }, frameworks);
  assert.equal(other.history.count, 0);
  assert.deepEqual((await f.repo.get("alice", f.experienceId)).cards.map(card => card.cardTemplateId), [f.ids[1]]);
});

test("competing Admin edits conflict while independent lists, retries and source identities remain correct", async () => {
  const f = await groupFixture(client, { admins: ["dave"] }), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, source, add(source), frameworks);
  const results = await Promise.allSettled([
    mutateGroupAssessment(f.repo, "alice", f.experienceId, source, edit(source, 1), frameworks),
    mutateGroupAssessment(f.repo, "dave", f.experienceId, source, { ...edit(source, 1, "dave"), date: "2026-11-03" }, frameworks),
  ]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.ok(results.some(row => row.status === "rejected" && row.reason instanceof AssessmentConflict));
  const distinct = cardSource(f.ids[1]);
  await mutateGroupAssessment(f.repo, "dave", f.experienceId, distinct, add(distinct, "test", "dave"), frameworks);
  assert.equal((await readGroupAssessments(f.repo, "alice", f.experienceId, distinct, frameworks)).revision, 1);
  const direct = add(itemSource);
  assert.equal((await mutateGroupAssessment(f.repo, "alice", f.experienceId, itemSource, direct, frameworks)).outcome, "changed");
  assert.equal((await mutateGroupAssessment(f.repo, "alice", f.experienceId, itemSource, direct, frameworks)).outcome, "already-present");
  const differentItem: AssessmentSource = { kind: "item", itemId: "other" };
  await assert.rejects(mutateGroupAssessment(f.repo, "alice", f.experienceId, differentItem, add(differentItem, "test", "alice", 1), frameworks), { code: "ASSESSMENT_SOURCE_CONFLICT" });
});

test("different Admin scalar and first-assessment writes preserve one Group row and both fields", async () => {
  const f = await groupFixture(client, { admins: ["dave"] }), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  await Promise.all([
    mutateGroupAssessment(f.repo, "alice", f.experienceId, source, add(source), frameworks),
    f.repo.writeLearning("dave", f.experienceId, f.ids[0], "group", { accessEpoch: 0, version: 1, change: { kind: "completion", stepId: "a0", completionStatus: "done" } }),
  ]);
  const rows = await f.repo.cardData().find({ experienceId: f.experienceId, cardTemplateId: f.ids[0] }).toArray();
  assert.equal(rows.length, 1); assert.equal(rows[0].items[0].completionStatus, "done"); assert.equal(rows[0].tests!.length, 1);
});

test("same Card and result ID in two Groups remains two independent Group-owned sources", async () => {
  const f = await groupFixture(client), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  const other = await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "Other Group" });
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, source, add(source), frameworks);
  assert.equal((await readGroupAssessments(f.repo, "bob", other.experienceId, source, frameworks)).tests.length, 0);
  await mutateGroupAssessment(f.repo, "alice", other.experienceId, source, { ...add(source), result: false }, frameworks);
  assert.equal((await readGroupAssessments(f.repo, "bob", f.experienceId, source, frameworks)).tests[0].result, true);
  assert.equal((await readGroupAssessments(f.repo, "bob", other.experienceId, source, frameworks)).tests[0].result, false);
});

test("a dual-role Admin writes Group tests without modifying their own personal test list", async () => {
  const f = await groupFixture(client), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "set-admin", targetUserId: "bob", isAdmin: true });
  const before = await f.cards.getPersonalUser("bob");
  const saved = await mutateGroupAssessment(f.repo, "bob", f.experienceId, source, add(source, "group-result", "bob"), frameworks);
  assert.equal(saved.owner.kind, "group"); assert.equal(saved.groupCapabilities.canManageGroupAssessments, true);
  assert.deepEqual(await f.cards.getPersonalUser("bob"), before);
  assert.equal((await personalGroupAssessments(f.repo, "bob", f.experienceId, source)).tests.length, 0);
});

test("legacy counters default safely and malformed Group source data is unavailable rather than empty", async () => {
  const f = await groupFixture(client), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  await f.repo.writeLearning("alice", f.experienceId, f.ids[0], "group", { accessEpoch: 0, version: 1, change: { kind: "completion", stepId: "a0", completionStatus: "done" } });
  assert.equal((await readGroupAssessments(f.repo, "bob", f.experienceId, source, frameworks)).revision, 0);
  await f.repo.cardData().updateOne({ experienceId: f.experienceId, cardTemplateId: f.ids[0] }, { $set: { tests: [{ id: "legacy", date: "2026-01-01", result: true, createdAt: new Date("2026-01-01T12:00:00Z") }] } });
  assert.equal((await readGroupAssessments(f.repo, "bob", f.experienceId, source, frameworks)).tests[0].origin?.label, "Unknown");
  await f.repo.cardData().updateOne({ experienceId: f.experienceId, cardTemplateId: f.ids[0] }, { $set: { testsRevision: -1 } });
  const history = await readGroupAssessmentHistory(f.repo, "alice", f.experienceId, itemSource, frameworks);
  assert.equal(history.history.state, "incomplete"); assert.equal(history.history.count, null); assert.ok(history.history.issues.length);
});

test("scalar Group learning queries exclude the new assessment lists and provenance", async t => {
  const f = await groupFixture(client), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, source, add(source, "assessment-only-secret"), frameworks);
  const collection = f.repo.cardData(), find = collection.find.bind(collection);
  t.mock.method(f.repo, "cardData", () => collection);
  t.mock.method(collection, "find", (...args: Parameters<typeof find>) => {
    assert.deepEqual(args[1]?.projection, { _id: 0, cardTemplateId: 1, items: 1, signalReadings: 1 });
    return find(...args);
  });
  const cards = await f.cards.cardVersions().find({ cardTemplateId: { $in: f.ids }, version: 1 }).toArray();
  const learning = await f.repo.transaction(session => f.repo.groupLearning(f.experienceId, cards, session));
  assert.equal(JSON.stringify(learning).includes("assessment-only-secret"), false);
});

test("failed Group test writes roll back fences, fields and revisions", async () => {
  const f = await groupFixture(client), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  const members = await f.repo.members().find({ experienceId: f.experienceId }).toArray();
  await f.cards.db.command({ collMod: "groupCardData", validator: { testsRevision: { $exists: false } }, validationLevel: "strict" });
  await assert.rejects(mutateGroupAssessment(f.repo, "alice", f.experienceId, source, add(source), frameworks));
  assert.equal(await f.repo.cardData().countDocuments({ experienceId: f.experienceId }), 0);
  assert.deepEqual(await f.repo.members().find({ experienceId: f.experienceId }).toArray(), members);
  await f.cards.db.command({ collMod: "groupCardData", validator: {} });
  await f.cards.db.command({ collMod: "groupExperiences", validator: { itemTestsRevision: { $exists: false } }, validationLevel: "strict" });
  await assert.rejects(mutateGroupAssessment(f.repo, "alice", f.experienceId, itemSource, add(itemSource), frameworks));
  const experience = (await f.repo.experiences().findOne({ experienceId: f.experienceId }))!;
  assert.equal(experience.itemTests, undefined); assert.equal(experience.itemAssessmentSourceIds, undefined);
});

test("another Admin adoption racing a new test revalidates scope before commit", async t => {
  const f = await groupFixture(client, { admins: ["dave"] }), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids);
  let observed!: () => void, resume!: () => void, pause = true;
  const read = new Promise<void>(resolve => { observed = resolve; }), gate = new Promise<void>(resolve => { resume = resolve; }), fence = f.repo.fence.bind(f.repo);
  t.mock.method(f.repo, "fence", async (...args: Parameters<typeof fence>) => { if (pause) { pause = false; observed(); await gate; } return fence(...args); });
  const writing = mutateGroupAssessment(f.repo, "dave", f.experienceId, source, add(source, "test", "dave"), frameworks);
  const rejected = assert.rejects(writing, { code: "GROUP_ASSESSMENT_SOURCE_FORBIDDEN" });
  await read;
  try { await publishGroupDeck(f, [f.ids[1]]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId)); }
  finally { resume(); }
  await rejected; assert.equal(await f.repo.cardData().countDocuments({ experienceId: f.experienceId }), 0);
});

test("removal of Admin authority prevents mutations and lost-response acknowledgement", async () => {
  const f = await groupFixture(client, { admins: ["dave"] }), source = cardSource(f.ids[0]), frameworks = catalogue(f.ids), command = add(cardSource(f.ids[0]), "test", "dave");
  await mutateGroupAssessment(f.repo, "dave", f.experienceId, source, command, frameworks);
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "set-admin", targetUserId: "dave", isAdmin: false });
  await assert.rejects(mutateGroupAssessment(f.repo, "dave", f.experienceId, source, command, frameworks), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(readGroupAssessments(f.repo, "dave", f.experienceId, source, frameworks), { code: "GROUP_FORBIDDEN" });
});

type Route = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
test("actual Group assessment HTTP routes enforce target, actor, result ID and private response boundaries", async () => {
  const f = await groupFixture(client), frameworks = catalogue(f.ids);
  const bundle = await build({ stdin: { contents: `
    export { GET as read, POST as add } from "@/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/tests/route";
    export { PATCH as edit, DELETE as remove } from "@/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/tests/[testId]/route";
    export { GET as history } from "@/app/api/group-experiences/[experienceId]/cards/[cardTemplateId]/assessment-history/route";
    export { GET as itemRead, POST as itemAdd } from "@/app/api/group-experiences/[experienceId]/items/[frameworkItemId]/tests/route";
    export { PATCH as itemEdit, DELETE as itemRemove } from "@/app/api/group-experiences/[experienceId]/items/[frameworkItemId]/tests/[testId]/route";
    export { GET as itemHistory } from "@/app/api/group-experiences/[experienceId]/items/[frameworkItemId]/history/route";
    export { CardRepository } from "@/lib/cards/repository";
    export { setActor } from "@/lib/auth";
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{ name: "disposable-auth", setup(builder) { builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: 'let actor = "alice"; export function setActor(value) { actor = value; } export async function getCurrentUser() { return actor ? { id: actor } : null; }', loader: "ts" })); } }, frameworkCataloguePlugin(frameworks)] });
  const fixtureModule = { exports: {} }; new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve("package.json")), fixtureModule, fixtureModule.exports);
  const api = fixtureModule.exports as Record<string, Route> & { CardRepository: { application: () => unknown }; setActor: (actor: string | null) => void }; api.CardRepository.application = async () => f.cards;
  const params = { params: Promise.resolve({ experienceId: f.experienceId, cardTemplateId: f.ids[0], testId: "test", frameworkItemId: "goal" }) };
  const request = (method = "GET", body?: unknown, actor = "alice") => new Request("http://localhost/api/fixture", { method, headers: { "X-Group-Viewer": actor, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const saved = await api.add(request("POST", add(cardSource(f.ids[0]))), params); assert.equal(saved.status, 200);
  const body = await saved.json(); assert.equal(body.owner.kind, "group"); assert.equal(body.tests[0].origin.label, f.command.name);
  assert.equal(JSON.stringify(body).includes("enteredByUserId"), false); assert.equal(saved.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await api.add(request("POST", { ...add(cardSource(f.ids[0])), provenance: {} }), params)).status, 400);
  assert.equal((await api.read(request(), params)).status, 200);
  assert.equal((await api.add(request("POST", add(cardSource(f.ids[1]))), params)).status, 409);
  assert.equal((await api.add(request("POST", add(cardSource(f.ids[0]), "forged", "bob")), params)).status, 409);
  const conflict = await api.add(request("POST", { ...add(cardSource(f.ids[0])), date: "2026-11-02" }), params);
  assert.equal(conflict.status, 409); assert.equal(JSON.stringify(await conflict.json()).includes("enteredByUserId"), false);
  api.setActor("bob");
  assert.equal((await api.read(request("GET", undefined, "bob"), params)).status, 200);
  assert.equal((await api.add(request("POST", add(cardSource(f.ids[0]), "forbidden", "bob", 1), "bob"), params)).status, 403);
  api.setActor("outsider"); assert.equal((await api.read(request("GET", undefined, "outsider"), params)).status, 403);
  api.setActor("alice");
  assert.equal((await api.edit(request("PATCH", { ...edit(cardSource(f.ids[0]), 1), id: "wrong" }), params)).status, 409);
  assert.equal((await api.edit(request("PATCH", edit(cardSource(f.ids[0]), 1)), params)).status, 200);
  assert.equal((await api.itemAdd(request("POST", add(itemSource)), params)).status, 200);
  assert.equal((await api.itemRead(request(), params)).status, 200);
  assert.equal((await api.itemHistory(request(), params)).status, 200);
  assert.equal((await api.history(request(), params)).status, 200);
  assert.equal((await api.itemEdit(request("PATCH", edit(itemSource, 1)), params)).status, 200);
  assert.equal((await api.itemRemove(request("DELETE", remove(itemSource, 2)), params)).status, 200);
  assert.equal((await api.remove(request("DELETE", remove(cardSource(f.ids[0]), 2)), params)).status, 200);
  api.setActor(null); assert.equal((await api.read(request(), params)).status, 401);
  assert.throws(() => assertGroupAssessmentCommand({ ...add(itemSource), target: { frameworkItemId: "goal", cardTemplateId: f.ids[0] } }));
});
