import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { build } from "esbuild";
import { frameworkCataloguePlugin } from "./helpers/frameworkCataloguePlugin";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { CardRepository, createFoundationIndexes } from "../src/lib/cards/repository";
import { readCardAssessmentHistory, readFrameworkSummaries, readFrameworkSummary, readItemAssessmentHistory } from "../src/lib/frameworks/readModels";
import { mutateAssessment } from "../src/lib/assessments/repository";
import { cardFixture, deckFixture, frameworkFixtures } from "./fixtures/frameworks";
import type { CardTest } from "../src/lib/cards/model";
import type { AssessmentHistory } from "../src/lib/assessments/history";
import type { Framework } from "../src/lib/frameworks/configuration";

let mongo: MongoMemoryReplSet, client: MongoClient, sequence = 0;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
const event = (id: string, date = "2026-10-11", result = true): CardTest => ({ id, date, result, createdAt: new Date("2026-10-11T10:00:00Z") });
async function setup() {
  const repo = new CardRepository(client.db(`switchplay_test_framework_readers_${sequence++}`), client);
  await createFoundationIndexes(repo.db);
  const cards = [cardFixture("original"), cardFixture("second"), cardFixture("speed"), cardFixture("fork", "original"),
    cardFixture("nested", "fork"), cardFixture("unrelated"), cardFixture("orphan")];
  cards[0].root.draft = structuredClone(cards[0].root.draft!);
  cards[0].version.content.intro.title = "Original adopted title"; cards[0].root.draft.intro.title = "Unpublished secret title";
  cards[0].data.tests = [event("same", "2026-10-10"), event("source-new")]; cards[0].data.testsRevision = 4;
  cards[0].data.signalReadings[0].reading = 1;
  cards[1].data.items.forEach((step) => { step.completionStatus = "skipped"; }); cards[1].data.signalReadings[0].reading = 10;
  cards[2].data.items[0].completionStatus = "done"; cards[2].data.signalReadings[0].reading = 2;
  cards[3].data.items.forEach((step) => { step.completionStatus = "done"; });
  cards[3].data.signalReadings[0].reading = 8; cards[3].data.signalReadings[1].reading = 9;
  cards[3].data.historySourceCardTemplateId = "original"; cards[3].data.tests = [event("same", "2026-10-10", false)];
  cards[4].data.historySourceCardTemplateId = "fork"; cards[4].data.items[0].completionStatus = "done";
  cards[5].data.tests = [event("unmapped-secret")]; cards[6].data.tests = [event("orphan-secret")];
  const decks = [deckFixture("active", ["original", "fork", "unrelated"]), deckFixture("archived", ["fork", "nested", "second", "speed"], true)];
  await repo.cards().insertMany(cards.map((card) => structuredClone(card.root))); await repo.cardVersions().insertMany(cards.map((card) => structuredClone(card.version)));
  await repo.decks().insertMany(decks.map((deck) => structuredClone(deck.root))); await repo.deckVersions().insertMany(decks.map((deck) => structuredClone(deck.version)));
  await repo.users().insertMany([{ _id: "alice", decksData: decks.map((deck) => deck.data), cardsData: cards.map((card) => card.data),
    itemTests: [{ ...event("direct", "2026-10-12"), itemId: "practice-control" }], itemTestsRevision: 3 },
  { _id: "bob", decksData: [], cardsData: [{ ...structuredClone(cards[0].data), tests: [event("bob-private")] }] }]);
  return { repo, cards, decks, frameworks: frameworkFixtures() };
}

type AcceptanceRoute = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
// Exercise the actual route handlers/HTTP boundary and Mongo repositories. Only
// authentication and the application catalogue are replaced in memory;
// no application files, configuration, or real database connections are changed.
async function acceptanceRoutes(repo: CardRepository, frameworks: readonly Framework[]) {
  const bundle = await build({ stdin: { contents: `
    export { GET as summary } from "@/app/api/frameworks/[frameworkId]/summary/route";
    export { GET as itemHistory } from "@/app/api/items-data/[itemId]/history/route";
    export { PATCH as editCardTest } from "@/app/api/cards-data/[cardTemplateId]/tests/[testId]/route";
    export { POST as addItemTest } from "@/app/api/items-data/[itemId]/tests/route";
    export { CardRepository } from "@/lib/cards/repository";
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{ name: "checkpoint3-acceptance-fixtures", setup(builder) {
    builder.onLoad({ filter: /src\/lib\/auth\.ts$/ }, () => ({ contents: 'export async function getCurrentUser() { return { id: "alice" }; }', loader: "ts" }));
  } }, frameworkCataloguePlugin(frameworks)] });
  const fixtureModule = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(resolve(process.cwd(), "package.json")), fixtureModule, fixtureModule.exports);
  const routes = fixtureModule.exports as { summary: AcceptanceRoute; itemHistory: AcceptanceRoute; editCardTest: AcceptanceRoute;
    addItemTest: AcceptanceRoute; CardRepository: { application: () => Promise<CardRepository> } };
  routes.CardRepository.application = async () => repo;
  return routes;
}
const routeContext = (params: Record<string, string>) => ({ params: Promise.resolve(params) });
const readRequest = (path: string) => new Request(`http://localhost${path}`, { headers: { "X-Personal-Viewer": "alice" } });

test("API partial Item history preserves readable results and identifies the unavailable personal source", async () => {
  const { repo, frameworks } = await setup(), routes = await acceptanceRoutes(repo, frameworks);
  // Canonical mapping ancestry remains valid; only the actor's personal source
  // record is missing. Known fork/direct results must still be returned.
  await repo.users().updateOne({ _id: "alice" }, { $pull: { cardsData: { cardTemplateId: "original" } } });
  const before = await repo.getPersonalUser("alice");
  const response = await routes.itemHistory(readRequest("/api/items-data/practice-control/history"), routeContext({ itemId: "practice-control" }));
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const { history }: { history: AssessmentHistory } = await response.json();
  assert.equal(history.state, "incomplete"); assert.equal(history.count, null); assert.equal(history.readableCount, 2);
  assert.deepEqual(history.results.map((row) => row.id), ["direct", "same"]); assert.deepEqual(history.latestThree, []);
  assert.ok(history.issues.some((issue) => issue.code === "MISSING_PERSONAL_HISTORY_SOURCE" && issue.cardTemplateId === "original"));
  assert.ok(history.sources.some((dependency) => dependency.source.kind === "card" && dependency.source.cardTemplateId === "original"
    && dependency.revision === null && dependency.canMutate === false));
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
});

test("API inherited Item assessment edits use the returned source/revision and update original storage without duplicates", async () => {
  const { repo, frameworks } = await setup(), routes = await acceptanceRoutes(repo, frameworks);
  // Only the forks establish this source's Item eligibility.
  await repo.deckVersions().updateOne({ deckTemplateId: "active", version: 1 }, { $pull: { "content.cards": { cardTemplateId: "original" } } });
  const read = async () => {
    const response = await routes.itemHistory(readRequest("/api/items-data/practice-control/history"), routeContext({ itemId: "practice-control" }));
    assert.equal(response.status, 200);
    return (await response.json() as { viewerUserId: string; history: AssessmentHistory });
  };
  const before = (await repo.getPersonalUser("alice"))!, initial = await read();
  const inherited = initial.history.results.find((row) => row.id === "source-new")!;
  assert.equal(inherited.relationship, "inherited-card"); assert.equal(inherited.source.kind, "card");
  assert.equal(inherited.canMutate, true); assert.notEqual(inherited.sourceRevision, null);
  if (inherited.source.kind !== "card") throw new Error("Expected Card storage source");
  const sourceId = inherited.source.cardTemplateId, editPath = `/api/cards-data/${sourceId}/tests/${inherited.id}`;
  const edited = await routes.editCardTest(new Request(`http://localhost${editPath}`, { method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Personal-Viewer": initial.viewerUserId }, body: JSON.stringify({
      viewerUserId: initial.viewerUserId, source: inherited.source, id: inherited.id, expectedRevision: inherited.sourceRevision,
      action: "update", date: "2026-10-14", result: false }) }), routeContext({ cardTemplateId: sourceId, testId: inherited.id }));
  assert.equal(edited.status, 200); assert.equal((await edited.json()).revision, inherited.sourceRevision! + 1);
  const reread = await read(), matches = reread.history.results.filter((row) => row.id === inherited.id
    && row.source.kind === "card" && row.source.cardTemplateId === sourceId);
  assert.equal(matches.length, 1); assert.equal(reread.history.count, initial.history.count);
  assert.equal(matches[0].date, "2026-10-14"); assert.equal(matches[0].result, false);
  assert.equal(matches[0].createdAt, inherited.createdAt); assert.equal(matches[0].sourceRevision, inherited.sourceRevision! + 1);
  const after = (await repo.getPersonalUser("alice"))!;
  assert.equal(after.cardsData.find((data) => data.cardTemplateId === sourceId)!.tests.find((test) => test.id === inherited.id)!.result, false);
  assert.deepEqual(after.cardsData.filter((data) => data.cardTemplateId !== sourceId), before.cardsData.filter((data) => data.cardTemplateId !== sourceId));
  assert.deepEqual(after.decksData, before.decksData); assert.deepEqual(after.itemTests, before.itemTests);
});

test("API direct-only Item assessments provide null metrics, populated history and the latest three without creating memberships", async () => {
  const { repo, frameworks } = await setup(), routes = await acceptanceRoutes(repo, frameworks);
  await repo.users().updateOne({ _id: "alice" }, { $set: { cardsData: [], decksData: [], itemTests: [], itemTestsRevision: 0 } });
  const assessments = [event("oldest", "2026-10-08"), event("middle", "2026-10-09", false), event("recent", "2026-10-10"), event("newest", "2026-10-11", false)];
  for (const [index, assessment] of assessments.entries()) {
    const response = await routes.addItemTest(new Request("http://localhost/api/items-data/practice-control/tests", { method: "POST",
      headers: { "Content-Type": "application/json", "X-Personal-Viewer": "alice" }, body: JSON.stringify({ viewerUserId: "alice",
        source: { kind: "item", itemId: "practice-control" }, id: assessment.id, date: assessment.date, result: assessment.result,
        action: "add", expectedRevision: index }) }), routeContext({ itemId: "practice-control" }));
    assert.equal(response.status, 200); assert.equal((await response.json()).revision, index + 1);
  }
  const beforeRead = await repo.getPersonalUser("alice");
  const summaryResponse = await routes.summary(readRequest("/api/frameworks/practice/summary"), routeContext({ frameworkId: "practice" }));
  assert.equal(summaryResponse.status, 200);
  const { framework } = await summaryResponse.json(), item = framework.areas[0].items[0];
  assert.equal(item.progress.state, "empty"); assert.equal(item.progress.eligibleCardCount, 0);
  assert.equal(item.progress.completion, null); assert.equal(item.progress.confidence, null);
  assert.equal(item.assessments.state, "complete"); assert.equal(item.assessments.count, 4);
  assert.deepEqual(item.assessments.latestThree.map((row: { id: string }) => row.id), ["middle", "recent", "newest"]);
  const historyResponse = await routes.itemHistory(readRequest("/api/items-data/practice-control/history"), routeContext({ itemId: "practice-control" }));
  assert.equal(historyResponse.status, 200);
  const { history }: { history: AssessmentHistory } = await historyResponse.json();
  assert.equal(history.state, "complete"); assert.equal(history.count, 4);
  assert.deepEqual(history.results.map((row) => row.id), ["newest", "recent", "middle", "oldest"]);
  assert.deepEqual(history.latestThree, item.assessments.latestThree);
  assert.ok(history.results.every((row) => row.relationship === "direct-item" && row.source.kind === "item" && row.source.itemId === "practice-control"));
  const after = (await repo.getPersonalUser("alice"))!;
  assert.deepEqual(after.cardsData, []); assert.deepEqual(after.decksData, []); assert.deepEqual(after, beforeRead);
});

test("snapshot summaries aggregate adopted active/archived compositions, independent forks and raw weighted metrics without writes", async () => {
  const { repo, frameworks } = await setup(); const before = await repo.users().find({}).toArray();
  const result = await readFrameworkSummaries(repo, "alice", frameworks);
  const area = result.frameworks[0].areas[0], control = area.items[0], speed = area.items[1];
  assert.equal(control.progress.eligibleCardCount, 4); assert.equal(control.progress.completion, 44); assert.equal(control.progress.confidence, 7);
  assert.equal(area.progress.eligibleCardCount, 5); assert.equal(area.progress.completion, 42); assert.equal(area.progress.confidence, 6);
  assert.equal(speed.progress.completion, 33); assert.equal(area.items[2].progress.state, "empty");
  assert.equal(control.hasConfiguredCards, true); assert.equal(area.items[2].hasConfiguredCards, false);
  assert.equal(result.frameworks[0].areas[1].progress.state, "empty"); assert.deepEqual(result.frameworks[2].areas, []);
  assert.equal(control.assessments.count, 4); assert.equal("results" in control.assessments, false);
  assert.equal(JSON.stringify(result).includes("unmapped-secret"), false); assert.equal(JSON.stringify(result).includes("orphan-secret"), false);
  assert.equal(JSON.stringify(result).includes("bob-private"), false);
  assert.equal(result.frameworks[1].areas[0].items[0].progress.eligibleCardCount, 3);
  assert.deepEqual(await repo.users().find({}).toArray(), before);
  assert.deepEqual((await readFrameworkSummary(repo, "alice", "practice", frameworks)).framework, result.frameworks[0]);
});

test("combined direct, own and inherited assessments preserve source identity and dependencies, including same IDs at different sources", async () => {
  const { repo, frameworks } = await setup();
  const result = await readItemAssessmentHistory(repo, "alice", "practice-control", frameworks);
  assert.equal(result.history.state, "complete"); assert.equal(result.history.results.length, 4);
  assert.deepEqual(result.history.results.map((row) => row.id), ["direct", "source-new", "same", "same"]);
  const original = result.history.results.find((row) => row.source.kind === "card" && row.source.cardTemplateId === "original")!;
  assert.deepEqual(original.exposedThroughCardTemplateIds, ["fork", "nested", "original"]); assert.equal(original.sourceRevision, 4);
  assert.equal(original.sourceTitle, "Original adopted title");
  const fork = await readCardAssessmentHistory(repo, "alice", "nested");
  assert.equal(fork.history.count, 3); assert.equal(fork.history.results[0].relationship, "inherited-card");
  assert.deepEqual(fork.history.sources.map((dependency) => dependency.source),
    [{ kind: "card", cardTemplateId: "fork" }, { kind: "card", cardTemplateId: "nested" }, { kind: "card", cardTemplateId: "original" }]);
  await mutateAssessment(repo, "alice", { viewerUserId: "alice", source: { kind: "card", cardTemplateId: "original" },
    id: "source-new", action: "update", expectedRevision: 4, date: "2026-10-13", result: false });
  assert.equal((await readCardAssessmentHistory(repo, "alice", "fork")).history.results[0].result, false);
  assert.equal((await readItemAssessmentHistory(repo, "alice", "practice-control", frameworks)).history.results[0].sourceRevision, 5);
  // The source no longer establishes eligibility itself, but its retained tests
  // remain readable through eligible forks; it is now explicitly inherited.
  await repo.deckVersions().updateOne({ deckTemplateId: "active", version: 1 }, { $pull: { "content.cards": { cardTemplateId: "original" } } });
  const inheritedOnly = await readItemAssessmentHistory(repo, "alice", "practice-control", frameworks);
  assert.equal(inheritedOnly.history.count, 4);
  assert.equal(inheritedOnly.history.results[0].relationship, "inherited-card");
  assert.deepEqual(inheritedOnly.history.results[0].exposedThroughCardTemplateIds, ["fork", "nested"]);
});

test("direct tests work without memberships, empty catalogues are deliberate and removed Item tests remain readable", async () => {
  const { repo, frameworks } = await setup();
  await repo.users().updateOne({ _id: "alice" }, { $set: { cardsData: [], decksData: [] } });
  const before = await repo.getPersonalUser("alice");
  const summary = await readFrameworkSummaries(repo, "alice", frameworks);
  assert.equal(summary.frameworks[0].areas[0].items[0].progress.state, "empty");
  assert.equal(summary.frameworks[0].areas[0].items[0].assessments.count, 1);
  const configured = await readItemAssessmentHistory(repo, "alice", "practice-control", frameworks);
  assert.equal(configured.configured, true); assert.equal(configured.history.results[0].relationship, "direct-item");
  const retained = await readItemAssessmentHistory(repo, "alice", "practice-control", []);
  assert.equal(retained.configured, false); assert.equal(retained.history.count, 1);
  assert.deepEqual((await readFrameworkSummaries(repo, "alice", [])).frameworks, []);
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await assert.rejects(readItemAssessmentHistory(repo, "alice", "unknown", []), /ITEM_CONTEXT_FORBIDDEN/);
  await assert.rejects(readFrameworkSummary(repo, "alice", "unknown", frameworks), /FRAMEWORK_CONTEXT_FORBIDDEN/);
  await assert.rejects(readCardAssessmentHistory(repo, "alice", " forged "), /INVALID_ASSESSMENT_ID/);
});

test("adopted Card versions are independent of Deck pins and latest publication, with obsolete Steps ignored", async () => {
  const { repo, cards, frameworks } = await setup(); const source = cards[0];
  const v2 = structuredClone(source.version); v2.version = 2; v2.content.intro.title = "Renamed adopted title";
  v2.content.steps[0].stepId = "replacement-step";
  await repo.cardVersions().insertOne(v2);
  await repo.cards().updateOne({ cardTemplateId: "original" }, { $set: { latestVersion: 2 } });
  assert.equal((await readCardAssessmentHistory(repo, "alice", "fork")).history.results[0].sourceTitle, "Original adopted title");
  await repo.users().updateOne({ _id: "alice" }, { $set: { "cardsData.$[card].cardTemplateVersion": 2,
    "cardsData.$[card].items.0.completionStatus": "done", "cardsData.$[card].signalReadings.0.reading": 10 } }, { arrayFilters: [{ "card.cardTemplateId": "original" }] });
  const item = (await readFrameworkSummaries(repo, "alice", frameworks)).frameworks[0].areas[0].items[0];
  assert.equal(item.progress.completion, 44); assert.equal(item.progress.confidence, 9);
  assert.equal((await readCardAssessmentHistory(repo, "alice", "fork")).history.results[0].sourceTitle, "Renamed adopted title");
  const newDeckVersion = structuredClone((await repo.deckVersions().findOne({ deckTemplateId: "active" }))!);
  delete (newDeckVersion as { _id?: unknown })._id; newDeckVersion.version = 2; newDeckVersion.content.cards = [];
  await repo.deckVersions().insertOne(newDeckVersion);
  await repo.decks().updateOne({ deckTemplateId: "active" }, { $set: { latestVersion: 2 } });
  assert.equal((await readFrameworkSummaries(repo, "alice", frameworks)).frameworks[0].areas[0].items[0].progress.eligibleCardCount, 4);
});

test("missing adopted contributors suppress affected metrics only; unmapped missing personal state does not poison scores", async () => {
  const { repo, frameworks } = await setup();
  await repo.users().updateOne({ _id: "alice" }, { $pull: { cardsData: { cardTemplateId: "unrelated" } } });
  assert.equal((await readFrameworkSummaries(repo, "alice", frameworks)).frameworks[0].areas[0].items[0].progress.state, "complete");
  await repo.cardVersions().deleteOne({ cardTemplateId: "second", version: 1 });
  const summary = await readFrameworkSummaries(repo, "alice", frameworks), practice = summary.frameworks[0].areas[0];
  assert.equal(practice.items[0].progress.state, "incomplete"); assert.equal(practice.items[0].progress.completion, null);
  assert.equal(practice.items[0].progress.confidence, null); assert.equal(practice.progress.state, "incomplete");
  assert.equal(practice.items[1].progress.state, "complete"); assert.equal(summary.frameworks[1].areas[0].progress.state, "complete");
  // Personal tests remain readable even when their canonical title/version is unavailable.
  assert.equal(practice.items[0].assessments.state, "complete");
  await repo.users().updateOne({ _id: "alice" }, { $pull: { cardsData: { cardTemplateId: "second" } } });
  const missing = await readItemAssessmentHistory(repo, "alice", "practice-control", frameworks);
  assert.equal(missing.history.state, "incomplete"); assert.equal(missing.history.count, null);
  assert.equal(missing.history.results.length, 4); assert.deepEqual(missing.history.latestThree, []);
});

test("missing explicit mappings do not contaminate unrelated direct or mapped Item histories; Framework diagnostics remain available", async () => {
  const { repo } = await setup();
  const frameworks: Framework[] = [{ id: "maths", title: "Maths", areas: [{ id: "algebra", title: "Algebra", items: [
    { id: "quadratic-equations", title: "Quadratic Equations", cardTemplateIds: ["missing-quadratic-card"] },
    { id: "factor-theorem", title: "Factor Theorem", cardTemplateIds: [] },
    { id: "unrelated-speed", title: "Unrelated mapped Item", cardTemplateIds: ["speed"] },
  ] }] }];
  const routes = await acceptanceRoutes(repo, frameworks);
  const read = async (itemId: string): Promise<AssessmentHistory> => {
    const response = await routes.itemHistory(readRequest(`/api/items-data/${itemId}/history`), routeContext({ itemId }));
    assert.equal(response.status, 200); return (await response.json()).history;
  };
  const before = await repo.getPersonalUser("alice");
  const affected = await read("quadratic-equations");
  assert.equal(affected.state, "incomplete");
  assert.ok(affected.issues.some((issue) => issue.code === "MISSING_CANONICAL_ANCESTOR"));
  assert.deepEqual(affected.latestThree, []);
  const empty = await read("factor-theorem");
  assert.equal(empty.state, "empty"); assert.equal(empty.count, 0);
  assert.deepEqual(empty.results, []); assert.deepEqual(empty.issues, []);
  assert.equal((await read("unrelated-speed")).state, "empty");
  assert.deepEqual(await repo.getPersonalUser("alice"), before);
  await repo.users().updateOne({ _id: "alice" }, { $push: { itemTests: { ...event("factor-direct"), itemId: "factor-theorem" } } });
  const populated = await read("factor-theorem");
  assert.equal(populated.state, "complete"); assert.equal(populated.count, 1);
  assert.equal(populated.results[0].id, "factor-direct"); assert.deepEqual(populated.issues, []);
  assert.equal(populated.latestThree.length, 1);
  const summary = await readFrameworkSummary(repo, "alice", "maths", frameworks);
  const area = summary.framework.areas[0];
  assert.ok(area.progress.issues.some((issue) => issue.code === "MISSING_CANONICAL_ANCESTOR"));
  assert.equal(area.items[0].assessments.state, "incomplete");
  assert.equal(area.items[1].assessments.state, "complete");
  assert.equal(area.items[2].assessments.state, "empty");
});

test("conflicting mapped Items retain incomplete histories without contaminating a separate mapped Item", async () => {
  const { repo } = await setup();
  const frameworks: Framework[] = [{ id: "conflict", title: "Conflict", areas: [{ id: "area", title: "Area", items: [
    { id: "source-item", title: "Source", cardTemplateIds: ["original"] },
    { id: "fork-item", title: "Fork", cardTemplateIds: ["fork"] },
    { id: "safe-item", title: "Safe", cardTemplateIds: ["speed"] },
  ] }] }];
  for (const itemId of ["source-item", "fork-item"]) {
    const { history } = await readItemAssessmentHistory(repo, "alice", itemId, frameworks);
    assert.equal(history.state, "incomplete");
    assert.ok(history.issues.some((issue) => issue.code === "MAPPING_CONFLICT"));
    assert.deepEqual(history.latestThree, []);
  }
  const safe = await readItemAssessmentHistory(repo, "alice", "safe-item", frameworks);
  assert.equal(safe.history.state, "empty"); assert.deepEqual(safe.history.issues, []);
  await repo.cards().updateOne({ cardTemplateId: "unrelated" }, { $set: { forkedFrom: { cardTemplateId: "missing-parent", version: 1 } } });
  const uncertain = await readItemAssessmentHistory(repo, "alice", "safe-item", frameworks);
  assert.equal(uncertain.history.state, "incomplete");
  assert.ok(uncertain.history.issues.some((issue) => issue.code === "MISSING_CANONICAL_ANCESTOR"));
});

test("mapping conflicts are Framework-local; genuinely unmapped Cards and ownership/Library/orphan state are excluded", async () => {
  const { repo, frameworks } = await setup();
  frameworks[0].areas[0].items[1].cardTemplateIds.push("fork");
  const result = await readFrameworkSummaries(repo, "alice", frameworks);
  assert.equal(result.frameworks[0].areas[0].progress.state, "incomplete");
  assert.ok(result.frameworks[0].areas[0].progress.issues.some((issue) => issue.code === "MAPPING_CONFLICT"));
  assert.equal(result.frameworks[1].areas[0].progress.state, "complete");
  assert.equal((await readFrameworkSummaries(repo, "bob", frameworkFixtures())).frameworks[0].areas[0].progress.state, "empty");
  const library = cardFixture("library-only"), owned = cardFixture("owned-only");
  library.root.ownerUserId = "bob"; library.root.visibility = "public"; library.version.visibility = "public";
  await repo.cards().insertMany([library.root, owned.root]); await repo.cardVersions().insertMany([library.version, owned.version]);
  const cleanFrameworks = frameworkFixtures();
  cleanFrameworks[0].areas[0].items[0].cardTemplateIds.push("orphan", "library-only", "owned-only");
  const clean = await readFrameworkSummary(repo, "alice", "practice", cleanFrameworks);
  assert.equal(clean.framework.areas[0].items[0].progress.eligibleCardCount, 4);
  assert.equal(clean.framework.areas[0].items[0].assessments.count, 4);
  assert.equal(JSON.stringify(clean).includes("orphan-secret"), false);
});

test("unresolved ancestry or Deck composition is explicit rather than silently excluded, while empty mapping scopes remain usable", async () => {
  const { repo, frameworks } = await setup();
  await repo.cards().updateOne({ cardTemplateId: "unrelated" }, { $set: { forkedFrom: { cardTemplateId: "missing", version: 1 } } });
  let summary = await readFrameworkSummaries(repo, "alice", frameworks);
  assert.equal(summary.frameworks[0].areas[0].items[0].progress.state, "incomplete");
  assert.equal(summary.frameworks[0].areas[0].items[0].assessments.state, "incomplete");
  assert.equal(summary.frameworks[0].areas[0].items[2].progress.state, "empty");
  assert.equal(summary.frameworks[0].areas[0].items[2].assessments.state, "empty");
  await repo.cards().updateOne({ cardTemplateId: "unrelated" }, { $set: { forkedFrom: null } });
  await repo.deckVersions().deleteOne({ deckTemplateId: "archived", version: 1 });
  summary = await readFrameworkSummaries(repo, "alice", frameworks);
  assert.equal(summary.frameworks[0].areas[0].progress.state, "incomplete");
  assert.equal(summary.frameworks[0].areas[0].items[0].assessments.readableCount, 4);
});

test("missing/inaccessible source titles use neutral fallback without erasing history; missing personal sources mark partial history", async () => {
  const { repo } = await setup();
  await repo.cards().updateOne({ cardTemplateId: "original" }, { $set: { ownerUserId: "bob" } });
  let history = (await readCardAssessmentHistory(repo, "alice", "fork")).history;
  assert.equal(history.state, "complete"); assert.equal(history.results[0].sourceTitle, "Card title unavailable");
  assert.equal(history.results[0].titleAvailability, "unavailable");
  await repo.cards().updateOne({ cardTemplateId: "original" }, { $set: { visibility: "public" } });
  // A public root cannot reveal a private immutable source version's title.
  assert.equal((await readCardAssessmentHistory(repo, "alice", "fork")).history.results[0].titleAvailability, "unavailable");
  await repo.cards().deleteOne({ cardTemplateId: "original" });
  history = (await readCardAssessmentHistory(repo, "alice", "fork")).history;
  assert.equal(history.count, 3); assert.equal(history.results[0].sourceTitle, "Card title unavailable");
  await repo.users().updateOne({ _id: "alice" }, { $pull: { cardsData: { cardTemplateId: "original" } } });
  history = (await readCardAssessmentHistory(repo, "alice", "fork")).history;
  assert.equal(history.state, "incomplete"); assert.equal(history.readableCount, 1);
  assert.ok(history.issues.some((issue) => issue.code === "MISSING_PERSONAL_HISTORY_SOURCE"));
});

test("public foreign forks inherit canonical mappings without exposing their creator's personal histories", async () => {
  const { repo, frameworks, cards } = await setup();
  await repo.cards().updateOne({ cardTemplateId: "fork" }, { $set: { ownerUserId: "bob", visibility: "public" } });
  await repo.cardVersions().updateOne({ cardTemplateId: "fork" }, { $set: { visibility: "public" } });
  const foreign = structuredClone(cards[3].data); foreign.tests = [event("bob-fork-secret")]; foreign.historySourceCardTemplateId = "original";
  await repo.users().updateOne({ _id: "bob" }, { $push: { cardsData: foreign } });
  const result = await readItemAssessmentHistory(repo, "alice", "practice-control", frameworks);
  assert.equal(result.history.count, 4); assert.equal(JSON.stringify(result).includes("bob-fork-secret"), false);
  const bob = await readCardAssessmentHistory(repo, "bob", "fork");
  assert.equal(bob.history.results.some((row) => row.id === "bob-private"), true);
  assert.equal(bob.history.results.some((row) => row.id === "source-new"), false);
  await repo.users().updateOne({ _id: "alice" }, { $unset: { "cardsData.$[card].historySourceCardTemplateId": "" } }, { arrayFilters: [{ "card.cardTemplateId": "fork" }] });
  const canonicalOnly = await readCardAssessmentHistory(repo, "alice", "fork");
  assert.equal(canonicalOnly.history.count, 1);
  assert.equal(canonicalOnly.history.results[0].source.kind === "card" && canonicalOnly.history.results[0].source.cardTemplateId, "fork");
  // Canonical ancestry still establishes mapping, but does not manufacture a
  // personal history link on adoption of somebody else's public fork.
  assert.equal((await readFrameworkSummaries(repo, "alice", frameworks)).frameworks[0].areas[0].items[0].progress.eligibleCardCount, 4);
  await assert.rejects(readCardAssessmentHistory(repo, "bob", "nested"), /CARD_CONTEXT_FORBIDDEN/);
});

test("empty, unfinished and all-skipped scores remain distinct, including archived-only eligibility", async () => {
  const { repo, frameworks } = await setup();
  const actor = (await repo.getPersonalUser("alice"))!;
  const second = actor.cardsData.find((data) => data.cardTemplateId === "second")!;
  const archived = actor.decksData[1];
  await repo.deckVersions().updateOne({ deckTemplateId: "archived", version: 1 }, { $set: { "content.cards": [{ cardTemplateId: "second", cardVersionAtPublish: 1 }] } });
  await repo.users().updateOne({ _id: "alice" }, { $set: { decksData: [archived], cardsData: [second] } });
  let result = await readFrameworkSummaries(repo, "alice", frameworks);
  assert.equal(result.frameworks[0].areas[0].items[0].progress.completion, 100);
  assert.equal(result.frameworks[0].areas[0].items[0].progress.confidence, 10);
  second.items.forEach((step) => { step.completionStatus = "todo"; });
  await repo.users().updateOne({ _id: "alice" }, { $set: { cardsData: [second] } });
  result = await readFrameworkSummaries(repo, "alice", frameworks);
  assert.equal(result.frameworks[0].areas[0].items[0].progress.completion, 0);
  await repo.deckVersions().updateOne({ deckTemplateId: "archived", version: 1 }, { $set: { "content.cards": [] } });
  result = await readFrameworkSummaries(repo, "alice", frameworks);
  assert.equal(result.frameworks[0].areas[0].items[0].progress.state, "empty");
  assert.equal(result.frameworks[0].areas[0].items[0].progress.completion, null);
});

test("readers propagate database failures and snapshot consistency prevents mixing actor state with later publications", async () => {
  const { repo, frameworks } = await setup(); const originalRead = repo.getPersonalUser.bind(repo); let changed = false;
  repo.getPersonalUser = async (actor, session) => {
    const user = await originalRead(actor, session);
    if (!changed) { changed = true; await repo.cardVersions().deleteOne({ cardTemplateId: "second", version: 1 }); }
    return user;
  };
  assert.equal((await readFrameworkSummaries(repo, "alice", frameworks)).frameworks[0].areas[0].items[0].progress.state, "complete");
  repo.getPersonalUser = originalRead;
  assert.equal((await readFrameworkSummaries(repo, "alice", frameworks)).frameworks[0].areas[0].items[0].progress.state, "incomplete");
  repo.cardVersions = () => { throw new Error("Simulated database failure"); };
  await assert.rejects(readCardAssessmentHistory(repo, "alice", "fork"), /Simulated database failure/);
  await assert.rejects(readFrameworkSummaries(repo, "alice", frameworks), /Simulated database failure/);
});

test("large summaries use bounded batch queries rather than per-Card reads", async () => {
  const { repo } = await setup(); const cards = Array.from({ length: 205 }, (_, index) => cardFixture(`batch-${index}`));
  const deck = deckFixture("batch", cards.map((card) => card.root.cardTemplateId), true);
  await repo.cards().insertMany(cards.map((card) => card.root)); await repo.cardVersions().insertMany(cards.map((card) => card.version));
  await repo.decks().insertOne(deck.root); await repo.deckVersions().insertOne(deck.version);
  await repo.users().updateOne({ _id: "alice" }, { $set: { decksData: [deck.data], cardsData: cards.map((card) => card.data), itemTests: [] } });
  const frameworks = [{ id: "batch", title: "Batch", areas: [{ id: "batch-area", title: "Batch Area", items: [
    { id: "batch-item", title: "Batch Item", cardTemplateIds: cards.map((card) => card.root.cardTemplateId) } ] }] }];
  const roots = repo.cards(), versions = repo.cardVersions(); let rootQueries = 0, versionQueries = 0;
  roots.find = new Proxy(roots.find, { apply(target, thisArg, args) { rootQueries++; return Reflect.apply(target, thisArg, args); } });
  versions.find = new Proxy(versions.find, { apply(target, thisArg, args) { versionQueries++; return Reflect.apply(target, thisArg, args); } });
  repo.cards = () => roots; repo.cardVersions = () => versions;
  const summary = await readFrameworkSummaries(repo, "alice", frameworks);
  assert.equal(summary.frameworks[0].areas[0].items[0].progress.eligibleCardCount, 205);
  assert.ok(rootQueries <= 9, `${rootQueries} root queries`); assert.ok(versionQueries <= 6, `${versionQueries} version queries`);
});
