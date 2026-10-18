import assert from "node:assert/strict";
import { test } from "node:test";
import { assertAssessmentCommand, assertAssessmentSource, assessmentRevision, newestAssessmentsFirst, reconcileAssessment,
  type AssessmentCommand, type AssessmentList } from "../src/lib/assessments/contracts";

const command: AssessmentCommand = { viewerUserId: "alice", source: { kind: "card", cardTemplateId: "original" },
  expectedRevision: 0, id: "test-1", action: "add", deckTemplateId: "deck", date: "2026-10-11", result: true };
const list: AssessmentList = { viewerUserId: "alice", source: command.source, revision: 1,
  tests: [{ id: "test-1", date: "2026-10-11", result: true, createdAt: "2026-10-11T10:00:00.000Z" }] };
test("assessment contracts accept only exact source identities, date-only dates, binary results and permitted mutation fields", () => {
  assertAssessmentCommand(command);
  assert.throws(() => assertAssessmentCommand({ ...command, source: { kind: "item", itemId: "goal" }, deckTemplateId: undefined }));
});
test("assessment validation rejects forged fields, invalid dates/IDs/revisions and source identity changes", () => {
  for (const patch of [{ id: " " }, { id: "a\u0000b" }, { id: "x".repeat(201) }, { expectedRevision: -1 },
    { expectedRevision: 0.5 }, { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { date: "2026-02-30" },
    { date: " 2026-10-11" }, { result: "pass" }, { createdAt: "2020-01-01" }, { userId: "bob" },
    { source: { kind: "card", cardTemplateId: "original", itemId: "goal" } }, { deckTemplateId: undefined }]) {
    assert.throws(() => assertAssessmentCommand({ ...command, ...patch }));
  }
  assert.throws(() => assertAssessmentSource({ kind: "item", cardTemplateId: "fake" }));
  const { deckTemplateId, ...item } = command; void deckTemplateId;
  assertAssessmentCommand({ ...item, source: { kind: "item", itemId: "goal" } });
  assertAssessmentCommand({ viewerUserId: "alice", source: command.source, expectedRevision: 1, id: "test-1", action: "delete" });
  assert.throws(() => assertAssessmentCommand({ ...command, action: "update" })); // Deck context is not a mutable assessment field.
});
test("revision compatibility and retry reconciliation never replay stale missing Adds or edits", () => {
  assert.equal(assessmentRevision(undefined), 0); assert.equal(assessmentRevision(0), 0);
  for (const invalid of [null, -1, 0.5, "0", Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => assessmentRevision(invalid));
  assert.equal(reconcileAssessment(command, list), "already-present");
  assert.equal(reconcileAssessment(command, { ...list, tests: [], revision: 2 }), null);
  assert.equal(reconcileAssessment(command, { ...list, tests: [{ ...list.tests[0], result: false }] }), null);
  assert.equal(reconcileAssessment(command, { ...list, revision: 0 }), null);
  assert.equal(reconcileAssessment({ ...command, action: "delete" }, { ...list, tests: [] }), "already-absent");
  assert.throws(() => reconcileAssessment(command, { ...list, viewerUserId: "bob" }));
  assert.throws(() => reconcileAssessment(command, { ...list, source: { kind: "card", cardTemplateId: "fork" } }));
});
test("assessment ordering is stable across equal dates and timestamps without modifying stored order", () => {
  const tests = [{ ...list.tests[0], id: "z" }, { ...list.tests[0], id: "a" },
    { ...list.tests[0], id: "late", createdAt: "2026-10-11T11:00:00.000Z" },
    { ...list.tests[0], id: "older-date", date: "2026-10-10", createdAt: "2026-10-12T10:00:00.000Z" }];
  assert.deepEqual(newestAssessmentsFirst(tests).map((test) => test.id), ["late", "a", "z", "older-date"]);
  assert.equal(tests[0].id, "z");
});
