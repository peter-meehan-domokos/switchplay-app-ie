import { randomUUID } from "node:crypto";
import type { MongoClient } from "mongodb";
import { CardRepository, createFoundationIndexes } from "../../src/lib/cards/repository";
import { createDefaultCardContent, createDefaultDeckContent } from "../../src/lib/cards/creatorDefaults";
import { createGroupExperienceIndexes } from "../../src/lib/groupExperiences/indexes";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import type { CreateExperience } from "../../src/lib/groupExperiences/model";
import { deckDraftContent } from "../../src/lib/cards/publicationRules";

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

export async function publishGroupCard(f: Awaited<ReturnType<typeof groupFixture>>, index: number, stepIds: string[]) {
  const id = f.ids[index], root = (await f.cards.cards().findOne({ cardTemplateId: id }))!;
  const prior = (await f.cards.getCardVersion(id, root.latestVersion))!;
  await f.cards.saveCardDraft("creator", id, root.revision, { ...prior.content, steps: stepIds.map((stepId, i) => ({ ...prior.content.steps[i], stepId })) });
  return f.cards.publishCard("creator", id, root.revision + 1, `Card update ${root.latestVersion + 1}`);
}
export async function publishGroupDeck(f: Awaited<ReturnType<typeof groupFixture>>, ids: string[]) {
  const root = (await f.cards.decks().findOne({ deckTemplateId: f.deckId }))!, prior = (await f.cards.getDeckVersion(f.deckId, root.latestVersion))!;
  await f.cards.saveDeckDraft("creator", f.deckId, root.revision, { ...deckDraftContent(prior.content), cards: ids.map(cardTemplateId => ({ cardTemplateId })) });
  return f.cards.publishDeck("creator", f.deckId, root.revision + 1, `Deck update ${root.latestVersion + 1}`);
}
export async function reviewedUpdate(f: Awaited<ReturnType<typeof groupFixture>>, kind: "card" | "deck", entityId: string, actor = "alice", experienceId = f.experienceId) {
  const result = await f.repo.reviewUpdate(actor, experienceId, kind, entityId);
  if (!result.review) throw Error("Fixture requires a pending Update");
  return { operationId: randomUUID(), review: result.review.command };
}
