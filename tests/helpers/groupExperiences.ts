import { randomUUID } from "node:crypto";
import type { MongoClient } from "mongodb";
import { CardRepository, createFoundationIndexes } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { createGroupExperienceIndexes } from "../../src/lib/groupExperiences/indexes";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import type { CreateExperience } from "../../src/lib/groupExperiences/model";

export async function groupFixture(client: MongoClient, options: { followers?: string[]; admins?: string[]; cardCount?: number } = {}) {
  const cards = new CardRepository(client.db(`switchplay_test_groups_${randomUUID().replaceAll("-", "")}`), client);
  await createFoundationIndexes(cards.db); await createGroupExperienceIndexes(cards.db);
  await cards.users().insertMany(["alice", "bob", "carol", "dave", "creator", "outsider"].map(_id => ({ _id,
    username: _id, email: `PRIVATE-${_id}@example.test`, isAdmin: _id === "outsider", decksData: [], cardsData: [] })));
  const ids: string[] = [];
  for (let i = 0; i < (options.cardCount ?? 2); i++) {
    const root = await cards.createCardDraft("creator", { ...createDefaultCardContent([`a${i}`, `b${i}`, `c${i}`]),
      intro: { title: `Practice ${i}`, description: null, mediaItem: null }, suggestedTargetDate: "2027-06-01" }, "public");
    await cards.publishCard("creator", root.cardTemplateId, 0); ids.push(root.cardTemplateId);
  }
  const deck = await cards.createDeckDraft("creator", { ...createDefaultDeckContent([]), title: "Public practice", cards: ids.map(cardTemplateId => ({ cardTemplateId })) }, "public");
  await cards.publishDeck("creator", deck.deckTemplateId, 0);
  const repo = new GroupExperienceRepository(cards);
  const command: CreateExperience = { operationId: randomUUID(), name: "Practice together", adminIds: options.admins ?? [], followerIds: options.followers ?? ["bob", "carol"],
    manifest: { deckTemplateId: deck.deckTemplateId, deckVersion: 1, cards: ids.map(cardTemplateId => ({ cardTemplateId, version: 1 })) } };
  const experience = await repo.create("alice", command);
  return { repo, cards, command, experienceId: experience.experienceId, ids, deckId: deck.deckTemplateId };
}
export const completion = (stepId: string, completionStatus: "todo" | "done" | "skipped" | "inProgress" = "done", accessEpoch = 0, version = 1) =>
  ({ accessEpoch, version, change: { kind: "completion", stepId, completionStatus } });
export const signal = (stepId: string, reading: number | null, accessEpoch = 0, version = 1) =>
  ({ accessEpoch, version, change: { kind: "signal", stepId, reading } });
