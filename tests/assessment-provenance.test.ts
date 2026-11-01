import assert from "node:assert/strict";
import { test } from "node:test";
import { assessmentTarget, assertAssessmentCommand, reconcileAssessment, type AssessmentCommand, type AssessmentList } from "../src/lib/assessments/contracts";
import { assessmentOrigin, manualAssessmentProvenance, projectAssessmentOrigin, readAssessmentProvenance } from "../src/lib/assessments/provenance";
import { readablePersonalHistory } from "../src/lib/cards/personalHistory";
import { collectCardHistory, projectAssessmentHistory } from "../src/lib/assessments/history";
import { cardFixture } from "./fixtures/frameworks";

test("conceptual assessment targets preserve exactly one Card or Framework Item identity", () => {
  assert.deepEqual(assessmentTarget({ kind: "item", itemId: "item" }), { frameworkItemId: "item" });
  assert.deepEqual(assessmentTarget({ kind: "card", cardTemplateId: "card" }), { cardTemplateId: "card" });
  assert.throws(() => assessmentTarget({ kind: "item", itemId: "item", cardTemplateId: "card" } as never));
});
test("safe provenance labels distinguish reliable Personal, visible Group, Other group and Unknown", () => {
  const personal = manualAssessmentProvenance("alice", { groupExperienceId: null, deckTemplateId: null });
  const group = { ...personal, groupExperienceId: "secret-id", deckTemplateId: "private-deck" };
  assert.deepEqual(assessmentOrigin(undefined), { kind: "unknown", label: "Unknown" });
  assert.deepEqual(assessmentOrigin(personal), { kind: "personal", label: "Personal" });
  assert.deepEqual(assessmentOrigin(group), { kind: "other-group", label: "Other group" });
  assert.deepEqual(assessmentOrigin(group, new Map([["secret-id", "Galway U18"]])), { kind: "group", label: "Galway U18" });
  const projected = projectAssessmentOrigin({ id: "result", provenance: group });
  assert.equal(JSON.stringify(projected).includes("secret-id"), false); assert.equal(JSON.stringify(projected).includes("private-deck"), false);
  assert.equal(JSON.stringify(projected).includes("alice"), false); assert.equal(readAssessmentProvenance({ ...personal, forged: true }), undefined);
});
test("personal history and live inherited assessment transformations preserve original provenance", () => {
  const source = cardFixture("source").data, fork = cardFixture("fork").data;
  fork.historySourceCardTemplateId = "source";
  const provenance = manualAssessmentProvenance("alice", { groupExperienceId: "group-A", deckTemplateId: "deck-A" });
  source.tests = [{ id: "test", date: "2026-11-01", result: true, createdAt: new Date("2026-11-02T12:00:00Z"), provenance }];
  assert.deepEqual(readablePersonalHistory(source).tests[0].provenance, provenance);
  const user = { _id: "alice", decksData: [], cardsData: [source, fork] };
  const history = projectAssessmentHistory(user, [collectCardHistory(user.cardsData, "fork")], new Map(), { ownCardIds: ["fork"], originNames: new Map([["group-A", "Group A"]]) });
  assert.deepEqual(history.results[0].provenance, provenance); assert.equal(history.results[0].origin?.label, "Group A");
  assert.equal(history.results[0].createdAt, "2026-11-02T12:00:00.000Z");
});
test("Add retry recognises the original entry context without inventing legacy provenance", () => {
  const command: AssessmentCommand = { action: "add", viewerUserId: "alice", source: { kind: "card", cardTemplateId: "card" }, id: "test", expectedRevision: 0, result: true, date: "2026-11-01", deckTemplateId: "deck" };
  const provenance = manualAssessmentProvenance("alice", { groupExperienceId: null, deckTemplateId: "deck" });
  const list: AssessmentList = { viewerUserId: "alice", source: command.source, revision: 1,
    tests: [{ id: "test", date: command.date, result: true, createdAt: "2026-11-01T12:00:00Z", provenance }] };
  assert.equal(reconcileAssessment(command, list), "already-present");
  assert.equal(reconcileAssessment({ ...command, deckTemplateId: "other" }, list), null);
  assert.equal(reconcileAssessment(command, { ...list, tests: [{ ...list.tests[0], provenance: undefined }] }), "already-present");
  assert.throws(() => assertAssessmentCommand({ ...command, provenance }));
});
