import { ObjectId, type MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { CardRepository } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { createGroupExperienceIndexes } from "../../src/lib/groupExperiences/indexes";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";

// Called only by the disposable harness. Never seed through the normal app URI.
export async function seedGroupReview(client: MongoClient, database: string, adminId: string, otherId: string, cardCount = 3) {
  const cards = new CardRepository(client.db(database), client), repo = new GroupExperienceRepository(cards);
  await createGroupExperienceIndexes(cards.db);
  const now = new Date(), names = ["Alice", "Bob", "Carla", "Daniel", "Eva", "Finn", "Grace", "Hannah", "Isaac", "Julia", "Kai", "Liam", "Mia", "Nora With A Long Username", "Former"];
  const people = names.map(username => ({ _id: new ObjectId(), username, email: `${randomUUID()}@example.invalid`, passwordHash: bcrypt.hashSync("local-test-only", 4), cardsData: [], decksData: [], createdAt: now, updatedAt: now }));
  await cards.users().insertMany(people);
  const followers = [otherId, ...people.slice(0, 14).map(person => person._id.toHexString())], former = people.at(-1)!._id.toHexString();
  const cardIds: string[] = [];
  for (let i = 0; i < cardCount; i++) {
    const root = await cards.createCardDraft(adminId, { ...createDefaultCardContent([`group-${i}-a`, `group-${i}-b`, `group-${i}-c`]),
      intro: { title: ["Find your balance", "Control the movement", "Make it consistent"][i % 3], description: "Compare the same Card across authorised perspectives.", mediaItem: null },
      steps: ["Prepare", "Practise", "Reflect"].map((title, j) => ({ stepId: `group-${i}-${["a", "b", "c"][j]}`, title, description: "Take your time and notice what changes.", mediaItem: null })) }, "public");
    await cards.publishCard(adminId, root.cardTemplateId, 0); cardIds.push(root.cardTemplateId);
  }
  const deck = await cards.createDeckDraft(adminId, { ...createDefaultDeckContent([]), title: "Movement practice", categories: ["basketball"],
    cards: cardIds.map(cardTemplateId => ({ cardTemplateId })) }, "public");
  await cards.publishDeck(adminId, deck.deckTemplateId, 0);
  const create = (name: string, members: string[], deckTemplateId = deck.deckTemplateId, ids = cardIds, version = 1) => repo.create(adminId, {
    name, operationId: randomUUID(), adminIds: [], followerIds: members,
    manifest: { deckTemplateId, deckVersion: 1, cards: ids.map(cardTemplateId => ({ cardTemplateId, version })) },
  });
  const group = await create("Galway U18", [...followers, former]);
  await repo.saveSettings(adminId, group.experienceId, { operationId: "fixture-visibility", expectedStructureRevision: 0, allowFollowerInspection: true });
  const statuses = ["inProgress", "inProgress", "inProgress", "done", "done", "skipped", ...Array(9).fill("todo")] as const;
  for (const [i, actor] of followers.entries()) {
    const change = (stepId: string, kind: "completion" | "signal", value: string | number) => repo.writeLearning(actor, group.experienceId, cardIds[0], "personal", {
      accessEpoch: 0, version: 1, change: kind === "completion" ? { kind, stepId, completionStatus: value } : { kind, stepId, reading: value },
    });
    await change("group-0-a", "completion", statuses[i]);
    await change("group-0-b", "completion", i < 2 ? "skipped" : "todo");
    if (i < 4) await change("group-0-a", "signal", [10, 2, 2, 2][i]);
  }
  await repo.writeLearning(adminId, group.experienceId, cardIds[0], "group", { accessEpoch: 0, version: 1, change: { kind: "signal", stepId: "group-0-a", reading: 7 } });
  await repo.changeMember(adminId, group.experienceId, { kind: "remove-follower", targetUserId: former, operationId: "fixture-remove", expectedStructureRevision: 1 });
  await cards.ensureDeckData(otherId, deck.deckTemplateId, 1);
  await cards.users().updateOne({ _id: new ObjectId(otherId) }, { $set: { "cardsData.0.targetDate": "2027-09-10", "cardsData.0.reflection": "PRIVATE owner reflection",
    "cardsData.0.tests": [{ id: "PRIVATE-test", date: "2026-10-30", result: true, createdAt: now }] } });
  const second = await create("Galway development", followers);
  const zero = await create("Empty squad", []);
  const emptyDeck = await cards.createDeckDraft(adminId, { ...createDefaultDeckContent([]), title: "Empty practice", cards: [] }, "public");
  await cards.publishDeck(adminId, emptyDeck.deckTemplateId, 0);
  const empty = await create("No Cards yet", [], emptyDeck.deckTemplateId, []);
  return { experienceId: group.experienceId, secondId: second.experienceId, zeroId: zero.experienceId, emptyId: empty.experienceId,
    deckId: deck.deckTemplateId, cardIds, adminId, otherId, followers, former };
}
