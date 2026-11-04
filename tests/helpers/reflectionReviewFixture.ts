import { randomUUID } from "node:crypto";
import { ObjectId, type MongoClient } from "mongodb";
import { CardRepository } from "../../src/lib/cards/repository";
import { GroupExperienceRepository } from "../../src/lib/groupExperiences/repository";
import { GroupReflectionRepository } from "../../src/lib/reflections/groupRepository";
import { createGroupReflectionIndexes } from "../../src/lib/reflections/indexes";
import type { seedGroupReview } from "./groupReviewFixture";

// Seed exactly once at disposable runner startup. No login/read path calls this.
export async function seedReflectionReview(client: MongoClient, database: string, group: Awaited<ReturnType<typeof seedGroupReview>>) {
  if (!/^switchplay_phase2_browser_/.test(database)) throw Error("Disposable reflection fixture only");
  const cards = new CardRepository(client.db(database), client), groups = new GroupExperienceRepository(cards), reflections = new GroupReflectionRepository(groups);
  await createGroupReflectionIndexes(cards.db);
  await cards.ensureDeckData(group.otherId, group.deckId, 1);
  await cards.ensureDeckData(group.adminId, group.deckId, 1);
  const personal = ["I enjoyed this card and improved my footwork today.", "", "My balance improved after practising slowly before basketball training."];
  for (let i = 0; i < group.cardIds.length; i++) {
    await cards.users().updateOne({ _id: new ObjectId(group.otherId) }, { $set: { "cardsData.$[card].reflection": personal[i], "cardsData.$[card].reflectionRevision": 0 },
      $unset: { "cardsData.$[card].reflectionCreatedAt": "" } }, { arrayFilters: [{ "card.cardTemplateId": group.cardIds[i] }] });
  }
  const save = async (author: string, experienceId: string, index: number, text: string, days: number) => {
    const member = (await groups.members().findOne({ experienceId, userId: author }))!;
    const ack = await reflections.save(author, experienceId, group.cardIds[index], { operationId: randomUUID(), expectedRevision: 0, accessEpoch: member.accessEpoch, text });
    await reflections.rows().updateOne({ reflectionId: ack.reflectionId! }, { $set: { createdAt: new Date(Date.now() - days * 86400000) } });
    return ack;
  };
  const first = await save(group.otherId, group.experienceId, 0, "I contributed well to our Galway U18 group today.", 4);
  await save(group.adminId, group.experienceId, 0, "Our group communicated better during the defensive drills today.", 5);
  await save(group.followers[1], group.experienceId, 0, "Our teammates helped me understand the defensive positioning drill.", 2);
  // Aoife has already left Galway development in the media fixture. Seed her
  // retained historical slot directly, without changing current memberships.
  for (const index of [0, 1]) await reflections.rows().insertOne({ reflectionId: randomUUID(), experienceId: group.secondId, cardTemplateId: group.cardIds[index], authorUserId: group.otherId,
    text: "I enjoyed working with the Galway development group today.", groupVisible: true, deleted: false, revision: 1, createdAt: new Date(Date.now() - 3 * 86400000), updatedAt: new Date(),
    lastOperation: { operationId: randomUUID(), actorUserId: group.otherId, commandHash: "disposable-historical-seed" } });
  await save(group.adminId, group.experienceId, 1, "Our group practised patiently and supported every member today.", 2);
  await save(group.otherId, group.experienceId, 2, "I found the first defensive drill difficult because I kept moving too quickly. After slowing down and listening to my teammates, I understood where to place my feet. Next time I want to stay balanced while passing and keep communicating throughout the practice.", 1);
  await reflections.rows().insertOne({ reflectionId: randomUUID(), experienceId: group.experienceId, cardTemplateId: group.cardIds[0], authorUserId: group.former,
    text: "Our Galway teammates helped me improve before leaving today.", groupVisible: true, deleted: false, revision: 1, createdAt: new Date(Date.now() - 6 * 86400000), updatedAt: new Date(), lastOperation: { operationId: randomUUID(), actorUserId: group.former, commandHash: "disposable-former-seed" } });
  return { cardId: group.cardIds[0], emptyCardId: group.cardIds[1], longCardId: group.cardIds[2], aoifeReflectionId: first.reflectionId, personalDeckId: group.deckId };
}
