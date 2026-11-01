import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, publishGroupCard, publishGroupDeck, reviewedUpdate } from "./helpers/groupExperiences";
import { readCardAssessmentHistory, readFrameworkSummary, readItemAssessmentHistory } from "../src/lib/frameworks/readModels";
import type { Framework } from "../src/lib/frameworks/configuration";

let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
function frameworks(ids: string[]): Framework[] { return [{ id: "skills", title: "Skills", areas: [{ id: "area", title: "Area", items:
  ids.map((id, index) => ({ id: `item-${index}`, title: `Item ${index}`, cardTemplateIds: [id] })).concat([{ id: "direct-only", title: "Direct only", cardTemplateIds: [] }]) }] }]; }

test("never-opened Group-only assignments project without writes; Admin-only membership adds no eligibility", async () => {
  const f = await groupFixture(client), catalogue = frameworks(f.ids), before = await f.cards.getPersonalUser("bob");
  const summary = (await readFrameworkSummary(f.cards, "bob", "skills", catalogue)).framework;
  assert.equal(summary.areas[0].progress.eligibleCardCount, 2); assert.equal(summary.areas[0].progress.completion, 0);
  assert.equal(summary.areas[0].items[0].assessments.state, "empty");
  assert.equal((await readItemAssessmentHistory(f.cards, "bob", "item-0", catalogue)).history.state, "empty");
  assert.equal((await readCardAssessmentHistory(f.cards, "bob", f.ids[0])).history.state, "empty");
  assert.deepEqual(await f.cards.getPersonalUser("bob"), before);
  assert.equal((await readFrameworkSummary(f.cards, "alice", "skills", catalogue)).framework.areas[0].progress.state, "empty");
});

test("personal plus two Groups deduplicates and uses highest adopted version for metrics and history titles", async () => {
  const f = await groupFixture(client), catalogue = frameworks(f.ids);
  const second = await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "Second" });
  await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.cards.setCompletion("bob", f.deckId, f.ids[0], "a0", "done");
  await f.cards.setCompletion("bob", f.deckId, f.ids[0], "b0", "done");
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { "cardsData.0.tests": [{ id: "one-test", date: "2026-11-01", result: true, createdAt: new Date() }],
    "cardsData.0.reflection": "PRIVATE", "cardsData.0.targetDate": "2027-06-15" } });
  await publishGroupCard(f, 0, ["a0", "b0", "v2"]);
  await f.repo.adoptUpdate("alice", second.experienceId, await reviewedUpdate(f, "card", f.ids[0], "alice", second.experienceId));
  const root = (await f.cards.cards().findOne({ cardTemplateId: f.ids[0] }))!, prior = (await f.cards.getCardVersion(f.ids[0], 2))!;
  await f.cards.saveCardDraft("creator", f.ids[0], root.revision, { ...prior.content, intro: { ...prior.content.intro, title: "Adopted version three" },
    steps: prior.content.steps.map((step, i) => ({ ...step, stepId: i === 2 ? "v3" : step.stepId })) });
  await f.cards.publishCard("creator", f.ids[0], root.revision + 1);
  await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  await publishGroupCard(f, 0, ["a0", "b0", "unadopted-v4"]);
  const before = await f.cards.getPersonalUser("bob");
  const item = (await readFrameworkSummary(f.cards, "bob", "skills", catalogue)).framework.areas[0].items[0];
  assert.equal(item.progress.eligibleCardCount, 1); assert.equal(item.progress.completion, 67); assert.equal(item.assessments.count, 1);
  const history = (await readItemAssessmentHistory(f.cards, "bob", "item-0", catalogue)).history;
  assert.equal(history.results[0].sourceTitle, "Adopted version three");
  assert.deepEqual(await f.cards.getPersonalUser("bob"), before); assert.equal(before!.cardsData[0].cardTemplateVersion, 1);
});

test("Deck removal and departure retain eligibility without following later Group adoptions", async () => {
  const f = await groupFixture(client), catalogue = frameworks(f.ids);
  await publishGroupCard(f, 0, ["a0", "b0", "v2"]);
  await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "card", f.ids[0]));
  await publishGroupDeck(f, [f.ids[1]]);
  await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  let summary = (await readFrameworkSummary(f.cards, "bob", "skills", catalogue)).framework;
  assert.equal(summary.areas[0].progress.eligibleCardCount, 2);
  const meta = await f.repo.get("alice", f.experienceId);
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: meta.structureRevision, kind: "remove-follower", targetUserId: "bob" });
  await publishGroupCard(f, 0, ["a0", "b0", "v3"]);
  // If the reader accidentally picks a later publication this missing version
  // would turn the formerly assigned Item incomplete instead of valid defaults.
  await f.cards.cardVersions().deleteOne({ cardTemplateId: f.ids[0], version: 3 });
  summary = (await readFrameworkSummary(f.cards, "bob", "skills", catalogue)).framework;
  assert.equal(summary.areas[0].progress.eligibleCardCount, 2); assert.equal(summary.areas[0].progress.state, "complete");
  await assert.rejects(f.repo.get("bob", f.experienceId), { code: "GROUP_FORBIDDEN" });
});

test("personal retained assignments survive composition loss and direct Item history remains independent", async () => {
  const f = await groupFixture(client, { followers: [] }), catalogue = frameworks(f.ids);
  await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { retainedCardAssignments: f.command.manifest.cards,
    itemTests: [{ id: "direct", itemId: "direct-only", date: "2026-11-01", result: false, createdAt: new Date() }], decksData: [] } });
  const result = (await readFrameworkSummary(f.cards, "bob", "skills", catalogue)).framework;
  assert.equal(result.areas[0].progress.eligibleCardCount, 2); assert.equal(result.areas[0].items[2].assessments.count, 1);
});

test("missing required personal data and duplicate Group-only rows remain incomplete", async () => {
  const f = await groupFixture(client), catalogue = frameworks(f.ids);
  await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.cards.users().updateOne({ _id: "bob" }, { $pull: { cardsData: { cardTemplateId: f.ids[0] } } });
  assert.equal((await readFrameworkSummary(f.cards, "bob", "skills", catalogue)).framework.areas[0].items[0].progress.state, "incomplete");
  await f.repo.writeLearning("carol", f.experienceId, f.ids[0], "personal", { accessEpoch: 0, version: 1, change: { kind: "completion", stepId: "a0", completionStatus: "done" } });
  const duplicate = (await f.cards.getPersonalUser("carol"))!.cardsData[0];
  await f.cards.users().updateOne({ _id: "carol" }, { $push: { cardsData: duplicate } });
  assert.equal((await readFrameworkSummary(f.cards, "carol", "skills", catalogue)).framework.areas[0].items[0].progress.state, "incomplete");
});

test("retained assignment versions must exist and do not legitimise arbitrary orphan CardData", async () => {
  const f = await groupFixture(client, { followers: [] }), catalogue = frameworks(f.ids);
  await f.cards.ensureDeckData("bob", f.deckId, 1);
  await f.cards.users().updateOne({ _id: "bob" }, { $set: { decksData: [], retainedCardAssignments: [{ cardTemplateId: f.ids[0], version: 99 }] } });
  const result = (await readFrameworkSummary(f.cards, "bob", "skills", catalogue)).framework;
  assert.equal(result.areas[0].items[0].progress.state, "incomplete");
  assert.equal(result.areas[0].items[1].progress.state, "empty");
});
