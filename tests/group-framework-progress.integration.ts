import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, publishGroupDeck, publishGroupCard, reviewedUpdate } from "./helpers/groupExperiences";
import { frameworkCataloguePlugin } from "./helpers/frameworkCataloguePlugin";
import { readGroupProgressSummary, readScopedAssessmentHistory } from "../src/lib/groupExperiences/progressReads";
import { readCardAssessmentHistory } from "../src/lib/frameworks/readModels";
import { mutateGroupAssessment } from "../src/lib/groupExperiences/assessments";
import { manualAssessmentProvenance } from "../src/lib/assessments/provenance";
import type { Framework } from "../src/lib/frameworks/configuration";
import type { CardData } from "../src/lib/cards/model";

let mongo: MongoMemoryReplSet, client: MongoClient;
const flag = process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = "1"; });
after(async () => { if (flag === undefined) delete process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED; else process.env.SWITCHPLAY_GROUP_EXPERIENCES_ENABLED = flag; await client?.close(); await mongo?.stop(); });
type Fixture = Awaited<ReturnType<typeof groupFixture>>;
const catalogue = (ids: string[]): Framework[] => [{ id: "skills", title: "Skills", areas: [
  { id: "area", title: "Area", items: [{ id: "goal", title: "Goal", cardTemplateIds: ids.slice(0, 2) }, { id: "next", title: "Next", cardTemplateIds: ids.slice(2, 3) }] },
  { id: "outside-area", title: "Outside area", items: [{ id: "outside", title: "Outside", cardTemplateIds: [] }] },
] }];
const player = (userId = "bob") => ({ kind: "player" as const, userId });
const group = { kind: "group" as const };
const event = (id: string, origin?: string | null) => ({ id, date: "2026-11-01", result: true, createdAt: new Date("2026-11-01T12:00:00Z"),
  ...(origin !== undefined ? { provenance: manualAssessmentProvenance("bob", { groupExperienceId: origin, deckTemplateId: null }) } : {}) });
async function personal(f: Fixture, user = "bob") {
  await f.cards.ensureDeckData(user, f.deckId, 1);
  return (await f.cards.getPersonalUser(user))!;
}
async function seed(f: Fixture, user: string, records: CardData[], extra = {}) {
  await f.cards.users().updateOne({ _id: user }, { $set: { cardsData: records, ...extra } });
}
async function summary(f: Fixture, actor = "alice", perspective = group as typeof group | ReturnType<typeof player>, frameworks = catalogue(f.ids)) {
  return readGroupProgressSummary(f.repo, actor, f.experienceId, "skills", perspective, frameworks);
}
async function history(f: Fixture, actor = "alice", perspective = player() as typeof group | ReturnType<typeof player>, target = { frameworkItemId: "goal" } as { frameworkItemId: string } | { cardTemplateId: string }, frameworks = catalogue(f.ids)) {
  return readScopedAssessmentHistory(f.repo, actor, f.experienceId, "skills", perspective, target, frameworks);
}
function item(value: Awaited<ReturnType<typeof summary>>, id = "goal") { return value.framework.areas.flatMap(area => area.items).find(row => row.frameworkItemId === id)!; }
function groupRow(value: ReturnType<typeof item>) { assert.ok("groupScores" in value && value.groupScores); assert.ok("playerAverages" in value && value.playerAverages); return { scores: value.groupScores, averages: value.playerAverages }; }
function playerRow(value: ReturnType<typeof item>) { assert.ok("player" in value && value.player); return value.player; }

// All private sentinels are real stored fields, not fields removed by a response mock.
test("partial Items use current adopted Cards, raw cohort inputs and Area unions", async () => {
  const f = await groupFixture(client, { cardCount: 3 });
  for (const userId of ["bob", "carol"]) {
    const user = await personal(f, userId);
    user.cardsData[0].items.forEach((step, index) => { step.completionStatus = userId === "bob" ? "done" : index ? "skipped" : "todo"; });
    user.cardsData[0].signalReadings.forEach((signal, index) => { signal.reading = userId === "bob" ? [1, 1, 10][index] : index ? null : 10; });
    user.cardsData[1].items.forEach(step => { step.completionStatus = "done"; });
    await seed(f, userId, user.cardsData);
  }
  await publishGroupDeck(f, [f.ids[0], f.ids[2]]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  const result = await summary(f), row = groupRow(item(result));
  assert.deepEqual(item(result).cardTemplateIds, [f.ids[0]]);
  assert.equal(row.averages.completion, 75); assert.equal(row.averages.eligibleCount, 4); assert.equal(row.averages.confidence, 6);
  assert.equal(row.averages.confidenceMinimum, 4); assert.equal(row.averages.confidenceMaximum, 10);
  assert.equal(row.scores.completion, 0); assert.equal(result.group.activeFollowerCount, 2);
  const area = result.framework.areas[0]; assert.equal(area.playerAverages!.completion, 30);
  assert.equal(area.playerAverages!.eligibleCount, 10); assert.equal(area.playerAverages!.observationCount, 12);
  assert.equal(item(result, "outside").coverage, "outside"); assert.equal(item(result, "outside").assessments, null);
  assert.equal(result.framework.areas[1].coverage, "outside"); assert.equal(result.framework.playerAverages!.completion, 30);
});

test("self, Admin and authorised peer see identical scoped player values and no non-Admin extrema", async () => {
  const f = await groupFixture(client); await f.repo.saveSettings("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, allowFollowerInspection: true });
  const own = await summary(f, "bob", player()), admin = await summary(f, "alice", player()), peer = await summary(f, "carol", player());
  assert.deepEqual(playerRow(item(own)), playerRow(item(admin))); assert.deepEqual(playerRow(item(peer)), playerRow(item(admin)));
  assert.equal(own.canCreateAssessments, true); assert.equal(peer.canCreateAssessments, false);
  const followerGroup = await summary(f, "bob");
  assert.equal(followerGroup.capabilities.canInspectFollowers, true); assert.equal(followerGroup.capabilities.canViewConfidenceExtrema, false);
  assert.equal(JSON.stringify(followerGroup).includes("confidenceMinimum"), false); assert.equal(JSON.stringify(followerGroup).includes("confidenceMaximum"), false);
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 1, kind: "set-admin", targetUserId: "bob", isAdmin: true });
  assert.equal((await summary(f, "bob")).capabilities.canViewConfidenceExtrema, true);
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 2, kind: "set-admin", targetUserId: "bob", isAdmin: false });
  const demoted = await summary(f, "bob"); assert.equal(demoted.capabilities.canViewConfidenceExtrema, false);
  assert.equal(JSON.stringify(demoted).includes("confidenceMinimum"), false); assert.equal(JSON.stringify(demoted).includes("confidenceMaximum"), false);
});

test("peer Off, outsider, removed subject and revoked viewer are denied on fresh reads", async () => {
  const f = await groupFixture(client);
  await assert.rejects(summary(f, "carol", player()), { code: "GROUP_PERSPECTIVE_FORBIDDEN" });
  await assert.rejects(history(f, "carol"), { code: "GROUP_PERSPECTIVE_FORBIDDEN" });
  await assert.rejects(summary(f, "outsider"), { code: "GROUP_FORBIDDEN" });
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "remove-follower", targetUserId: "bob" });
  await assert.rejects(summary(f, "alice", player()), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(history(f), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(summary(f, "bob"), { code: "GROUP_FORBIDDEN" });
});

test("empty cohort, all skipped, confidence-only and malformed learning remain distinct", async () => {
  const empty = await groupFixture(client, { followers: [] });
  const values = groupRow(item(await summary(empty))); assert.equal(values.scores.state, "unstarted"); assert.equal(values.averages.state, "empty"); assert.equal(values.averages.completion, null);
  const f = await groupFixture(client);
  for (const userId of ["bob", "carol"]) {
    const user = await personal(f, userId); user.cardsData.forEach(card => { card.items.forEach(step => { step.completionStatus = "skipped"; }); card.signalReadings.forEach(signal => { signal.reading = 9; }); }); await seed(f, userId, user.cardsData);
  }
  const skipped = groupRow(item(await summary(f))).averages; assert.equal(skipped.state, "skipped"); assert.equal(skipped.confidence, 9); assert.equal(skipped.completion, null);
  await f.repo.states().insertOne({ experienceId: f.experienceId, cardTemplateId: f.ids[0], revision: 0, createdAt: new Date(), updatedAt: new Date(), items: [], signalReadings: [{ stepId: "a0", reading: 100 }] });
  assert.equal(groupRow(item(await summary(f))).scores.state, "incomplete");
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.items.0.completionStatus": "broken" } });
  assert.equal(groupRow(item(await summary(f))).averages.state, "incomplete"); assert.equal(playerRow(item(await summary(f, "bob", player()))).state, "incomplete");
});

test("personal Item evidence includes all origins and live shared lineage but no sibling/outside sources", async () => {
  const f = await groupFixture(client, { cardCount: 3 }), user = await personal(f);
  const sourceId = "PRIVATE-source-identity", siblingId = "PRIVATE-sibling-identity";
  const source = { ...user.cardsData[0], cardTemplateId: sourceId, tests: [event("inherited")], testsRevision: 1 };
  const sibling = { ...source, cardTemplateId: siblingId, tests: [event("PRIVATE-sibling-test")] };
  user.cardsData[0].historySourceCardTemplateId = sourceId; user.cardsData[1].historySourceCardTemplateId = sourceId;
  user.cardsData[0].tests = [event("own", null)]; user.cardsData[2].tests = [event("PRIVATE-outside-card-test")];
  await seed(f, "bob", [...user.cardsData, source, sibling], { itemTests: [{ ...event("direct-personal", null), itemId: "goal" }, { ...event("direct-other", "PRIVATE-other-group"), itemId: "goal" }, { ...event("PRIVATE-outside-item"), itemId: "outside" }], itemTestsRevision: 1 });
  const result = await history(f);
  assert.deepEqual(result.history.results.map(row => row.id).sort(), ["direct-other", "direct-personal", "inherited", "own"]);
  const inherited = result.history.results.find(row => row.id === "inherited")!;
  assert.equal(inherited.source, null); assert.equal(inherited.canMutate, false); assert.equal(inherited.sourceTitle, "Card title unavailable"); assert.equal(inherited.exposedThroughCardTemplateIds.length, 2);
  assert.equal(JSON.stringify(result).includes("PRIVATE-"), false);
  const owner = await readCardAssessmentHistory(f.cards, "bob", f.ids[0]);
  const selected = await history(f, "alice", player(), { cardTemplateId: f.ids[0] });
  assert.deepEqual(selected.history.results.map(row => row.id), owner.history.results.map(row => row.id));
  await f.cards.users().updateOne({ _id: "bob", "cardsData.cardTemplateId": sourceId }, { $push: { "cardsData.$.tests": event("later-live") } });
  assert.equal((await history(f)).history.count, 5);
  assert.equal(item(await summary(f, "alice", player())).assessments!.count, 5);
});

test("legacy origins stay Unknown and originating Group name requires independent current viewer access", async () => {
  const f = await groupFixture(client), other = await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "PRIVATE-other-name", adminIds: ["carol"], followerIds: ["bob"] });
  const user = await personal(f); user.cardsData[0].tests = [event("known", other.experienceId), event("legacy")]; await seed(f, "bob", user.cardsData);
  assert.equal((await history(f)).history.results.find(row => row.id === "known")!.origin!.label, "PRIVATE-other-name");
  await f.repo.changeMember("carol", other.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "set-admin", targetUserId: "alice", isAdmin: false });
  const hidden = await history(f); assert.equal(hidden.history.results.find(row => row.id === "known")!.origin!.label, "Other group");
  assert.equal(hidden.history.results.find(row => row.id === "legacy")!.origin!.label, "Unknown");
  assert.equal(JSON.stringify(hidden).includes(other.experienceId), false); assert.equal(JSON.stringify(hidden).includes("PRIVATE-other-name"), false);
});

test("Group scores and averages share only Group-owned Tests, retaining removed sources outside current Progress", async () => {
  const f = await groupFixture(client), frameworks = catalogue(f.ids), target = { cardTemplateId: f.ids[0] };
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, { kind: "card", ...target }, { action: "add", viewerUserId: "alice", target, id: "group-card", expectedRevision: 0, date: "2026-11-01", result: true }, frameworks);
  await mutateGroupAssessment(f.repo, "alice", f.experienceId, { kind: "item", itemId: "goal" }, { action: "add", viewerUserId: "alice", target: { frameworkItemId: "goal" }, id: "group-item", expectedRevision: 0, date: "2026-11-01", result: false }, frameworks);
  assert.equal(item(await summary(f)).assessments!.count, 2); assert.equal(item(await summary(f, "bob", player())).assessments!.count, 0);
  assert.equal((await history(f, "bob", group)).history.count, 2);
  await publishGroupDeck(f, []); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  assert.equal(item(await summary(f)).assessments, null); await assert.rejects(history(f, "alice", group), { code: "GROUP_PROGRESS_SOURCE_FORBIDDEN" });
  assert.equal((await f.repo.states().findOne({ experienceId: f.experienceId, cardTemplateId: f.ids[0] }))!.tests!.length, 1);
});

test("assessment database projections never retrieve private fields or unrelated source events", async t => {
  const f = await groupFixture(client), user = await personal(f), sourceId = "hidden-history-source";
  user.cardsData[0].tests = [event("visible")]; user.cardsData[0].historySourceCardTemplateId = sourceId;
  const inherited = { ...user.cardsData[1], cardTemplateId: sourceId, tests: [event("inherited")] };
  delete inherited.historySourceCardTemplateId;
  await seed(f, "bob", [...user.cardsData, inherited]);
  const sentinels = ["SECRET-media-url", "SECRET-reflection", "SECRET-chat", "SECRET-info", "SECRET-test-extra"];
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.mediaItems": [{ url: sentinels[0] }], "cardsData.0.reflection": sentinels[1],
    "cardsData.0.chats": [{ text: sentinels[2] }], "cardsData.0.personalInfoCardIds": [sentinels[3]], "cardsData.0.targetDate": "2030-12-30", "cardsData.0.tests.0.privatePayload": sentinels[4] } });
  t.mock.method(f.cards, "getPersonalUser", () => { throw Error("Full personal user reads are forbidden"); });
  const users = f.cards.users(), aggregate = users.aggregate.bind(users); let calls = 0, assessmentQueries = 0;
  t.mock.method(f.cards, "users", () => users);
  t.mock.method(users, "aggregate", (...args: Parameters<typeof aggregate>) => {
    calls++; if (JSON.stringify(args[0]).includes("$$card.tests")) assessmentQueries++;
    const cursor = aggregate(...args), read = cursor.toArray.bind(cursor);
    cursor.toArray = async () => { const rows = await read(); const raw = JSON.stringify(rows); for (const marker of sentinels) assert.equal(raw.includes(marker), false); assert.equal(raw.includes("2030-12-30"), false); return rows; };
    return cursor;
  });
  const result = await history(f); assert.equal(result.history.count, 2);
  assert.equal(JSON.stringify(result).includes(sourceId), false); assert.equal(JSON.stringify(result).includes("enteredByUserId"), false);
  const before = assessmentQueries;
  await summary(f); // Group mode fetches scalars, not player tests.
  assert.equal(assessmentQueries, before);
  assert.ok(calls > 1);
  const card = await f.repo.get("alice", f.experienceId), scalar = await f.repo.cardAggregates("alice", f.experienceId);
  assert.equal(JSON.stringify(card).includes('"visible"'), false); assert.equal(JSON.stringify(scalar).includes('"visible"'), false);
});

test("assessment evidence handles dangling, cyclic, ambiguous and malformed chains as incomplete without broadening", async () => {
  const f = await groupFixture(client), user = await personal(f), first = user.cardsData[0];
  first.tests = [event("readable")]; first.historySourceCardTemplateId = "missing-source";
  await seed(f, "bob", user.cardsData);
  const dangling = await history(f); assert.equal(dangling.history.state, "incomplete"); assert.equal(dangling.history.count, null); assert.equal(dangling.history.readableCount, 1);
  assert.equal(JSON.stringify(dangling).includes("missing-source"), false);
  first.historySourceCardTemplateId = first.cardTemplateId; await seed(f, "bob", user.cardsData);
  assert.ok((await history(f)).history.issues.some(issue => issue.code === "PERSONAL_HISTORY_CYCLE"));
  first.historySourceCardTemplateId = undefined; await seed(f, "bob", [...user.cardsData, { ...first }]);
  assert.ok((await history(f)).history.issues.some(issue => issue.code === "AMBIGUOUS_PERSONAL_HISTORY_SOURCE"));
  first.historySourceCardTemplateId = 42 as never; await seed(f, "bob", user.cardsData);
  assert.ok((await history(f)).history.issues.some(issue => issue.code === "MALFORMED_PERSONAL_HISTORY_SOURCE"));
});

test("selected Group version projects stable Step identity, excludes removed same-Item evidence and preserves personal adoption", async () => {
  const f = await groupFixture(client), user = await personal(f);
  user.cardsData[0].items.forEach(step => { step.completionStatus = "done"; }); user.cardsData[1].tests = [event("outside-same-item")];
  await seed(f, "bob", user.cardsData);
  await publishGroupCard(f, 0, ["a0", "b0", "new-step"]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  await publishGroupDeck(f, [f.ids[0]]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  const result = await summary(f, "bob", player());
  assert.equal(playerRow(item(result)).completion, 67); assert.equal(playerRow(item(result)).isComplete, false);
  assert.deepEqual(result.selectedCards, [{ cardTemplateId: f.ids[0], version: 2 }]);
  assert.equal((await history(f)).history.count, 0);
  assert.equal((await f.cards.getPersonalUser("bob"))!.cardsData[0].cardTemplateVersion, 1);
});

test("Group-only virtual history is empty but missing required ordinary records and missing content remain incomplete", async () => {
  const f = await groupFixture(client);
  assert.equal((await history(f)).history.state, "empty"); assert.equal((await f.cards.getPersonalUser("bob"))!.cardsData.length, 0);
  await personal(f); await f.cards.users().updateOne({ _id: "bob" }, { $pull: { cardsData: { cardTemplateId: f.ids[0] } } });
  assert.equal((await history(f)).history.state, "incomplete"); assert.equal(playerRow(item(await summary(f, "alice", player()))).state, "incomplete");
  await f.cards.cardVersions().deleteOne({ cardTemplateId: f.ids[0], version: 1 });
  const unknown = await summary(f); assert.equal(item(unknown).coverage, "unknown"); assert.equal(groupRow(item(unknown)).scores.state, "incomplete");
  await assert.rejects(history(f), { code: "GROUP_PROGRESS_SCOPE_UNAVAILABLE" });
  await assert.rejects(history(f, "alice", player(), { cardTemplateId: f.ids[0] }), { code: "GROUP_PROGRESS_SCOPE_UNAVAILABLE" });
});

test("removal snapshots remain scalar-only and later personal assessments cannot grant former inspection", async () => {
  const f = await groupFixture(client), user = await personal(f); user.cardsData[0].tests = [event("before-removal")]; await seed(f, "bob", user.cardsData);
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "remove-follower", targetUserId: "bob" });
  const frozen = await f.repo.removals().find({ experienceId: f.experienceId, userId: "bob" }).toArray();
  assert.equal(JSON.stringify(frozen).includes("before-removal"), false);
  user.cardsData[0].tests.push(event("after-removal")); await seed(f, "bob", user.cardsData);
  await assert.rejects(history(f), { code: "GROUP_FORBIDDEN" });
  assert.deepEqual(await f.repo.removals().find({ experienceId: f.experienceId, userId: "bob" }).toArray(), frozen);
  assert.equal((await summary(f)).group.activeFollowerCount, 1);
});

type Route = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
test("real summary and lazy history routes bind actor, subject, Framework and scope with private responses", async () => {
  const f = await groupFixture(client), frameworks = catalogue(f.ids);
  const bundle = await build({ stdin: { contents: `
    export { GET as summary } from "@/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/summary/route";
    export { GET as item } from "@/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/items/[frameworkItemId]/history/route";
    export { GET as card } from "@/app/api/group-experiences/[experienceId]/frameworks/[frameworkId]/cards/[cardTemplateId]/history/route";
    export { CardRepository } from "@/lib/cards/repository";
    export { setActor } from "@/lib/auth";
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{ name: "disposable-auth", setup(builder) { builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: 'let actor = "alice"; export function setActor(value) { actor = value; } export async function getCurrentUser() { return actor ? { id: actor } : null; }', loader: "ts" })); } }, frameworkCataloguePlugin(frameworks)] });
  const fixtureModule = { exports: {} }; new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve("package.json")), fixtureModule, fixtureModule.exports);
  const api = fixtureModule.exports as Record<string, Route> & { CardRepository: { application: () => unknown }; setActor: (actor: string | null) => void }; api.CardRepository.application = async () => f.cards;
  const request = (query = "", actor = "alice") => new Request(`http://localhost/api/progress${query}`, { headers: { "X-Group-Viewer": actor } });
  const params = (values = {}) => ({ params: Promise.resolve({ experienceId: f.experienceId, frameworkId: "skills", frameworkItemId: "goal", cardTemplateId: f.ids[0], ...values }) });
  for (const route of [api.summary, api.item, api.card]) {
    const response = await route(request("?subjectUserId=bob"), params()); assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store"); assert.equal(response.headers.get("Vary"), "Cookie"); assert.equal(response.headers.get("X-Group-Viewer"), "alice");
    const value = await response.json(); assert.equal(value.perspective.userId, "bob"); assert.equal(value.frameworkId, "skills"); assert.equal(value.experienceId, f.experienceId);
    assert.equal(Date.parse(value.leaseExpiresAt) - Date.parse(value.verifiedAt), 5000); assert.equal(value.subjectAccessEpoch, 0); assert.ok(value.revisionToken);
    assert.equal((await route(request("?subjectUserId=outsider"), params())).status, 403);
    assert.equal((await route(request("?subjectUserId=bob&subjectUserId=carol"), params())).status, 400);
    assert.equal((await route(request("?subjectUserId=bob", "forged"), params())).status, 409);
    assert.equal((await route(request(), params({ frameworkId: "forged" }))).status, 403);
    assert.equal((await route(request(), params({ experienceId: "forged" }))).status, 403);
  }
  assert.equal((await api.item(request("?subjectUserId=bob"), params({ frameworkItemId: "outside" }))).status, 403);
  assert.equal((await api.card(request("?subjectUserId=bob"), params({ cardTemplateId: "guessed" }))).status, 403);
  api.setActor("bob"); assert.equal((await api.summary(request("?subjectUserId=carol", "bob"), params())).status, 403);
  const followerResponse = await api.summary(request("", "bob"), params()); assert.equal(JSON.stringify(await followerResponse.json()).includes("confidenceMinimum"), false);
  api.setActor(null); const unauth = await api.summary(request(), params()); assert.equal(unauth.status, 401); assert.equal(unauth.headers.get("Cache-Control"), "private, no-store");
});

test("a read racing subject revocation retains snapshot identity while subsequent requests deny access", async t => {
  const f = await groupFixture(client), users = f.cards.users(), aggregate = users.aggregate.bind(users);
  let observed!: () => void, resume!: () => void, pause = true;
  const reached = new Promise<void>(resolve => { observed = resolve; }), gate = new Promise<void>(resolve => { resume = resolve; });
  t.mock.method(f.cards, "users", () => users);
  t.mock.method(users, "aggregate", (...args: Parameters<typeof aggregate>) => {
    const cursor = aggregate(...args), read = cursor.toArray.bind(cursor);
    cursor.toArray = async () => { if (pause) { pause = false; observed(); await gate; } return read(); }; return cursor;
  });
  const pending = summary(f, "alice", player()); await reached;
  try { await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "remove-follower", targetUserId: "bob" }); }
  finally { resume(); }
  const old = await pending; assert.equal(old.subjectAccessEpoch, 0); assert.equal(old.structureRevision, 0);
  await assert.rejects(summary(f, "alice", player()), { code: "GROUP_FORBIDDEN" });
  await assert.rejects(history(f), { code: "GROUP_FORBIDDEN" });
});

test("a malformed player Card does not poison unrelated Item metrics or drop that player from affected denominators", async () => {
  const f = await groupFixture(client, { cardCount: 3 });
  const user = await personal(f); user.cardsData[0].items.forEach(step => { step.completionStatus = "done"; });
  await seed(f, "bob", user.cardsData);
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.2.signalReadings.0.reading": 99 } });
  const result = await summary(f), owned = await summary(f, "alice", player());
  assert.equal(groupRow(item(result)).averages.completion, 25); assert.equal(playerRow(item(owned)).completion, 50);
  assert.equal(groupRow(item(result, "next")).averages.state, "incomplete"); assert.equal(playerRow(item(owned, "next")).state, "incomplete");
  assert.equal(result.framework.playerAverages!.state, "incomplete");
});
