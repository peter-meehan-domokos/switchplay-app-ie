import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { groupFixture, publishGroupDeck, reviewedUpdate } from "./helpers/groupExperiences";
import { createDefaultDeckContent } from "../src/lib/cards/creatorDefaults";
import { readAreaDestinations, readItemDestinations } from "../src/lib/frameworks/destinations";
import { readProgressNavigation } from "../src/lib/groupExperiences/progressNavigationReads";
import { readGroupProgressDestinations } from "../src/lib/groupExperiences/progressDestinations";
let mongo: MongoMemoryReplSet, client: MongoClient;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }); client = await new MongoClient(mongo.getUri()).connect(); });
after(async () => { await client?.close(); await mongo?.stop(); });
const catalogue = (ids: string[]) => [{ id: "skills", title: "Skills", areas: [{ id: "area", title: "Area", items: [
  { id: "goal", title: "Goal", cardTemplateIds: ids.slice(0, 1) }, { id: "next", title: "Next", cardTemplateIds: ids.slice(1) }] }] }];

test("personal destinations distinguish multiple named experiences sharing a Deck and exclude Admin-only membership", async () => {
  const f = await groupFixture(client), frameworks = catalogue(f.ids);
  const other = await f.repo.create("alice", { ...f.command, operationId: randomUUID(), name: "Other squad" });
  const area = await readAreaDestinations(f.cards, "bob", "skills", "area", frameworks);
  assert.deepEqual(new Set(area.experiences!.entries.map(entry => entry.experienceId)), new Set([f.experienceId, other.experienceId]));
  const item = await readItemDestinations(f.cards, "bob", "skills", "goal", frameworks);
  assert.equal(item.cards[0].contexts.filter(context => context.kind === "experience").length, 2);
  assert.equal((await readAreaDestinations(f.cards, "alice", "skills", "area", frameworks)).experiences, undefined);
  assert.equal((await f.cards.getPersonalUser("bob"))!.decksData.length, 0);
});
test("retained personal learning does not resurrect a removed Group destination", async () => {
  const f = await groupFixture(client), frameworks = catalogue(f.ids);
  await f.repo.changeMember("alice", f.experienceId, { operationId: randomUUID(), expectedStructureRevision: 0, kind: "remove-follower", targetUserId: "bob" });
  const result = await readItemDestinations(f.cards, "bob", "skills", "goal", frameworks);
  assert.equal(result.cards.flatMap(card => card.contexts).some(context => context.kind === "experience"), false);
  assert.ok((await f.repo.members().findOne({ experienceId: f.experienceId, userId: "bob" }))!.retainedCardAssignments!.length);
});
test("fixed Group destinations preserve the selected permitted subject and exclude removed composition", async () => {
  const f = await groupFixture(client), frameworks = catalogue(f.ids);
  const value = await readGroupProgressDestinations(f.repo, "alice", f.experienceId, "skills", { itemId: "goal" }, { kind: "player", userId: "bob" }, frameworks);
  assert.equal(value.perspective.kind, "player"); assert.equal(value.cards[0].cardTemplateId, f.ids[0]);
  await assert.rejects(readGroupProgressDestinations(f.repo, "carol", f.experienceId, "skills", { itemId: "goal" }, { kind: "player", userId: "bob" }, frameworks), { code: "GROUP_PERSPECTIVE_FORBIDDEN" });
  const libraryDeck = await f.cards.createDeckDraft("creator", { ...createDefaultDeckContent([]), title: "Public outside practice", cards: [{ cardTemplateId: f.ids[0] }] }, "public");
  await f.cards.publishDeck("creator", libraryDeck.deckTemplateId, 0);
  await publishGroupDeck(f, [f.ids[1]]); await f.repo.adoptUpdate("alice", f.experienceId, await reviewedUpdate(f, "deck", f.deckId));
  const removed = await readGroupProgressDestinations(f.repo, "alice", f.experienceId, "skills", { itemId: "goal" }, { kind: "group" }, frameworks);
  assert.equal(removed.experiences.entries.length, 0); assert.ok(removed.library.entries.length);
  assert.ok(removed.cards.every(card => "contexts" in card && card.contexts.every(context => context.kind === "library")));
});
test("progress roster counts all active followers and pages identities with current membership authority", async () => {
  const f = await groupFixture(client), ids = Array.from({ length: 105 }, (_, index) => `member-${String(index).padStart(3, "0")}`);
  await f.cards.users().insertMany(ids.map(_id => ({ _id, username: _id, decksData: [], cardsData: [] })));
  await f.repo.members().insertMany(ids.map(id => f.repo.newMember(f.experienceId, id, false, true, f.command.manifest.cards, new Date())));
  const first = await readProgressNavigation(f.repo, "alice", f.experienceId); assert.equal(first.followers.length, 100); assert.equal(first.activeFollowerCount, 107);
  const second = await readProgressNavigation(f.repo, "alice", f.experienceId, first.nextCursor!); assert.equal(second.followers.length, 7);
  const own = await readProgressNavigation(f.repo, "bob", f.experienceId); assert.equal(own.followers.length, 1); assert.equal(own.activeFollowerCount, 107); assert.equal(own.isFollower, true);
  await assert.rejects(readProgressNavigation(f.repo, "outsider", f.experienceId), { code: "GROUP_FORBIDDEN" });
});
