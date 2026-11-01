import assert from "node:assert/strict";
import { test } from "node:test";
import { persistAssessment, readPersonalAssessments } from "../src/lib/assessments/client";
import { manualAssessmentProvenance } from "../src/lib/assessments/provenance";
import { personalWork } from "../src/lib/cards/personalWork";
import { assessmentTarget, type AssessmentCommand } from "../src/lib/assessments/contracts";

test("HTTP LAN Group transport captures context, shares personal work and reconciles a lost response", async t => {
  const actor = "group-client", group = { experienceId: "A" }, source = { kind: "card", cardTemplateId: "card" } as const;
  const command: AssessmentCommand = { action: "add", viewerUserId: actor, source, expectedRevision: 0, id: "test", date: "2026-11-01", result: true, deckTemplateId: "deck" };
  const methods: string[] = [], urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    methods.push(options?.method ?? "GET"); urls.push(String(url));
    if (options?.method === "POST") { group.experienceId = "B"; throw new TypeError("Response lost"); }
    return Response.json({ viewerUserId: actor, source, revision: 1, experienceId: "A", owner: { kind: "personal", userId: actor }, target: assessmentTarget(source),
      tests: [{ id: "test", date: command.date, result: true, createdAt: "2026-11-01T12:00:00Z", provenance: manualAssessmentProvenance(actor, { groupExperienceId: "A", deckTemplateId: "deck" }) }] },
    { headers: { "X-Personal-Viewer": actor, "X-Group-Viewer": actor } });
  });
  const result = await persistAssessment(command, [], group);
  assert.equal(result.outcome, "already-present"); assert.deepEqual(methods, ["POST", "GET"]);
  assert.ok(urls.every(url => url.includes("/group-experiences/A/cards/card/personal-tests")));
  await personalWork.wait({ userId: actor, cardIds: ["card"] });
});
test("Group response identity and request preparation reject cross-context data before pending work", async t => {
  const actor = "group-response", source = { kind: "item", itemId: "goal" } as const;
  const command: AssessmentCommand = { action: "add", viewerUserId: actor, source, expectedRevision: 0, id: "test", date: "2026-11-01", result: true };
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; return Response.json({ viewerUserId: actor, source, revision: 0, tests: [], experienceId: "B", owner: { kind: "personal", userId: actor }, target: { frameworkItemId: "goal" } }, { headers: { "X-Personal-Viewer": actor, "X-Group-Viewer": actor } }); });
  assert.throws(() => persistAssessment(command, ["context-card"], { experienceId: "A" })); assert.equal(requests, 0);
  assert.equal(personalWork.hasWork({ userId: actor, cardIds: ["context-card"] }), false);
  await assert.rejects(readPersonalAssessments(actor, source, { experienceId: "A", frameworkId: "skills" }), { code: "GROUP_CONTEXT_CONFLICT" });
});
