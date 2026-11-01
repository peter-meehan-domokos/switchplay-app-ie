import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture } from "./helpers/groupExperiences";
import { mutateAssessment, readAssessmentList } from "../src/lib/assessments/repository";
import { readCardAssessmentHistory } from "../src/lib/frameworks/readModels";
import { manualAssessmentProvenance, projectAssessmentOrigin } from "../src/lib/assessments/provenance";
import { authorisedAssessmentOriginNames } from "../src/lib/assessments/provenanceReads";

let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });

test("new personal Card and direct Item tests stamp actor/context and preserve provenance on edits and retries", async () => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1);
  const source = { kind: "card", cardTemplateId: f.ids[0] } as const;
  const command = { action: "add", viewerUserId: "bob", source, expectedRevision: 0, id: "card-test", date: "2026-01-02", result: true, deckTemplateId: f.deckId } as const;
  const before = await f.cards.getPersonalUser("bob");
  const saved = await mutateAssessment(f.cards, "bob", command), provenance = saved.tests[0].provenance;
  assert.deepEqual(provenance, manualAssessmentProvenance("bob", { groupExperienceId: null, deckTemplateId: f.deckId }));
  assert.equal(saved.tests[0].origin?.label, "Personal"); assert.notEqual(saved.tests[0].createdAt.slice(0, 10), command.date);
  assert.equal((await mutateAssessment(f.cards, "bob", command)).outcome, "already-present");
  const edited = await mutateAssessment(f.cards, "bob", { action: "update", viewerUserId: "bob", source, expectedRevision: 1, id: command.id, date: "2026-01-03", result: false });
  assert.deepEqual(edited.tests[0].provenance, provenance); assert.equal(edited.tests[0].createdAt, saved.tests[0].createdAt);
  const catalogue = [{ id: "framework", title: "Framework", areas: [{ id: "area", title: "Area", items: [{ id: "goal", title: "Goal", cardTemplateIds: [] }] }] }];
  const direct = await mutateAssessment(f.cards, "bob", { action: "add", viewerUserId: "bob", source: { kind: "item", itemId: "goal" }, expectedRevision: 0, id: "item-test", date: "2026-01-03", result: true }, catalogue);
  assert.deepEqual(direct.tests[0].provenance, manualAssessmentProvenance("bob", { groupExperienceId: null, deckTemplateId: null }));
  const after = (await f.cards.getPersonalUser("bob"))!;
  assert.deepEqual(after.decksData, before!.decksData); assert.equal(after.cardsData[0].cardTemplateVersion, before!.cardsData[0].cardTemplateVersion);
});

test("legacy origin remains Unknown after editing without fabricated fields or timestamp changes", async () => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1);
  const createdAt = new Date("2026-01-01T12:00:00Z"), source = { kind: "card", cardTemplateId: f.ids[0] } as const;
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.tests": [{ id: "legacy", date: "2026-01-01", result: true, createdAt }] } });
  assert.equal((await readAssessmentList(f.cards, "bob", source)).tests[0].origin?.label, "Unknown");
  const edited = await mutateAssessment(f.cards, "bob", { action: "update", viewerUserId: "bob", source, expectedRevision: 0, id: "legacy", date: "2026-01-02", result: false });
  assert.equal(edited.tests[0].provenance, undefined); assert.equal(edited.tests[0].createdAt, createdAt.toISOString());
  assert.equal((await readCardAssessmentHistory(f.cards, "bob", f.ids[0])).history.results[0].origin?.label, "Unknown");
});

test("origin names require current authority and safe projection leaks no raw provenance identities", async () => {
  const f = await groupFixture(client); await f.cards.ensureDeckData("bob", f.deckId, 1);
  const test = { id: "group-origin", date: "2026-01-01", result: true, createdAt: new Date(),
    provenance: manualAssessmentProvenance("bob", { groupExperienceId: f.experienceId, deckTemplateId: f.deckId }) };
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.tests": [test] } });
  assert.equal((await readCardAssessmentHistory(f.cards, "bob", f.ids[0])).history.results[0].origin?.label, f.command.name);
  await f.cards.transaction(async session => {
    const names = await authorisedAssessmentOriginNames(f.cards, "outsider", [test], session);
    const safe = projectAssessmentOrigin(test, names), json = JSON.stringify(safe);
    assert.equal(safe.origin.label, "Other group");
    for (const secret of [f.experienceId, f.deckId, f.command.name, "enteredByUserId"]) assert.equal(json.includes(secret), false);
  });
  await f.repo.members().updateOne({ experienceId: f.experienceId, userId: "carol" }, { $set: { accessEpoch: -1 } });
  await f.cards.transaction(async session => {
    assert.equal((await authorisedAssessmentOriginNames(f.cards, "carol", [test], session)).size, 0);
  });
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "remove-follower", targetUserId: "bob" });
  assert.equal((await readCardAssessmentHistory(f.cards, "bob", f.ids[0])).history.results[0].origin?.label, "Other group");
});
