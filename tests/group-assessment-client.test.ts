import assert from "node:assert/strict";
import { test } from "node:test";
import { persistGroupAssessment } from "../src/lib/assessments/groupClient";
import { personalWork } from "../src/lib/cards/personalWork";
import { type AssessmentCommand } from "../src/lib/assessments/contracts";
import { comparisonLines } from "../src/components/progress/progressComparisons";
import type { GroupProgressSummary } from "../src/lib/groupExperiences/progressReads";

test("Group lost-response retry uses the captured Group source and server reconciliation, never a redacted Add guess", async t => {
  const actor = "group-client-actor", source = { kind: "item" as const, itemId: "skill" }, group = { experienceId: "A" };
  const input: AssessmentCommand = { action: "add", viewerUserId: actor, source, expectedRevision: 0, id: "result", result: true, date: "2026-11-01" };
  const urls: string[] = []; let posts = 0;
  t.mock.method(globalThis, "fetch", async (url: string, options?: RequestInit) => {
    urls.push(url);
    if (options?.method === "POST") { posts++; const command = JSON.parse(String(options.body)); assert.equal(command.expectedRevision, 0); assert.deepEqual(command.target, { frameworkItemId: "skill" }); assert.equal(command.source, undefined); if (posts === 1) throw Error("Lost committed response"); }
    return Response.json({ viewerUserId: actor, experienceId: "A", owner: { kind: "group", experienceId: "A" }, source, target: { frameworkItemId: "skill" }, revision: 1,
      tests: [{ id: "result", result: true, date: input.date, createdAt: "2026-11-01T12:00:00Z", origin: { kind: "group", label: "A" } }], outcome: "already-present" }, { headers: { "X-Group-Viewer": actor } });
  });
  const operation = persistGroupAssessment(input, group); group.experienceId = "B";
  const result = await operation; assert.equal(result.outcome, "already-present"); assert.equal(posts, 2); assert.ok(urls.every(url => url.includes("/A/items/skill/tests")));
  assert.equal(personalWork.hasWork({ userId: actor, cardIds: ["card"] }), false);
});
test("Group request preparation fails before work is pending and invalid owner responses are never accepted", async t => {
  const actor = "group-client-prepare", source = { kind: "card" as const, cardTemplateId: "card" };
  const command: AssessmentCommand = { action: "add", viewerUserId: actor, source, expectedRevision: 0, id: "result", result: true, date: "2026-11-01", deckTemplateId: "deck" };
  assert.throws(() => persistGroupAssessment(command, { experienceId: " " }));
  assert.equal(personalWork.hasWork({ userId: actor, cardIds: ["card"], context: { kind: "experience-assessment", experienceId: " " } }), false);
  t.mock.method(globalThis, "fetch", async () => Response.json({ viewerUserId: actor, experienceId: "B", owner: { kind: "group", experienceId: "B" }, source, target: { cardTemplateId: "card" }, revision: 1, tests: [] }, { headers: { "X-Group-Viewer": actor } }));
  await assert.rejects(persistGroupAssessment(command, { experienceId: "A" }), { code: "GROUP_CONTEXT_CONFLICT" });
});
test("comparison wording preserves explicit states and only requested capabilities expose extrema", () => {
  const row = { groupScores: { state: "skipped", completion: null, confidence: 7 }, playerAverages: { state: "inProgress", completion: 25, confidence: 5, doing: 3, done: 2, confidenceMinimum: 2, confidenceMaximum: 9 } } as unknown as GroupProgressSummary["framework"]["areas"][number];
  assert.deepEqual(comparisonLines(row, "groupScores", "Completion", true), ["Player completion: 25%", "3 doing, 2 done"]);
  assert.deepEqual(comparisonLines(row, "groupScores", "Confidence", false), ["Player confidence: 5"]);
  assert.deepEqual(comparisonLines(row, "playerAverages", "Completion", true), ["Group completion: skip"]);
});
