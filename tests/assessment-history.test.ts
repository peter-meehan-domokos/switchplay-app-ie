import assert from "node:assert/strict";
import { test } from "node:test";
import { collectCardHistory, compactAssessmentHistory, projectAssessmentHistory } from "../src/lib/assessments/history";
import { frameworkMetadata } from "../src/lib/frameworks/readModels";
import { cardFixture, frameworkFixtures } from "./fixtures/frameworks";
import type { CardData, CardTest, PersonalUser } from "../src/lib/cards/model";

const event = (id: string, date = "2026-10-11", result = true, createdAt = "2026-10-11T10:00:00Z"): CardTest => ({ id, date, result, createdAt: new Date(createdAt) });
const user = (cardsData: CardData[]): PersonalUser => ({ _id: "alice", decksData: [], cardsData });

test("metadata keeps configuration order, permits empty structures and does not expose content mappings", () => {
  assert.deepEqual(frameworkMetadata(), []);
  const metadata = frameworkMetadata(frameworkFixtures());
  assert.deepEqual(metadata.map((framework) => framework.id), ["practice", "alternative", "empty-framework"]);
  assert.deepEqual(metadata[0].areas[0].items[0], { id: "practice-control", title: "Control" });
  assert.deepEqual(metadata[0].areas[1].items, []); assert.deepEqual(metadata[2].areas, []);
});
test("combined histories deduplicate by original source and ID, order deterministically and reverse only the latest three", () => {
  const source = cardFixture("source").data, fork = cardFixture("fork").data, sibling = cardFixture("sibling").data;
  fork.historySourceCardTemplateId = "source"; sibling.historySourceCardTemplateId = "source";
  source.tests = [event("same", "2026-10-10"), event("new", "2026-10-11")]; source.testsRevision = 4;
  fork.tests = [event("same", "2026-10-10", false)]; fork.testsRevision = 2;
  const actor = user([source, fork, sibling]); actor.itemTests = [{ ...event("direct", "2026-10-12"), itemId: "item" }]; actor.itemTestsRevision = 7;
  const history = projectAssessmentHistory(actor, [collectCardHistory(actor.cardsData, "fork"), collectCardHistory(actor.cardsData, "sibling")],
    new Map([["source", { title: "Same title", availability: "available" }], ["fork", { title: "Same title", availability: "available" }]]),
    { itemId: "item", ownCardIds: ["fork", "sibling"] });
  assert.equal(history.state, "complete"); assert.equal(history.count, 4);
  assert.deepEqual(history.results.map((row) => [row.id, row.source.kind === "card" ? row.source.cardTemplateId : row.source.itemId]),
    [["direct", "item"], ["new", "source"], ["same", "fork"], ["same", "source"]]);
  assert.deepEqual(history.latestThree.map((row) => row.id), ["same", "new", "direct"]);
  assert.deepEqual(history.results[1].exposedThroughCardTemplateIds, ["fork", "sibling"]);
  assert.equal(history.results[1].relationship, "inherited-card"); assert.equal(history.results[1].sourceRevision, 4);
  assert.equal(history.results[2].relationship, "own-card"); assert.equal(history.results[0].sourceTitle, "Item test");
  assert.equal(history.sources.length, 4); assert.equal("results" in compactAssessmentHistory(history), false);
  const reverse = projectAssessmentHistory(actor, [collectCardHistory(actor.cardsData, "sibling"), collectCardHistory(actor.cardsData, "fork")], new Map(),
    { itemId: "item", ownCardIds: ["sibling", "fork"] });
  assert.deepEqual(reverse.results.map((row) => [row.source, row.id]), history.results.map((row) => [row.source, row.id]));
});
test("creation time breaks duplicate assessment-date ties before stable source identity", () => {
  const data = cardFixture("card").data; data.tests = [event("first"), event("later", "2026-10-11", false, "2026-10-11T11:00:00Z")];
  const history = projectAssessmentHistory(user([data]), [collectCardHistory([data], "card")], new Map(), { ownCardIds: ["card"] });
  assert.deepEqual(history.results.map((row) => row.id), ["later", "first"]);
  assert.equal(history.results[0].titleAvailability, "unavailable"); assert.equal(history.state, "complete");
});
test("missing, malformed, ambiguous and cyclic personal history preserve readable events but suppress newest-three claims", () => {
  for (const mode of ["missing", "malformed", "ambiguous", "cycle"] as const) {
    const data = cardFixture("fork").data, source = cardFixture("source").data;
    data.tests = [event("readable")]; data.historySourceCardTemplateId = "source";
    const records = [data, source];
    if (mode === "missing") records.pop();
    if (mode === "malformed") data.historySourceCardTemplateId = "";
    if (mode === "ambiguous") records.push(structuredClone(source));
    if (mode === "cycle") source.historySourceCardTemplateId = "fork";
    const history = projectAssessmentHistory(user(records), [collectCardHistory(records, "fork")], new Map(), { ownCardIds: ["fork"] });
    assert.equal(history.state, "incomplete", mode); assert.equal(history.count, null); assert.equal(history.readableCount, 1);
    assert.equal(history.results[0].id, "readable"); assert.deepEqual(history.latestThree, []); assert.ok(history.issues.length);
  }
});
test("malformed assessments or revisions are incomplete, retain valid rows and disable unsafe mutation", () => {
  const data = cardFixture("card").data; data.tests = [event("valid"), { ...event("bad"), result: "bad" } as unknown as CardTest];
  const history = projectAssessmentHistory(user([data]), [collectCardHistory([data], "card")], new Map(), { ownCardIds: ["card"] });
  assert.equal(history.state, "incomplete"); assert.equal(history.results.length, 1); assert.equal(history.results[0].canMutate, false);
  data.tests = []; data.testsRevision = -1;
  assert.equal(projectAssessmentHistory(user([data]), [collectCardHistory([data], "card")], new Map(), { ownCardIds: ["card"] }).state, "incomplete");
});
test("empty and direct-only histories need no Card records", () => {
  const actor = user([]);
  const empty = projectAssessmentHistory(actor, [], new Map(), { itemId: "item", ownCardIds: [] });
  assert.equal(empty.state, "empty"); assert.equal(empty.count, 0); assert.equal(empty.sources[0].revision, 0);
  actor.itemTests = [{ ...event("direct"), itemId: "item" }];
  assert.equal(projectAssessmentHistory(actor, [], new Map(), { itemId: "item", ownCardIds: [] }).results[0].relationship, "direct-item");
});
