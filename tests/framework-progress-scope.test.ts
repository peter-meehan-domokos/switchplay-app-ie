import assert from "node:assert/strict";
import { test } from "node:test";
import { currentGroupAssignments, resolveAssessmentEvidence, resolveProgressScope } from "../src/lib/frameworks/scope";
import { progressObservationState } from "../src/lib/frameworks/progressState";
import { groupCapabilities } from "../src/lib/groupExperiences/policy";
import type { GroupExperience, GroupMember } from "../src/lib/groupExperiences/model";
import { cardFixture, frameworkFixtures } from "./fixtures/frameworks";
const framework = frameworkFixtures()[0];
const graph = new Map(["original", "second", "speed", "unrelated"].map(id => [id, cardFixture(id).root]));
graph.set("fork", cardFixture("fork", "original").root);
const group = { kind: "group", experienceId: "A" } as const;

test("Group scope retains the hierarchy, partial Item coverage and distinct Card identities", () => {
  const result = resolveProgressScope(framework, group, [{ cardTemplateId: "original", version: 2 }, { cardTemplateId: "fork", version: 1 }], graph);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.areas[0].cardTemplateIds, ["original", "fork"]);
  assert.deepEqual(result.areas[0].items[0], { frameworkItemId: "practice-control", coverage: "inside", cardTemplateIds: ["original", "fork"], directAssessmentTarget: { frameworkItemId: "practice-control" } });
  assert.equal(result.areas[0].items[1].coverage, "outside");
  assert.equal(result.areas[0].items[2].directAssessmentTarget, null);
  assert.equal(result.areas[1].coverage, "outside");
});
test("current Group composition excludes retained selections and refuses ambiguous versions", () => {
  assert.deepEqual(currentGroupAssignments([{ cardTemplateId: "original" }], [{ cardTemplateId: "original", version: 1 }, { cardTemplateId: "second", version: 4 }]), [{ cardTemplateId: "original", version: 1 }]);
  assert.throws(() => currentGroupAssignments([{ cardTemplateId: "original" }], []));
  const result = resolveProgressScope(framework, group, [{ cardTemplateId: "original", version: 1 }, { cardTemplateId: "original", version: 2 }], graph);
  assert.equal(result.areas[0].items[0].coverage, "unknown");
  assert.equal(result.issues[0].code, "AMBIGUOUS_PROGRESS_VERSION");
});
test("personal direct Items remain available without Cards; unknown Group scope is not outside", () => {
  const result = resolveProgressScope(framework, { kind: "personal" }, [], graph);
  assert.deepEqual(result.areas[0].items[2].directAssessmentTarget, { frameworkItemId: "practice-empty" });
  assert.equal(resolveProgressScope(framework, group, [], graph, { unknownComposition: true }).areas[0].coverage, "unknown");
  assert.equal(resolveProgressScope(framework, group, [{ cardTemplateId: "missing", version: 1 }], graph).areas[0].coverage, "unknown");
});
test("assessment evidence follows only live personal lineage and deduplicates shared sources", () => {
  const sources = [{ cardTemplateId: "fork", historySourceCardTemplateId: "original" }, { cardTemplateId: "sibling", historySourceCardTemplateId: "original" }, { cardTemplateId: "original" }, { cardTemplateId: "unrelated" }];
  const result = resolveAssessmentEvidence(["fork", "original"], sources);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.sources.map(source => source.cardTemplateId), ["fork", "original"]);
  assert.deepEqual(result.sources[1].exposedThroughCardTemplateIds, ["fork", "original"]);
  assert.equal(resolveAssessmentEvidence(["new"], [], ["new"]).issues.length, 0);
  assert.equal(resolveAssessmentEvidence(["missing"], []).issues[0].code, "MISSING_PERSONAL_HISTORY_SOURCE");
  assert.equal(resolveAssessmentEvidence(["cycle"], [{ cardTemplateId: "cycle", historySourceCardTemplateId: "cycle" }]).issues[0].code, "PERSONAL_HISTORY_CYCLE");
});
test("explicit states distinguish outside, empty, skipped, unstarted, invalid and rounded completion", () => {
  const statuses = (values: string[]) => values.map(completionStatus => ({ completionStatus }));
  for (const [values, state, completion] of [[[], "empty", null], [["skipped"], "skipped", null], [["todo"], "unstarted", 0], [["skipped", "done"], "done", 100], [["skipped", "done", "todo"], "inProgress", 50]] as const) {
    const result = progressObservationState(statuses([...values])); assert.equal(result.state, state); assert.equal(result.completion, completion);
  }
  assert.equal(progressObservationState(undefined, "outside").state, "outside");
  assert.equal(progressObservationState([], "unknown").state, "incomplete");
  assert.equal(progressObservationState(statuses(["broken"])).state, "incomplete");
  const rounded = progressObservationState(statuses([...Array(199).fill("done"), "todo"]));
  assert.equal(rounded.completion, 100); assert.equal(rounded.isComplete, false);
});
test("capabilities apply to every member, with extrema strictly Admin-only", () => {
  const experience = { experienceId: "A", allowFollowerInspection: true } as GroupExperience;
  const member = { experienceId: "A", isAdmin: false, followerStatus: "active", accessEpoch: 0 } as GroupMember;
  assert.deepEqual(groupCapabilities(experience, member), { canInspectFollowers: true, canViewConfidenceExtrema: false, canManageGroupAssessments: false, canManageMembers: false });
  assert.equal(groupCapabilities({ ...experience, allowFollowerInspection: false }, member).canInspectFollowers, false);
  assert.equal(groupCapabilities(experience, { ...member, isAdmin: true }).canViewConfidenceExtrema, true);
  assert.equal(groupCapabilities(experience, { ...member, isAdmin: true, followerStatus: "never" }).canManageMembers, true);
  assert.throws(() => groupCapabilities(experience, { ...member, followerStatus: "removed" }));
  assert.throws(() => groupCapabilities(experience, { ...member, experienceId: "B" }));
});
